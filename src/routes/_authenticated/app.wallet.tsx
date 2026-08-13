import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { LuviesAmount, LuvieCoin } from "@/components/luvies/LuviesAmount";
import { useLuviesHistory, useLuviesWallet } from "@/hooks/useLuvies";
import { ledgerLabel } from "@/lib/luvies";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/wallet")({
  component: WalletRoute,
  head: () => ({
    meta: [
      { title: "Luvies Wallet — PandaCine" },
      { name: "description", content: "Your Luvies balance, earnings and full transaction history in PandaCine." },
      { property: "og:title", content: "Luvies Wallet — PandaCine" },
      { property: "og:description", content: "Track every Luvie you earn and spend across PandaCine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function WalletRoute() {
  const { data: wallet, isLoading } = useLuviesWallet();
  const { data: history = [] } = useLuviesHistory();

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-ink/70 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/app" className="size-9 rounded-full border border-border flex items-center justify-center">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-sm uppercase tracking-[0.28em] text-candle-muted">Luvies Wallet</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <section className="relative overflow-hidden rounded-3xl border border-petal/25 bg-surface p-6">
          <div className="pointer-events-none absolute -top-16 -right-10 size-52 rounded-full bg-petal/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <LuvieCoin className="size-14" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Balance</p>
              <p className="text-4xl font-semibold tabular-nums text-petal">
                {isLoading ? "—" : new Intl.NumberFormat("en-US").format(wallet?.balance ?? 0)}
              </p>
              <p className="text-xs text-candle-muted">Luvies</p>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-3">
            <Stat icon={<TrendingUp className="size-4 text-emerald-400" />} label="Earned" value={wallet?.earned ?? 0} />
            <Stat icon={<TrendingDown className="size-4 text-rose-400" />} label="Spent" value={wallet?.spent ?? 0} />
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-2">
            <Button asChild>
              <Link to="/app/panda-shop">
                <Sparkles className="size-4" /> Panda Shop
              </Link>
            </Button>
            <Button variant="quiet" asChild>
              <Link to="/app/arena">Earn Luvies</Link>
            </Button>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-candle-muted mb-3">Transaction history</h2>
          {history.length === 0 ? (
            <p className="text-sm text-candle-muted py-6 text-center">
              No Luvies movements yet — check in with your partner to earn your first ones.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((t) => {
                const { title, detail } = ledgerLabel(t.reason, t.ref_id);
                const positive = t.delta > 0;
                return (
                  <li key={t.id} className="py-3 flex items-center gap-3">
                    <span className="text-lg">{positive ? "💗" : t.reason === "streak_recovery" ? "🔥" : "🐼"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium capitalize truncate">{title}</p>
                      <p className="text-[11px] text-candle-muted capitalize truncate">
                        {detail} · {new Date(t.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-400" : "text-rose-300"}`}
                    >
                      {positive ? "+" : "−"}
                      {new Intl.NumberFormat("en-US").format(Math.abs(t.delta))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-ink/40 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-candle-muted">
        {icon} {label}
      </div>
      <LuviesAmount value={value} size="lg" className="mt-1" />
    </div>
  );
}
