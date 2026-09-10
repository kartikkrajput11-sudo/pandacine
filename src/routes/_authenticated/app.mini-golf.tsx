import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import {
  GOLF_H,
  GOLF_MAX_STROKES,
  GOLF_W,
  golfHoleAt,
  golfInitial,
  simulatePutt,
  type GolfState,
} from "@/lib/duo/arcade";

export const Route = createFileRoute("/_authenticated/app/mini-golf")({
  component: MiniGolf,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Mini Golf Match — PandaCine" },
      { name: "description", content: "Nine holes of drag-and-putt mini golf for two." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Finish nine holes in the fewest strokes."] },
  { heading: "Players", lines: ["2 players, alternating shots on the same hole."] },
  { heading: "Controls", lines: ["Drag back from your ball to set direction and power, then release to putt."] },
  { heading: "Course", lines: ["Each hole has a tee, a cup, walls and bumpers the ball bounces off."] },
  { heading: "Scoring", lines: [`Maximum ${GOLF_MAX_STROKES} strokes per hole; failing to hole out scores 7.`] },
  { heading: "Win", lines: ["Lowest total across the nine holes."] },
  { heading: "Tie", lines: ["A sudden-death hole decides it."] },
];

function MiniGolf() {
  const search = Route.useSearch();
  const duo = useDuoGame<GolfState>({ game: "mini-golf", search, initial: golfInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const hole = golfHoleAt(s.hole);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [anim, setAnim] = useState<{ x: number; y: number } | null>(null);

  const local = (e: React.PointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: ((e.clientX - r.left) / r.width) * GOLF_W, y: ((e.clientY - r.top) / r.height) * GOLF_H };
  };

  const advanceIfNeeded = (next: GolfState): GolfState => {
    const p0Done = next.holed[0] || next.strokes[0] >= GOLF_MAX_STROKES;
    const p1Done = next.holed[1] || next.strokes[1] >= GOLF_MAX_STROKES;
    if (!p0Done || !p1Done) return next;
    const totals: [number, number] = [
      next.totals[0] + (next.holed[0] ? next.strokes[0] : 7),
      next.totals[1] + (next.holed[1] ? next.strokes[1] : 7),
    ];
    const nextHole = next.hole + 1;
    const finishedCourse = nextHole >= 9;
    if (finishedCourse && totals[0] !== totals[1]) {
      return { ...next, totals, winner: totals[0] < totals[1] ? 0 : 1 };
    }
    const tee = golfHoleAt(nextHole).tee;
    return {
      ...next,
      hole: nextHole,
      totals,
      ball: [{ ...tee }, { ...tee }],
      strokes: [0, 0],
      holed: [false, false],
      turn: 0,
      suddenDeath: finishedCourse,
    };
  };

  const putt = () => {
    if (!drag || !myTurn || s.winner != null) return;
    const ball = s.ball[s.turn];
    const dx = ball.x - drag.x;
    const dy = ball.y - drag.y;
    const power = Math.min(Math.hypot(dx, dy), 150) / 150;
    const angle = Math.atan2(dy, dx);
    const { path, sank, end } = simulatePutt(hole, ball, angle, power);
    setDrag(null);
    let i = 0;
    const shooter = s.turn;
    const tick = window.setInterval(() => {
      setAnim(path[Math.min(i, path.length - 1)]);
      i += 4;
      if (i >= path.length) {
        window.clearInterval(tick);
        setAnim(null);
        const balls: GolfState["ball"] = [{ ...s.ball[0] }, { ...s.ball[1] }];
        balls[shooter] = end;
        const strokes: [number, number] = [s.strokes[0], s.strokes[1]];
        strokes[shooter] += 1;
        const holed: [boolean, boolean] = [s.holed[0], s.holed[1]];
        if (sank) holed[shooter] = true;
        const other = (shooter === 0 ? 1 : 0) as 0 | 1;
        const otherDone = holed[other] || strokes[other] >= GOLF_MAX_STROKES;
        const next: GolfState = {
          ...s,
          ball: balls,
          strokes,
          holed,
          turn: otherDone ? shooter : other,
        };
        duo.push(advanceIfNeeded(next));
      }
    }, 16);
  };

  const ball = anim ?? s.ball[s.turn];

  return (
    <DuoGameFrame
      game={"mini-golf" as never}
      title="Mini Golf Match"
      tagline="Nine holes, lowest score takes it."
      rules={RULES}
      duo={duo}
      onReset={duo.reset}
      status={
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm flex items-center justify-between">
          <span className={s.turn === 0 ? "text-petal font-semibold" : "text-candle-muted"}>
            P1 · {s.totals[0]} ({s.strokes[0]})
          </span>
          <span className="text-[11px] text-candle-muted">
            {s.winner != null
              ? s.winner === seat
                ? "You win."
                : "Opponent wins."
              : `${s.suddenDeath ? "Sudden death" : `Hole ${s.hole + 1}/9`} · par ${hole.par}`}
          </span>
          <span className={s.turn === 1 ? "text-petal font-semibold" : "text-candle-muted"}>
            P2 · {s.totals[1]} ({s.strokes[1]})
          </span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-border bg-surface p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${GOLF_W} ${GOLF_H}`}
          className={`w-full touch-none ${myTurn && s.winner == null ? "" : "opacity-70 pointer-events-none"}`}
          onPointerDown={(e) => setDrag(local(e))}
          onPointerMove={(e) => drag && setDrag(local(e))}
          onPointerUp={putt}
        >
          <rect x="0" y="0" width={GOLF_W} height={GOLF_H} rx="18" fill="#2f5d43" />
          <rect x="8" y="8" width={GOLF_W - 16} height={GOLF_H - 16} rx="14" fill="#3a7a55" />
          {hole.walls.map((w, i) => (
            <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} rx="5" fill="#f0e6d8" opacity="0.9" />
          ))}
          <circle cx={hole.cup.x} cy={hole.cup.y} r="11" fill="#17241d" />
          <rect x={hole.cup.x - 1} y={hole.cup.y - 34} width="2" height="26" fill="#efe4d8" />
          <path d={`M ${hole.cup.x + 1} ${hole.cup.y - 34} l 18 6 l -18 6 z`} fill="hsl(var(--petal))" />
          <circle cx={s.ball[(s.turn === 0 ? 1 : 0) as 0 | 1].x} cy={s.ball[(s.turn === 0 ? 1 : 0) as 0 | 1].y} r="6" fill="#f0c14b" opacity="0.7" />
          <circle cx={ball.x} cy={ball.y} r="7" fill="#fdfaf4" />
          {drag && <line x1={ball.x} y1={ball.y} x2={drag.x} y2={drag.y} stroke="hsl(var(--petal))" strokeWidth="3" strokeDasharray="5 5" />}
        </svg>
        <p className="text-center text-[11px] text-candle-muted mt-2">
          {myTurn ? "Drag back from your ball and release." : "Waiting for your opponent…"}
        </p>
      </div>
    </DuoGameFrame>
  );
}
