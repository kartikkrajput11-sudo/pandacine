import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_MS = 20_000;
const TYPING_TIMEOUT_MS = 2_500;

type PresenceState = {
  online: Set<string>;
  typing: Set<string>;
};

export function useGroupPresence(groupId: string | null, meId: string | null) {
  const [state, setState] = useState<PresenceState>({ online: new Set(), typing: new Set() });
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const broadcastTyping = useCallback(
    (typing: boolean) => {
      if (!groupId || !meId) return;
      void supabase.channel(`group-presence-${groupId}`).send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: meId, typing },
      });
    },
    [groupId, meId],
  );

  const setTyping = useCallback(
    (active: boolean) => {
      broadcastTyping(active);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (active) {
        typingTimer.current = setTimeout(() => broadcastTyping(false), TYPING_TIMEOUT_MS);
      }
    },
    [broadcastTyping],
  );

  useEffect(() => {
    if (!groupId || !meId) return;

    const channel = supabase
      .channel(`group-presence-${groupId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "presence" }, (msg: any) => {
        const uid = msg?.payload?.user_id as string | undefined;
        if (!uid) return;
        setState((prev) => {
          const next = new Set(prev.online);
          next.add(uid);
          return { ...prev, online: next };
        });
      })
      .on("broadcast", { event: "typing" }, (msg: any) => {
        const uid = msg?.payload?.user_id as string | undefined;
        const typing = !!msg?.payload?.typing;
        if (!uid || uid === meId) return;
        setState((prev) => {
          const next = new Set(prev.typing);
          if (typing) next.add(uid);
          else next.delete(uid);
          return { ...prev, typing: next };
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.send({
            type: "broadcast",
            event: "presence",
            payload: { user_id: meId, online: true },
          });
          heartbeatRef.current = setInterval(() => {
            void channel.send({
              type: "broadcast",
              event: "presence",
              payload: { user_id: meId, online: true },
            });
          }, HEARTBEAT_MS);
        }
      });

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      void supabase.removeChannel(channel);
    };
  }, [groupId, meId]);

  const onlineIds = Array.from(state.online);
  const typingIds = Array.from(state.typing);

  return { onlineIds, typingIds, setTyping };
}
