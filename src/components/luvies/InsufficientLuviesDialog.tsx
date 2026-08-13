import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LuviesAmount, LuvieCoin } from "./LuviesAmount";

/** Shown whenever a purchase or recovery costs more than the wallet holds. */
export function InsufficientLuviesDialog({
  open,
  onClose,
  needed,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  needed: number;
  balance: number;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Not enough Luvies <LuvieCoin className="size-5" />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-border bg-surface p-3 space-y-2">
            <Row label="You need" value={needed} />
            <Row label="You have" value={balance} />
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-candle-muted">Short by</span>
              <LuviesAmount value={Math.max(0, needed - balance)} />
            </div>
          </div>
          <p className="text-xs text-candle-muted">
            Earn Luvies from watch time, game wins, streaks and Arena tournaments.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button asChild>
              <Link to="/app/wallet" onClick={onClose}>
                Get Luvies
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-candle-muted">{label}</span>
      <LuviesAmount value={value} />
    </div>
  );
}
