import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { awardActivity, recordGameResult, type ActivityKind } from "@/lib/earn";

const db = supabase as any;

/**
 * Turns time spent watching a movie or playing a game into Luvies.
 * Counts only while `active` and the tab is visible; flushes every 5 minutes
 * and once more on unmount so nothing is lost when the user leaves.
 */
export function useActivityEarner(kind: ActivityKind, active: boolean) {
  const qc = useQueryClient();
  const secondsRef = useRef(0);

  useEffect(() => {
    const flush = async () => {
      const minutes = Math.floor(secondsRef.current / 60);
      if (minutes < 1) return;
      secondsRef.current -= minutes * 60;
      try {
        const res = await awardActivity(kind, minutes);
        if (res?.luvies) {
          qc.invalidateQueries({ queryKey: ["luvies"] });
          toast.success(`+${res.luvies} Luvies for ${minutes} min`);
        }
      } catch {
        /* silent — earning must never interrupt playback */
      }
    };

    const tick = setInterval(() => {
      if (!active || document.hidden) return;
      secondsRef.current += 10;
      if (secondsRef.current >= 300) void flush();
    }, 10_000);

    return () => {
      clearInterval(tick);
      void flush();
    };
  }, [kind, active, qc]);
}

/** Records a game result and shows the win / streak payout. */
export function useGameResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, won, room }: { game: string; won: boolean; room?: string | null }) =>
      recordGameResult(game, won, room),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["luvies"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      if (res?.luvies) {
        toast.success(
          res.streak > 1 ? `+${res.luvies} Luvies · ${res.streak} win streak 🔥` : `+${res.luvies} Luvies for the win`,
        );
      }
    },
  });
}

export type LeaderRow = {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  total: number;
};

export function useLeaderboard(kind: "messages" | "wins", limit = 20) {
  return useQuery({
    queryKey: ["leaderboard", kind, limit],
    staleTime: 60_000,
    queryFn: async (): Promise<LeaderRow[]> => {
      const { data, error } = await db.rpc(
        kind === "messages" ? "leaderboard_messages" : "leaderboard_wins",
        { _limit: limit },
      );
      if (error) throw error;
      return (data ?? []) as LeaderRow[];
    },
  });
}

export type Tournament = {
  id: string;
  theme: string;
  week_key: string;
  closes_at: string;
  status: "open" | "voting" | "closed";
  prizes: number[];
};

export type TournamentEntry = {
  id: string;
  user_id: string;
  partner_id: string | null;
  title: string;
  image_url: string;
  votes: number;
  rank: number | null;
  awarded: number;
  created_at: string;
};

export function useTournament() {
  const qc = useQueryClient();

  const tournament = useQuery({
    queryKey: ["tournament", "current"],
    staleTime: 60_000,
    queryFn: async (): Promise<Tournament | null> => {
      const { data, error } = await db.rpc("current_tournament");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as Tournament) ?? null;
    },
  });

  const id = tournament.data?.id;

  const entries = useQuery({
    queryKey: ["tournament", "entries", id],
    enabled: !!id,
    queryFn: async (): Promise<TournamentEntry[]> => {
      const { data, error } = await db
        .from("tournament_entries")
        .select("id,user_id,partner_id,title,image_url,votes,rank,awarded,created_at")
        .eq("tournament_id", id)
        .order("votes", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TournamentEntry[];
    },
  });

  const myVote = useQuery({
    queryKey: ["tournament", "vote", id],
    enabled: !!id,
    queryFn: async (): Promise<string | null> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data } = await db
        .from("tournament_votes")
        .select("entry_id")
        .eq("tournament_id", id)
        .eq("user_id", userRes.user.id)
        .maybeSingle();
      return (data as any)?.entry_id ?? null;
    },
  });

  const submit = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid || !id) throw new Error("Sign in first");
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${uid}/tournament/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type || "image/png", upsert: false });
      if (upErr) throw upErr;

      const { data: prof } = await db.from("profiles").select("partner_id").eq("id", uid).maybeSingle();
      const { error } = await db
        .from("tournament_entries")
        .upsert(
          {
            tournament_id: id,
            user_id: uid,
            partner_id: (prof as any)?.partner_id ?? null,
            title: title.trim().slice(0, 60) || "Untitled",
            image_url: path,
          },
          { onConflict: "tournament_id,user_id" },
        );
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => {
      toast.success("Your artwork is in this week's gallery");
      qc.invalidateQueries({ queryKey: ["tournament"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't submit your artwork"),
  });

  const vote = useMutation({
    mutationFn: async (entryId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid || !id) throw new Error("Sign in first");
      await db.from("tournament_votes").delete().eq("tournament_id", id).eq("user_id", uid);
      const { error } = await db.from("tournament_votes").insert({
        tournament_id: id,
        entry_id: entryId,
        user_id: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vote counted");
      qc.invalidateQueries({ queryKey: ["tournament"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't record your vote"),
  });

  return { tournament, entries, myVote, submit, vote };
}
