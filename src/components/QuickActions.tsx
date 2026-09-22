import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Mail, BookHeart, Film, Gamepad2, MessageCircle } from "lucide-react";
import type { ComponentType } from "react";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sfxKiss, sfxReaction, sfxSend } from "@/lib/sfx";

type Action = {
  label: string;
  Icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
  onRun: () => void | Promise<void>;
};

async function sendGesture(
  partnerId: string,
  meId: string,
  type: "kiss" | "nudge" | "whisper" | "text",
  content: string,
) {
  const { error } = await supabase.from("messages").insert({
    sender_id: meId,
    receiver_id: partnerId,
    type,
    content,
  });
  if (error) throw error;
}

export function QuickActions() {
  const { data } = useProfile();
  const me = data?.profile;
  const partnerId = me?.partner_id ?? null;
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const requirePartner = (fn: () => void | Promise<void>) => async () => {
    if (!partnerId) {
      toast("Pair with your partner first", { description: "Head to Friends to invite them." });
      navigate({ to: "/app/friends" });
      return;
    }
    await fn();
  };

  const withBusy = (label: string, fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const actions: Action[] = [
    {
      label: "Hug",
      Icon: Heart,
      tint: "var(--petal)",
      onRun: requirePartner(
        withBusy("Hug", async () => {
          if (!partnerId || !me) return;
          await sendGesture(partnerId, me.id, "kiss", "🫂");
          sfxReaction();
          toast("Hug sent 🫂");
          if ("vibrate" in navigator) navigator.vibrate?.(30);
        }),
      ),
    },
    {
      label: "Kiss",
      Icon: Heart,
      tint: "var(--lavender)",
      onRun: requirePartner(
        withBusy("Kiss", async () => {
          if (!partnerId || !me) return;
          await sendGesture(partnerId, me.id, "kiss", "💋");
          sfxKiss();
          toast("Kiss sent 💋");
          if ("vibrate" in navigator) navigator.vibrate?.(30);
        }),
      ),
    },
    {
      label: "Nudge",
      Icon: Mail,
      tint: "var(--petal)",
      onRun: requirePartner(
        withBusy("Nudge", async () => {
          if (!partnerId || !me) return;
          await sendGesture(partnerId, me.id, "nudge", "👋");
          sfxSend();
          toast("Nudge sent 👋");
          if ("vibrate" in navigator) navigator.vibrate?.([40, 30, 40]);
        }),
      ),
    },
    {
      label: "Chat",
      Icon: MessageCircle,
      tint: "var(--lavender)",
      onRun: requirePartner(async () => {
        if (!partnerId) return;
        navigate({ to: "/app/chat/$peerId", params: { peerId: partnerId } });
      }),
    },
    {
      label: "Memory",
      Icon: BookHeart,
      tint: "var(--petal)",
      onRun: () => navigate({ to: "/app/memories" }),
    },
    {
      label: "Watch",
      Icon: Film,
      tint: "var(--lavender)",
      onRun: () => navigate({ to: "/app/movies", search: { q: "" } }),
    },
    {
      label: "Play",
      Icon: Gamepad2,
      tint: "var(--petal)",
      onRun: () => navigate({ to: "/app/play" }),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[10px] uppercase tracking-[0.22em] text-candle-muted">Little gestures</p>
        {partnerId && (
          <Link
            to="/app/chat/$peerId"
            params={{ peerId: partnerId }}
            className="text-[10px] uppercase tracking-widest text-petal"
          >
            Open chat →
          </Link>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
        {actions.map(({ label, Icon, tint, onRun }) => {
          const isBusy = busy === label;
          return (
            <Button
              key={label}
              type="button"
              variant="ghost"
              disabled={isBusy}
              onClick={() => { void onRun(); }}
              className="group h-auto shrink-0 flex-col gap-1.5 p-0 active:scale-95 disabled:opacity-60"
            >
              <div
                className="size-14 rounded-2xl glass flex items-center justify-center transition-all group-hover:-translate-y-0.5"
                style={{
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px -18px ${tint}`,
                }}
              >
                <Icon className={`size-5 ${isBusy ? "animate-pulse" : ""}`} style={{ color: tint }} />
              </div>
              <span className="text-[10px] tracking-wider text-candle-muted">{label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
