import { useEffect, useState } from "react";
import { Flame, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuviesAmount } from "@/components/luvies/LuviesAmount";
import { useStreakRecovery } from "@/hooks/useLuvies";

/**
 * Streak recovery — offered ONLY when the backend says:
 *   • the streak actually broke,
 *   • it broke less than 48 hours ago,
 *   • the user has enough Luvies,
 *   • and they haven't already declined or recovered this streak.
 * Anything else and this card renders nothing at all.
 */
export function StreakRecoveryCard() {
  const { state, recover, decline } = useStreakRecovery();
  const s = state.data;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!s?.eligible) return null;

  const cost = s.cost ?? 0;
  const lost = s.lost_days ?? 0;
  const msLeft = s.expires_at ? new Date(s.expires_at).getTime() - now : 0;
  if (s.expires_at && msLeft <= 0) return null;

  const hoursLeft = Math.max(0, Math.floor(msLeft / 3_600_000));
  const minsLeft = Math.max(0, Math.floor((msLeft % 3_600_000) / 60_000));

  async function onRecover() {
    try {
      const res = await recover.mutateAsync();
      toast.success(`Streak restored — ${res.streak} days back on the fire 🔥`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function onDecline() {
    try {
      await decline.mutateAsync();
      toast("Streak let go. You'll start fresh from today.");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-surface p-5">
      <div className="pointer-events-none absolute -top-14 -left-8 size-44 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className="grid place-items-center size-11 rounded-full border border-amber-400/40 bg-amber-500/10">
          <Flame className="size-5 text-amber-300" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Streak broken</p>
          <h3 className="text-lg font-semibold mt-0.5">
            Your {lost}-day streak stopped
          </h3>
          <p className="text-xs text-candle-muted mt-1">
            Recover it and continue from exactly where it broke. This offer disappears in{" "}
            <span className="text-amber-300">
              {hoursLeft}h {minsLeft}m
            </span>
            .
          </p>

          <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-ink/40 px-3 py-2">
            <span className="text-xs text-candle-muted">Recovery cost</span>
            <LuviesAmount value={cost} size="lg" />
          </div>

          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={onRecover} disabled={recover.isPending || decline.isPending}>
              <RotateCcw className="size-4" />
              {recover.isPending ? "Restoring…" : "Recover streak"}
            </Button>
            <Button variant="ghost" onClick={onDecline} disabled={recover.isPending || decline.isPending}>
              <X className="size-4" />
              No thanks
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-candle-muted text-center">
            Balance: <LuviesAmount value={s.balance} size="sm" />
          </p>
        </div>
      </div>
    </div>
  );
}
