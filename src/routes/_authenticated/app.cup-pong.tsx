import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { PONG_CUPS, pongInitial, pongThrow, type PongState } from "@/lib/duo/arcade";

export const Route = createFileRoute("/_authenticated/app/cup-pong")({
  component: CupPong,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Cup Pong — PandaCine" },
      { name: "description", content: "Aim, throw, clear all ten cups before your opponent." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Sink a ball in every one of your opponent's ten cups."] },
  { heading: "Players", lines: ["2 players, alternating throws."] },
  { heading: "Controls", lines: ["Drag from the ball to aim: direction sets the line, drag length sets the power.", "Release to throw."] },
  { heading: "Scoring", lines: ["A ball landing inside a cup removes that cup. Anything else is a miss."] },
  { heading: "Physics", lines: ["Throws are fully deterministic — the same drag always lands in the same place."] },
  { heading: "Win", lines: ["First player to clear all ten opposing cups."] },
];

/** Triangular rack layout: rows of 4, 3, 2, 1. */
const RACK: { x: number; y: number }[] = (() => {
  const pts: { x: number; y: number }[] = [];
  const rows = [4, 3, 2, 1];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      pts.push({ x: 160 + (i - (n - 1) / 2) * 54, y: 70 + r * 50 });
    }
  });
  return pts;
})();

const BALL = { x: 160, y: 380 };

function CupPong() {
  const search = Route.useSearch();
  const duo = useDuoGame<PongState>({ game: "cup-pong", search, initial: pongInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const opp = (seat === 0 ? 1 : 0) as 0 | 1;
  const myTurn = duo.canAct(s.turn);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [shot, setShot] = useState<{ x: number; y: number } | null>(null);

  const toLocal = (e: React.PointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: ((e.clientX - r.left) / r.width) * 320, y: ((e.clientY - r.top) / r.height) * 440 };
  };

  const release = () => {
    if (!drag || !myTurn || s.winner != null) return;
    const dx = BALL.x - drag.x;
    const dy = BALL.y - drag.y;
    const power = Math.min(Math.hypot(dx, dy), 220) / 220;
    const angle = Math.atan2(dy, dx);
    // Deterministic flight: distance scales with power along the aim line.
    const dist = 120 + power * 340;
    const land = { x: BALL.x + Math.cos(angle) * dist, y: BALL.y + Math.sin(angle) * dist };
    setShot(land);
    setDrag(null);
    const remaining = s.cups[opp];
    const hit = remaining.find((c) => Math.hypot(RACK[c].x - land.x, RACK[c].y - land.y) < 22);
    window.setTimeout(() => {
      duo.push(pongThrow(s, s.turn, hit ?? null));
      setShot(null);
    }, 350);
  };

  return (
    <DuoGameFrame
      game={"cup-pong" as never}
      title="Cup Pong"
      tagline="Ten cups. Steady hands."
      rules={RULES}
      duo={duo}
      onReset={duo.reset}
      status={
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm flex items-center justify-between">
          <span className={s.turn === 0 ? "text-petal font-semibold" : "text-candle-muted"}>P1 cups · {s.cups[0].length}</span>
          <span className="text-[11px] text-candle-muted">
            {s.winner != null ? (s.winner === seat ? "You win." : "Opponent wins.") : myTurn ? "Drag back and release." : "Their throw…"}
          </span>
          <span className={s.turn === 1 ? "text-petal font-semibold" : "text-candle-muted"}>P2 cups · {s.cups[1].length}</span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-border bg-surface p-3">
        <svg
          ref={svgRef}
          viewBox="0 0 320 440"
          className={`w-full touch-none ${myTurn && s.winner == null ? "" : "opacity-60 pointer-events-none"}`}
          onPointerDown={(e) => setDrag(toLocal(e))}
          onPointerMove={(e) => drag && setDrag(toLocal(e))}
          onPointerUp={release}
        >
          <rect x="8" y="8" width="304" height="424" rx="20" fill="hsl(var(--velvet))" opacity="0.65" />
          {RACK.map((p, i) => {
            const alive = s.cups[opp].includes(i);
            return (
              <g key={i} opacity={alive ? 1 : 0.18}>
                <ellipse cx={p.x} cy={p.y} rx="22" ry="12" fill="#e8534a" />
                <ellipse cx={p.x} cy={p.y} rx="15" ry="7" fill="#2a1f27" />
              </g>
            );
          })}
          <circle cx={BALL.x} cy={BALL.y} r="9" fill="#f6f1e7" />
          {drag && <line x1={BALL.x} y1={BALL.y} x2={drag.x} y2={drag.y} stroke="hsl(var(--petal))" strokeWidth="3" strokeDasharray="6 6" />}
          {shot && <circle cx={shot.x} cy={shot.y} r="9" fill="hsl(var(--petal))" />}
        </svg>
        <p className="text-center text-[11px] text-candle-muted mt-2">
          Cups left for you: {s.cups[seat].length} of {PONG_CUPS}
        </p>
      </div>
    </DuoGameFrame>
  );
}
