/** Luvies earning — watch time, play time, wins and streaks. Client helpers. */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type ActivityKind = "watch" | "game";

/** Daily ceilings mirrored from the backend so the UI can explain them. */
export const ACTIVITY_RULES: Record<ActivityKind, { rate: number; cap: number; label: string }> = {
  watch: { rate: 2, cap: 240, label: "Movie time" },
  game: { rate: 3, cap: 300, label: "Game time" },
};

export const WIN_BONUS = 25;
export const STREAK_BONUS = 10;

/** Credits Luvies for minutes spent watching or playing (server-capped). */
export async function awardActivity(kind: ActivityKind, minutes: number) {
  if (minutes < 1) return null;
  const { data, error } = await db.rpc("award_activity", { _kind: kind, _minutes: Math.round(minutes) });
  if (error) throw error;
  return data as { luvies: number; balance?: number; capped?: boolean };
}

/** Logs a finished game. Wins pay a bonus that grows with the win streak. */
export async function recordGameResult(game: string, won: boolean, room?: string | null) {
  const { data, error } = await db.rpc("record_game_result", {
    _game: game,
    _won: won,
    _room: room ?? null,
  });
  if (error) throw error;
  return data as { luvies: number; streak: number; balance?: number };
}
