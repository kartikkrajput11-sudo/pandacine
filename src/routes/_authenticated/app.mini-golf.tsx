import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import {
  GOLF_BALL_R,
  GOLF_CUP_R,
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
      { name: "description", content: "Nine holes of bumpers, sand and water — lowest score wins." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Finish nine holes in the fewest strokes."] },
  { heading: "Players", lines: ["2 players, alternating shots on the same hole."] },
  {
    heading: "Controls",
    lines: [
      "Drag back from your ball like a slingshot: direction sets the line, distance sets the power.",
      "Release to putt. The dotted line previews your line and the meter shows power.",
    ],
  },
  {
    heading: "The course",
    lines: [
      "White rails and blocks bounce the ball.",
      "Rose bumpers kick it back harder.",
      "Sand slows the ball to a crawl; water costs a stroke and returns the ball.",
      "Roll in too fast and the ball lips out of the cup.",
    ],
  },
  { heading: "Scoring", lines: [`Maximum ${GOLF_MAX_STROKES} strokes per hole; failing to hole out scores 7.`] },
  { heading: "Win", lines: ["Lowest total across the nine holes."] },
  { heading: "Tie", lines: ["A sudden-death hole decides it."] },
];

const MAX_PULL = 130;

function MiniGolf() {
  const search = Route.useSearch();
  const duo = useDuoGame<GolfState>({ game: "mini-golf", search, initial: golfInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const hole = golfHoleAt(s.hole);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [anim, setAnim] = useState<{ x: number; y: number } | null>(null);
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

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
    if (!drag || !myTurn || s.winner != null || anim) return;
    const ball = s.ball[s.turn];
    const dx = ball.x - drag.x;
    const dy = ball.y - drag.y;
    const pull = Math.hypot(dx, dy);
    setDrag(null);
    if (pull < 8) return;
    const power = Math.min(pull, MAX_PULL) / MAX_PULL;
    const angle = Math.atan2(dy, dx);
    const { path, sank, end, splash } = simulatePutt(hole, ball, angle, power);
    const shooter = s.turn;
    let i = 0;
    const step = () => {
      const p = path[Math.min(i, path.length - 1)];
      setAnim(p);
      setTrail(path.slice(Math.max(0, i - 40), i + 1));
      i += 3;
      if (i < path.length) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      setAnim(null);
      setTrail([]);
      const balls: GolfState["ball"] = [{ ...s.ball[0] }, { ...s.ball[1] }];
      balls[shooter] = end;
      const strokes: [number, number] = [s.strokes[0], s.strokes[1]];
      strokes[shooter] += splash ? 2 : 1; // water costs a penalty stroke
      const holed: [boolean, boolean] = [s.holed[0], s.holed[1]];
      if (sank) holed[shooter] = true;
      setNote(splash ? "Splash! One-stroke penalty." : sank ? "In the cup." : null);
      const other = (shooter === 0 ? 1 : 0) as 0 | 1;
      const otherDone = holed[other] || strokes[other] >= GOLF_MAX_STROKES;
      const next: GolfState = { ...s, ball: balls, strokes, holed, turn: otherDone ? shooter : other };
      duo.push(advanceIfNeeded(next));
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const activeBall = anim ?? s.ball[s.turn];
  const otherIdx = (s.turn === 0 ? 1 : 0) as 0 | 1;
  const pullDist = drag ? Math.min(Math.hypot(activeBall.x - drag.x, activeBall.y - drag.y), MAX_PULL) : 0;
  const powerPct = Math.round((pullDist / MAX_PULL) * 100);
  const aimX = drag ? activeBall.x + (activeBall.x - drag.x) * 0.9 : 0;
  const aimY = drag ? activeBall.y + (activeBall.y - drag.y) * 0.9 : 0;

  return (
    <DuoGameFrame
      game="mini-golf"
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
          className={`w-full touch-none ${myTurn && s.winner == null && !anim ? "" : "opacity-80 pointer-events-none"}`}
          onPointerDown={(e) => setDrag(local(e))}
          onPointerMove={(e) => drag && setDrag(local(e))}
          onPointerUp={putt}
          onPointerLeave={() => setDrag(null)}
        >
          <defs>
            <radialGradient id="turf" cx="50%" cy="35%" r="80%">
              <stop offset="0%" stopColor="#478a61" />
              <stop offset="100%" stopColor="#2f6046" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={GOLF_W} height={GOLF_H} rx="18" fill="#23392c" />
          <rect x="8" y="8" width={GOLF_W - 16} height={GOLF_H - 16} rx="14" fill="url(#turf)" />
          {/* mown stripes */}
          {Array.from({ length: 11 }).map((_, i) => (
            <rect
              key={i}
              x="8"
              y={8 + i * 40}
              width={GOLF_W - 16}
              height="20"
              fill="#ffffff"
              opacity="0.035"
            />
          ))}

          {/* hazards */}
          {(hole.patches ?? []).map((p, i) => (
            <rect
              key={`p${i}`}
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx="16"
              fill={p.kind === "sand" ? "#e6d3a8" : "#3f8fc4"}
              opacity={p.kind === "sand" ? 0.9 : 0.85}
            />
          ))}

          {/* walls */}
          {hole.walls.map((w, i) => (
            <g key={`w${i}`}>
              <rect x={w.x} y={w.y + 3} width={w.w} height={w.h} rx="5" fill="#00000033" />
              <rect x={w.x} y={w.y} width={w.w} height={w.h} rx="5" fill="#f0e6d8" />
            </g>
          ))}

          {/* bumpers */}
          {(hole.bumpers ?? []).map((b, i) => (
            <g key={`b${i}`}>
              <circle cx={b.x} cy={b.y + 3} r={b.r} fill="#00000033" />
              <circle cx={b.x} cy={b.y} r={b.r} fill="hsl(var(--petal))" opacity="0.85" />
              <circle cx={b.x} cy={b.y} r={b.r * 0.55} fill="#ffffff" opacity="0.35" />
            </g>
          ))}

          {/* cup + flag */}
          <circle cx={hole.cup.x} cy={hole.cup.y} r={GOLF_CUP_R} fill="#17241d" />
          <circle cx={hole.cup.x} cy={hole.cup.y} r={GOLF_CUP_R} fill="none" stroke="#ffffff" opacity="0.25" />
          <rect x={hole.cup.x - 1} y={hole.cup.y - 38} width="2" height="30" fill="#efe4d8" />
          <path d={`M ${hole.cup.x + 1} ${hole.cup.y - 38} l 20 7 l -20 7 z`} fill="hsl(var(--petal))" />

          {/* trail */}
          {trail.length > 1 && (
            <polyline
              points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              opacity="0.28"
            />
          )}

          {/* opponent ball */}
          <circle cx={s.ball[otherIdx].x} cy={s.ball[otherIdx].y} r={GOLF_BALL_R} fill="#f0c14b" opacity="0.75" />

          {/* aim guide */}
          {drag && pullDist > 8 && (
            <>
              <line
                x1={activeBall.x}
                y1={activeBall.y}
                x2={drag.x}
                y2={drag.y}
                stroke="#ffffff"
                strokeWidth="2"
                opacity="0.4"
              />
              <line
                x1={activeBall.x}
                y1={activeBall.y}
                x2={aimX}
                y2={aimY}
                stroke="hsl(var(--petal))"
                strokeWidth="3"
                strokeDasharray="6 6"
              />
            </>
          )}

          {/* active ball */}
          <circle cx={activeBall.x} cy={activeBall.y + 2} r={GOLF_BALL_R} fill="#000" opacity="0.3" />
          <circle cx={activeBall.x} cy={activeBall.y} r={GOLF_BALL_R} fill="#fdfaf4" />
        </svg>

        <div className="mt-2 h-2 rounded-full bg-black/25 overflow-hidden">
          <div className="h-full rounded-full bg-[hsl(var(--petal))]" style={{ width: `${powerPct}%` }} />
        </div>
        <p className="text-center text-[11px] text-candle-muted mt-2">
          {s.winner != null
            ? "Match over."
            : anim
              ? "Rolling…"
              : myTurn
                ? drag
                  ? `Power ${powerPct}% · release to putt`
                  : (note ?? "Drag back from your ball and release.")
                : "Waiting for your opponent…"}
        </p>
      </div>
    </DuoGameFrame>
  );
}
