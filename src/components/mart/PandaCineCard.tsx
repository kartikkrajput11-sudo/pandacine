import { LuvieCoin } from "@/components/luvies/LuviesAmount";
import { cardNumber } from "@/lib/mart";
import { cn } from "@/lib/utils";

/**
 * The PandaCine Card — the debit card every keeper pays with at PandaMart.
 * Purely presentational: the balance is the authoritative Luvies wallet.
 */
export function PandaCineCard({
  holder,
  userId,
  balance,
  partnerName,
  className,
  compact,
}: {
  holder: string;
  userId?: string | null;
  balance: number;
  partnerName?: string | null;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-petal/30 p-5 text-candle",
        "bg-[linear-gradient(135deg,rgba(232,163,183,0.24),rgba(24,10,26,0.9)_55%,rgba(60,20,48,0.9))]",
        "shadow-[0_24px_60px_-30px_rgba(232,163,183,0.6)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-petal/25 blur-3xl"
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.32em] text-petal">PandaCine Card</p>
          <p className="font-serif text-lg italic leading-tight">Luvies Debit</p>
        </div>
        <span className="text-2xl">🐼</span>
      </div>

      <div className="relative mt-5 flex items-center gap-3">
        <div className="h-7 w-10 rounded-md bg-[linear-gradient(135deg,#f0d78c,#b98a3d)]" aria-hidden />
        <p className="font-mono text-[13px] tracking-[0.18em] text-candle/90">{cardNumber(userId)}</p>
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.24em] text-candle-muted">Card holder</p>
          <p className="truncate text-sm font-medium uppercase tracking-wide">{holder || "Keeper"}</p>
          {partnerName && !compact && (
            <p className="mt-0.5 truncate text-[10px] text-candle-muted">Joint account · {partnerName}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-[0.24em] text-candle-muted">Balance</p>
          <p className="flex items-center justify-end gap-1 font-serif text-xl italic text-petal tabular-nums">
            <LuvieCoin className="size-4" />
            {balance.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
