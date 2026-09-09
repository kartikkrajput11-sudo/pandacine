import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { ARROWS_PER_ROUND, archeryInitial, archeryShoot, type ArcheryState } from "@/lib/duo/arcade";

export const Route = createFileRoute("/_authenticated/app/archery-master")({
  component: Archery,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Archery Master — PandaCine" },
      { name: "description", content: "Three rounds, five arrows each — closest to gold wins." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Score the most points over 3 rounds of 5 arrows."] },
  { heading: "Players", lines: ["2 players, alternating arrows — 15 arrows each."] },
  { heading: "Controls", lines: ["Drag the crosshair to aim horizontally and vertically, then release to loose the arrow.", "Higher draw power steadies the shot; low power drops the arrow."] },
  { heading: "Scoring", lines: ["Gold bullseye 10, then 9 down to 1 for each ring outward. Off target scores 0."] },
  { heading: "Win", lines: ["Highest total after 3 rounds."] },
  { heading: "Tie", lines: ["One sudden-death arrow each — closest to centre wins."] },
];

function Archery() {
  const search = Route.useSearch();
  const duo = useDuoGame<ArcheryState>({ game: "archery-master", search, initial: archeryInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [power, setPower] = useState(0.7);

  const move = (e: React.PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    setAim({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 });
  };

  const loose = () => {
    if (!myTurn || s.winner != null || !aim) return;
    // Low draw power drops the arrow low; full power flies true.
    const drop = (1 - power) * 0.55;
    const dist = Math.hypot(aim.x, aim.y + drop);
    duo.push(archeryShoot(s, s.turn, dist));
    setAim(null);
  };

  return (
    <DuoGameFrame
      game={"archery-master" as never}
      title="Archery Master"
      tagline="Three rounds. Fifteen arrows. Find the gold."
      rules={RULES}
      duo={duo}
      onReset={duo.reset}
      status={
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm flex items-center justify-between">
          <span className={s.turn === 0 ? "text-petal font-semibold" : "text-candle-muted"}>P1 · {s.scores[0]}</span>
          <span className="text-[11px] text-candle-muted">
            {s.winner != null
              ? s.winner === "draw"
                ? "Dead heat."
                : s.winner === seat
                  ? "You win."
                  : "Opponent wins."
              : s.suddenDeath
                ? "Sudden death arrow"
                : `Round ${s.round} · arrow ${((s.arrows[s.turn] % ARROWS_PER_ROUND) + 1)}/5`}
          </span>
          <span className={s.turn === 1 ? "text-petal font-semibold" : "text-candle-muted"}>P2 · {s.scores[1]}</span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          ref={boxRef}
          onPointerMove={move}
          onPointerDown={move}
          onPointerUp={loose}
          className={`relative rounded-full size-[min(78vw,340px)] touch-none ${myTurn && s.winner == null ? "cursor-crosshair" : "opacity-60 pointer-events-none"}`}
          style={{
            background:
              "radial-gradient(circle, #f5d76e 0 10%, #f2b705 10% 20%, #e2574c 20% 40%, #3aa0d1 40% 60%, #22202a 60% 80%, #efe9df 80% 100%)",
          }}
        >
          {aim && (
            <span
              className="absolute size-5 rounded-full border-2 border-white/90 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${((aim.x + 1) / 2) * 100}%`, top: `${((aim.y + 1) / 2) * 100}%` }}
            />
          )}
        </div>
        <label className="w-full max-w-xs text-[11px] text-candle-muted">
          Draw power · {Math.round(power * 100)}%
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.01}
            value={power}
            onChange={(e) => setPower(Number(e.target.value))}
            className="w-full accent-[hsl(var(--petal))]"
          />
        </label>
        {s.last && (
          <p className="text-[11px] text-candle-muted">
            Last arrow · {s.last.points} points
          </p>
        )}
      </div>
    </DuoGameFrame>
  );
}
