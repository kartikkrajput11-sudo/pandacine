import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useProfileById } from "@/hooks/useProfileById";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { gameRoomKey, isPartnerRoom } from "@/lib/game-room";

export type DuoMode = "partner" | "local";
export type DuoSeat = 0 | 1;

export type DuoSearch = { matchId?: string; friend?: string; room?: string };

/** Shared search-param validator for every duo game route. */
export function duoSearch(search: Record<string, unknown>): DuoSearch {
  return {
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
    friend: typeof search.friend === "string" ? search.friend : undefined,
    room: typeof search.room === "string" ? search.room : undefined,
  };
}

/**
 * Duo multiplayer plumbing shared by every two-player game — the exact
 * pattern Chess and Ludo already use:
 *  - opponent resolved from ?matchId / ?friend / paired partner
 *  - seat 0 is the lower user id and acts as the authoritative host
 *  - state travels over one Supabase broadcast channel per room
 *  - late joiners ask the host to re-broadcast instead of clobbering state
 */
export function useDuoGame<S>(opts: {
  game: string;
  search: DuoSearch;
  initial: () => S;
}) {
  const { game, search, initial } = opts;
  const { data } = useProfile();
  const me = data?.profile;
  const { matchId, friend, room } = search;
  const { opponentId: matchOppId } = useMatchOpponent(matchId, me?.id);
  const otherId = matchId ? matchOppId : friend && me && friend !== me.id ? friend : null;
  const { data: otherProfile } = useProfileById(otherId);

  const partner = otherId
    ? {
        id: otherId,
        display_name: otherProfile?.display_name ?? otherProfile?.username ?? "Friend",
        avatar_url: otherProfile?.avatar_url ?? null,
      }
    : data?.partner;

  const [mode, setMode] = useState<DuoMode | null>(null);
  useEffect(() => {
    if ((matchId || friend || room) && partner && !mode) setMode("partner");
  }, [matchId, friend, room, partner, mode]);

  const [state, setStateRaw] = useState<S>(initial);

  const seat: DuoSeat = useMemo(() => {
    if (mode !== "partner" || !me || !partner) return 0;
    return me.id < partner.id ? 0 : 1;
  }, [mode, me?.id, partner?.id]);
  const isHost = seat === 0;

  const roomKey = useMemo(
    () => gameRoomKey({ room, matchId, meId: me?.id, otherId: partner?.id }),
    [room, matchId, me?.id, partner?.id],
  );

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stateRef = useRef<S>(state);
  stateRef.current = state;

  useEffect(() => {
    if (mode !== "partner" || !me || !partner) return;
    const ch = supabase.channel(`${game}:${roomKey}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      setStateRaw(payload as S);
    });
    ch.on("broadcast", { event: "sync-request" }, () => {
      if (!isHost) return;
      void ch.send({ type: "broadcast", event: "state", payload: stateRef.current });
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && !isHost) {
        void ch.send({ type: "broadcast", event: "sync-request", payload: {} });
      }
    });
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [mode, me?.id, partner?.id, roomKey, isHost, game]);

  /** Apply a state change locally and push it to the opponent. */
  const push = useCallback(
    (next: S) => {
      setStateRaw(next);
      if (mode === "partner" && chRef.current) {
        void chRef.current.send({ type: "broadcast", event: "state", payload: next });
      }
    },
    [mode],
  );

  const reset = useCallback(() => push(initial()), [push, initial]);

  /** True when it is this device's turn to act. */
  const canAct = useCallback(
    (turn: DuoSeat) => mode === "local" || turn === seat,
    [mode, seat],
  );

  return {
    me,
    partner,
    mode,
    setMode,
    seat,
    isHost,
    state,
    push,
    setLocal: setStateRaw,
    reset,
    canAct,
    roomKey,
    partnerRoom: isPartnerRoom(partner?.id, data?.partner?.id),
  };
}
