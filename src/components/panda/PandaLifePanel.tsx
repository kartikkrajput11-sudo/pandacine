import { useState } from "react";
import { Link2, Skull, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LuviesAmount } from "@/components/luvies/LuviesAmount";
import { BOND_COST, usePetBond, usePetLifeActions, usePetMemorials } from "@/hooks/usePandaLife";
import { REBIRTH_COST, pandaLifecycle } from "@/lib/panda-lifecycle";

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const REASON_TEXT: Record<string, string> = {
  starvation: "Went too long without food",
  "let go": "Lovingly retired by you",
};

/**
 * Life & legacy: revive a fallen panda, start over with a new one, keep the
 * memorial of every panda you've cared for, and merge pandas with your partner.
 */
export function PandaLifePanel({
  pet,
  balance,
  partnerName,
  hasPartner,
}: {
  pet: any | null;
  balance: number;
  partnerName?: string | null;
  hasPartner: boolean;
}) {
  const { revive, retire, bond } = usePetLifeActions();
  const { data: memorials = [] } = usePetMemorials();
  const { data: bonded } = usePetBond();
  const [openHistory, setOpenHistory] = useState(false);

  const gone = pet?.unlocked && pet?.alive === false;

  return (
    <section className="rounded-3xl glass p-5 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Life &amp; legacy</p>
          <h3 className="font-serif text-xl italic">Your panda's story</h3>
        </div>
        <Sparkles className="size-4 text-petal" />
      </header>

      {pet?.unlocked && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl border border-border bg-surface/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">Born</p>
            <p className="mt-1 font-serif italic">{fmt(pet.born_at)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">
              {gone ? "Passed" : "Status"}
            </p>
            <p className="mt-1 font-serif italic">{gone ? fmt(pet.died_at) : "Alive & well"}</p>
          </div>
        </div>
      )}

      {gone && (
        <div className="rounded-2xl border border-coral/40 bg-coral/5 p-4 space-y-3">
          <p className="flex items-center gap-2 text-sm">
            <Skull className="size-4 text-coral" />
            {pet.name} is gone — {REASON_TEXT[pet.death_reason ?? "starvation"] ?? pet.death_reason ?? "starvation"}.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => revive.mutate()}
              disabled={revive.isPending || balance < REVIVE_COST}
              className="justify-center"
            >
              <HeartPulse className="size-4" />
              Revive · <LuviesAmount value={REVIVE_COST} />
            </Button>
            <Button
              variant="quiet"
              className="justify-center"
              disabled={retire.isPending}
              onClick={() => {
                if (confirm(`Say goodbye to ${pet.name} and adopt a new panda? Their story is kept forever.`))
                  retire.mutate("starvation");
              }}
            >
              <Scroll className="size-4" /> Adopt a new panda
            </Button>
          </div>
          {balance < REVIVE_COST && (
            <p className="text-[11px] text-candle-muted">
              You need {REVIVE_COST - balance} more Luvies to revive — earn them by watching, playing and winning.
            </p>
          )}
        </div>
      )}

      {hasPartner && (
        <div className="rounded-2xl border border-border bg-surface/50 p-4">
          {bonded ? (
            <p className="flex items-center gap-2 text-sm text-petal">
              <Link2 className="size-4" /> Paired panda since {fmt(bonded.created_at)} — you and {partnerName ?? "your partner"} share one pet.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm">Merge pandas with {partnerName ?? "your partner"}</p>
                <p className="text-[11px] text-candle-muted">One shared panda you both feed, dress and play with.</p>
              </div>
              <Button
                variant="petal"
                disabled={bond.isPending || balance < BOND_COST}
                onClick={() => bond.mutate()}
              >
                <Link2 className="size-4" /> Pair · <LuviesAmount value={BOND_COST} />
              </Button>
            </div>
          )}
        </div>
      )}

      <div>
        <button
          onClick={() => setOpenHistory((v) => !v)}
          className="w-full rounded-2xl border border-border px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-candle-muted transition hover:border-petal/50 hover:text-petal"
        >
          Panda memorial ({memorials.length})
        </button>
        {openHistory && (
          <ul className="mt-3 space-y-2">
            {memorials.length === 0 && (
              <li className="text-center text-[11px] text-candle-muted">No past pandas — keep this one safe.</li>
            )}
            {memorials.map((m) => (
              <li key={m.id} className="rounded-2xl border border-border bg-surface/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-serif italic">{m.name}</p>
                  <span className="text-[10px] uppercase tracking-widest text-candle-muted">{m.days_lived} days</span>
                </div>
                <p className="mt-1 text-[11px] text-candle-muted">
                  {fmt(m.born_at)} — {fmt(m.died_at)} · {REASON_TEXT[m.death_reason] ?? m.death_reason}
                </p>
                <p className="mt-1 text-[11px] text-candle-muted">
                  Affection {m.affection}% · {m.interactions} moments together · {m.streak}-day streak
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
