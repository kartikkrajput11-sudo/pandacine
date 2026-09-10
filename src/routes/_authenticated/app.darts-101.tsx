import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { dartsInitial, dartsThrow, scoreDart, type DartsState } from "@/lib/duo/arcade";

export const Route = createFileRoute("/_authenticated/app/darts-101")({
  component: Darts,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "101 Darts — PandaCine" },
      { name: "description", content: "Double-out darts from 101, three darts a turn." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Reduce your score from 101 to exactly 0."] },
  { heading: "Players", lines: ["2 players, three darts per turn, alternating."] },
  { heading: "Controls", lines: ["Tap the board where you want the dart to land."] },
  {
    heading: "Scoring",
    lines: ["Single = number, outer ring double = ×2, inner ring triple = ×3.", "Outer bull 25, bullseye 50, off the board 0."],
  },
  { heading: "Double out", lines: ["The winning dart must be a double or the bullseye."] },
  { heading: "Bust", lines: ["Going below 0, landing on 1, or hitting 0 without a double cancels the whole turn."] },
  { heading: "Win", lines: ["First player to finish on exactly 0 with a valid double."] },
];

function Darts() {
  const search = Route.useSearch();
  const duo = useDuoGame<DartsState>({ game: "darts-101", search, initial: dartsInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);

  const throwAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!myTurn || s.winner != null) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const dy = ((e.clientY - r.top) / r.height) * 2 - 1;
    duo.push(dartsThrow(s, s.turn, scoreDart(dx, dy)));
  };

  return (
    <DuoGameFrame
      game={"darts-101" as never}
      title="101 Darts"
      tagline="Three darts, double out."
      rules={RULES}
      duo={duo}
      onReset={duo.reset}
      status={
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm flex items-center justify-between">
          <span className={s.turn === 0 ? "text-petal font-semibold" : "text-candle-muted"}>P1 · {s.scores[0]}</span>
          <span className="text-[11px] text-candle-muted">
            {s.winner != null ? (s.winner === seat ? "You win." : "Opponent wins.") : myTurn ? `Dart ${s.darts.length + 1} of 3` : "Their turn…"}
          </span>
          <span className={s.turn === 1 ? "text-petal font-semibold" : "text-candle-muted"}>P2 · {s.scores[1]}</span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          onClick={throwAt}
          className={`relative rounded-full size-[min(78vw,360px)] cursor-crosshair ${myTurn && s.winner == null ? "" : "opacity-60 pointer-events-none"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(var(--petal)) 0 6%, #f8e3b0 6% 13%, #2b2028 13% 62%, hsl(var(--petal)/0.9) 62% 70%, #2b2028 70% 92%, #f8e3b0 92% 100%)",
            boxShadow: "0 20px 60px -20px rgba(0,0,0,0.7)",
          }}
        >
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 origin-top w-px h-1/2 bg-black/25"
              style={{ transform: `rotate(${i * 18 + 9}deg)` }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`px-3 py-1 rounded-full text-[11px] border ${
                s.darts[i] ? "border-petal text-petal" : "border-border text-candle-muted"
              }`}
            >
              {s.darts[i] ? `${s.darts[i].label} · ${s.darts[i].value}` : `Dart ${i + 1}`}
            </span>
          ))}
        </div>
        <ul className="text-[11px] text-candle-muted space-y-1 max-h-28 overflow-y-auto">
          {s.log.slice(0, 6).map((l, i) => (
            <li key={i}>· {l}</li>
          ))}
        </ul>
      </div>
    </DuoGameFrame>
  );
}
