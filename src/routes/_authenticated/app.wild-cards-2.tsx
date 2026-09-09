import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import {
  WC_COLORS,
  WC_LABEL,
  wcDraw,
  wcInitial,
  wcPass,
  wcPlay,
  wcPlayable,
  wcTop,
  type WCCard,
  type WCColor,
  type WCState,
} from "@/lib/duo/wildcards";

export const Route = createFileRoute("/_authenticated/app/wild-cards-2")({
  component: WildCards,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Wild Cards 2 — PandaCine" },
      { name: "description", content: "A velvet two-player card duel — match colour or number and go out first." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Be the first to play every card in your hand."] },
  { heading: "Players", lines: ["2 players, alternating turns. You start with 7 cards each."] },
  { heading: "Controls", lines: ["Tap a playable card to play it, or tap the deck to draw."] },
  {
    heading: "Legal play",
    lines: ["Match the current colour, match the number, or play a Wild.", "Wild and Wild Draw 4 let you choose the next colour."],
  },
  {
    heading: "Action cards",
    lines: [
      "Skip and Reverse both return the turn to you in a two-player game.",
      "Draw 2 and Wild Draw 4 make your opponent draw; matching penalties can be stacked.",
    ],
  },
  { heading: "Win", lines: ["First player with an empty hand wins."] },
  { heading: "Special", lines: ["Your opponent's hand is never revealed — only its size."] },
];

const colorClass: Record<WCColor | "wild", string> = {
  red: "bg-rose-500",
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  wild: "bg-gradient-to-br from-rose-500 via-amber-400 to-sky-500",
};

function CardFace({ card, className = "" }: { card: WCCard; className?: string }) {
  const label = typeof card.value === "number" ? String(card.value) : WC_LABEL[card.value];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl text-white font-bold shadow-lg ${colorClass[card.color]} ${className}`}
    >
      {label}
    </span>
  );
}

function WildCards() {
  const search = Route.useSearch();
  const duo = useDuoGame<WCState>({ game: "wild-cards-2", search, initial: wcInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const opp = (seat === 0 ? 1 : 0) as 0 | 1;
  const [pick, setPick] = useState<string | null>(null);
  const myTurn = duo.canAct(s.turn);
  const hand = s.hands[seat];

  const playCard = (card: WCCard, chosen?: WCColor) => {
    if (!myTurn || s.winner != null) return;
    if (card.color === "wild" && !chosen) {
      setPick(card.id);
      return;
    }
    setPick(null);
    duo.push(wcPlay(s, seat, card.id, chosen));
  };

  return (
    <DuoGameFrame
      game={"wild-cards-2" as never}
      title="Wild Cards 2"
      tagline="Match the colour, dump your hand."
      rules={RULES}
      duo={duo}
      onReset={duo.reset}
      status={
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-candle flex items-center justify-between gap-3">
          <span>
            {s.winner != null
              ? s.winner === seat
                ? "You went out — you win."
                : "Your opponent went out."
              : myTurn
                ? s.pendingDraw > 0
                  ? `Stack a penalty or draw ${s.pendingDraw}.`
                  : "Your turn."
                : "Waiting for your opponent…"}
          </span>
          <span className="text-[11px] text-candle-muted">Their cards: {s.hands[opp].length}</span>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => myTurn && duo.push(wcDraw(s, seat))}
            className="w-16 h-24 rounded-xl bg-velvet border border-border text-[10px] uppercase tracking-widest text-candle-muted hover:border-petal/60"
          >
            Draw
          </button>
          <CardFace card={wcTop(s)} className="w-20 h-28 text-2xl" />
          <div className="flex flex-col items-center gap-1">
            <span className={`size-6 rounded-full ${colorClass[s.color]}`} />
            <span className="text-[10px] uppercase tracking-widest text-candle-muted">{s.color}</span>
          </div>
        </div>
        {s.message && <p className="text-center text-[11px] text-candle-muted italic">{s.message}</p>}

        {pick && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] text-candle-muted">Choose a colour:</span>
            {WC_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  const card = hand.find((h) => h.id === pick);
                  if (card) playCard(card, c);
                }}
                className={`size-8 rounded-full ${colorClass[c]}`}
                aria-label={c}
              />
            ))}
          </div>
        )}

        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-petal mb-2">Your hand</p>
          <div className="flex flex-wrap gap-2">
            {hand.map((c) => {
              const ok = myTurn && wcPlayable(s, c) && s.winner == null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => ok && playCard(c)}
                  className={`transition-transform ${ok ? "hover:-translate-y-1" : "opacity-40"}`}
                >
                  <CardFace card={c} className="w-14 h-20 text-lg" />
                </button>
              );
            })}
          </div>
          {myTurn && s.pendingDraw === 0 && (
            <button
              type="button"
              onClick={() => duo.push(wcPass(s, seat))}
              className="mt-3 px-4 py-2 rounded-full border border-border text-xs hover:border-petal/50"
            >
              Pass
            </button>
          )}
        </div>
      </div>
    </DuoGameFrame>
  );
}
