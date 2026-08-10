import { useState } from "react";
import { Flame, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuviesAmount } from "@/components/luvies/LuviesAmount";
import { InsufficientLuviesDialog } from "@/components/luvies/InsufficientLuviesDialog";
import { useStreakRecovery } from "@/hooks/useLuvies";

/**
 * Streak recovery — offered only when the backend says the streak actually broke.
 * Pricing scales with how many days were lost and is quoted server-side.
 */
export function StreakRecoveryCard() {
  const { state, recover } = useStreakRecovery();
  const [short, setShort] = useState(false);
  const s = state.data;

  if (!s?.eligible) return null;

  const cost = s.cost ?? 0;
  const lost = s.lost_days ?? 0;

  async function onRecover() {
    if ((s?.balance ?? 0) < cost) {
      setShort(true);
      return;
    }
    try {
      const res = await recover.mutateAsync();
      toast.success(`Streak restored — ${res.streak} days back on the fire 🔥`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-surface p-5">
        <div className="pointer-events-none absolute -top-14 -left-8 size-44 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="grid place-items-center size-11 rounded-full border border-amber-400/40 bg-amber-500/10">
            <Flame className="size-5 text-amber-300" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Streak broken</p>
            <h3 className="text-lg font-semibold mt-0.5">
              You missed {lost} {lost === 1 ? "day" : "days"}
            </h3>
            <p className="text-xs text-candle-muted mt-1">
              Restore those check-ins and keep your streak alive. One recovery per broken streak.
            </p>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-ink/40 px-3 py-2">
              <span className="text-xs text-candle-muted">Recovery cost</span>
              <LuviesAmount value={cost} size="lg" />
            </div>

            <Button className="mt-3 w-full" onClick={onRecover} disabled={recover.isPending}>
              <RotateCcw className="size-4" />
              {recover.isPending ? "Restoring…" : "Recover streak"}
            </Button>
            <p className="mt-2 text-[11px] text-candle-muted text-center">
              Balance: <LuviesAmount value={s.balance} size="sm" />
            </p>
          </div>
        </div>
      </div>

      <InsufficientLuviesDialog
        open={short}
        onClose={() => setShort(false)}
        needed={cost}
        balance={s.balance}
      />
    </>
  );
}
