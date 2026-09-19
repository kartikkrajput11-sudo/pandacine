import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Flag, RotateCcw, Volume2, VolumeX, Waves } from "lucide-react";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { Button } from "@/components/ui/button";
import {
  GOLF_BALL_R,
  GOLF_CONFIG,
  GOLF_CUP_R,
  GOLF_H,
  GOLF_HOLES,
  GOLF_MAX_STROKES,
  GOLF_W,
  golfPutt,
  golfHoleAt,
  golfInitial,
  simulatePutt,
  type GolfPuttEventKind,
  type GolfState,
} from "@/lib/duo/arcade";
import {
  isSfxEnabled,
  setSfxEnabled,
  sfxGolfCollision,
  sfxGolfCup,
  sfxGolfPutt,
  sfxGolfResult,
  sfxGolfSand,
  sfxGolfSplash,
} from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/app/mini-golf")({
  component: MiniGolf,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Mini Golf Match — PandaCine" },
      { name: "description", content: "Nine holes of bumpers, sand and water — lowest score wins." },
      { property: "og:title", content: "Mini Golf Match — PandaCine" },
      { property: "og:description", content: "A skill-first nine-hole duel with real putting physics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Finish nine holes in the fewest strokes."] },
  { heading: "Players", lines: ["2 players, alternating shots on the same hole."] },
  {
    heading: "Controls",
    lines: [
      "Touch your ball and pull back like a putter: direction sets the line, distance sets the power.",
      "Release to putt. The guide previews only the opening line; rebounds still need judgment.",
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
type Point = { x: number; y: number };
type ActiveRoll = { seat: 0 | 1; point: Point; rotation: number };

function MiniGolf() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const duo = useDuoGame<GolfState>({ game: "mini-golf", search, initial: golfInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const hole = golfHoleAt(s.hole);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<Point | null>(null);
  const winnerSoundRef = useRef<GolfState["winner"]>(null);
  const [drag, setDrag] = useState<Point | null>(null);
  const [anim, setAnim] = useState<ActiveRoll | null>(null);
  const [trail, setTrail] = useState<Point[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [cupFlash, setCupFlash] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isSfxEnabled());

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (s.winner == null || winnerSoundRef.current === s.winner) return;
    winnerSoundRef.current = s.winner;
    sfxGolfResult(s.winner !== "draw" && s.winner === seat);
  }, [s.winner, seat]);

  const local = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: ((e.clientX - r.left) / r.width) * GOLF_W, y: ((e.clientY - r.top) / r.height) * GOLF_H };
  };

  const startDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!myTurn || s.winner != null || anim || s.holed[s.turn]) return;
    const point = local(event);
    if (!point || Math.hypot(point.x - s.ball[s.turn].x, point.y - s.ball[s.turn].y) > 42) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = point;
    setDrag(point);
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const point = local(event);
    if (!point) return;
    dragRef.current = point;
    setDrag(point);
  };

  const cancelDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDrag(null);
  };

  const playEvent = (kind: GolfPuttEventKind) => {
    if (kind === "wall") sfxGolfCollision(false);
    if (kind === "bumper" || kind === "lip") sfxGolfCollision(true);
    if (kind === "sand") sfxGolfSand();
    if (kind === "water") sfxGolfSplash();
    if (kind === "cup") sfxGolfCup();
  };

  const putt = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || !myTurn || s.winner != null || anim) return;
    const ball = s.ball[s.turn];
    const dx = ball.x - drag.x;
    const dy = ball.y - drag.y;
    const pull = Math.hypot(dx, dy);
    cancelDrag(event);
    if (pull < 8) return;
    const power = Math.min(pull, MAX_PULL) / MAX_PULL;
    const angle = Math.atan2(dy, dx);
    const result = simulatePutt(hole, ball, angle, power);
    const shooter = s.turn;
    let i = 0;
    let previous = performance.now();
    const played = new Set<number>();
    sfxGolfPutt(power);
    setNote(null);
    const step = (now: number) => {
      const elapsed = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      i = Math.min(result.path.length - 1, i + elapsed / GOLF_CONFIG.step);
      const index = Math.floor(i);
      const p = result.path[index] ?? result.end;
      const prior = result.path[Math.max(0, index - 2)] ?? p;
      const rotation = (Math.atan2(p.y - prior.y, p.x - prior.x) * 180) / Math.PI;
      setAnim({ seat: shooter, point: p, rotation });
      setTrail(result.path.slice(Math.max(0, index - 46), index + 1));
      result.events.forEach((puttEvent, eventIndex) => {
        if (puttEvent.index <= index && !played.has(eventIndex)) {
          played.add(eventIndex);
          playEvent(puttEvent.kind);
        }
      });
      if (index < result.path.length - 1) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      setAnim(null);
      setTrail([]);
      setCupFlash(result.sank);
      if (result.sank) window.setTimeout(() => setCupFlash(false), 700);
      setNote(result.splash ? "Water · returned with a penalty" : result.sank ? "In the cup" : result.lippedOut ? "Lipped out" : "Ball at rest");
      duo.push(golfPutt(s, shooter, { angle, power }));
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const activeBall = anim?.point ?? s.ball[s.turn];
  const otherIdx = (s.turn === 0 ? 1 : 0) as 0 | 1;
  const pullDist = drag ? Math.min(Math.hypot(activeBall.x - drag.x, activeBall.y - drag.y), MAX_PULL) : 0;
  const powerPct = Math.round((pullDist / MAX_PULL) * 100);
  const aimX = drag ? activeBall.x + (activeBall.x - drag.x) * 0.9 : 0;
  const aimY = drag ? activeBall.y + (activeBall.y - drag.y) * 0.9 : 0;
  const currentPatch = (hole.patches ?? []).find((patch) => activeBall.x > patch.x && activeBall.x < patch.x + patch.w && activeBall.y > patch.y && activeBall.y < patch.y + patch.h);
  const lie = currentPatch?.kind === "sand" ? "Sand" : "Green";
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSfxEnabled(next);
  };

  return (
    <DuoGameFrame
      game="mini-golf"
      title="Mini Golf Match"
      tagline="Nine holes, lowest score takes it."
      rules={RULES}
      duo={duo}
      onReset={duo.reset}
    >
      <div className="mx-auto w-full max-w-xl space-y-3">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-semibold">
            <div><span className={s.turn === 0 ? "text-petal" : "text-candle-muted"}>P1 · {s.totals[0]}</span><p className="text-[9px] text-candle-muted">Hole {s.strokes[0]} strokes</p></div>
            <div className="text-center"><p className="text-[10px] text-candle-muted">{s.suddenDeath ? "Sudden death" : `Hole ${Math.min(s.hole + 1, GOLF_HOLES.length)}/${GOLF_HOLES.length}`}</p><p className="text-[9px] text-petal">Par {hole.par}</p></div>
            <div className="text-right"><span className={s.turn === 1 ? "text-petal" : "text-candle-muted"}>P2 · {s.totals[1]}</span><p className="text-[9px] text-candle-muted">Hole {s.strokes[1]} strokes</p></div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleSound} aria-label={soundOn ? "Mute sound" : "Turn sound on"}>{soundOn ? <Volume2 /> : <VolumeX />}</Button>
        </header>

      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-lg" aria-label="Mini golf course">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${GOLF_W} ${GOLF_H}`}
          role="application"
          aria-label="Pull back from the ball and release to putt"
          className={`block aspect-[16/23] max-h-[66dvh] w-full select-none touch-none ${myTurn && s.winner == null && !anim ? "cursor-grab" : "pointer-events-none opacity-80"}`}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={putt}
          onPointerCancel={cancelDrag}
        >
          <defs>
            <radialGradient id="turf" cx="50%" cy="35%" r="80%">
              <stop offset="0%" stopColor="var(--sage)" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--sage) 58%, var(--velvet))" />
            </radialGradient>
            <pattern id="water-ripple" width="20" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 Q5 1 10 6 T20 6" fill="none" stroke="var(--candle)" strokeWidth="1" opacity=".22" /></pattern>
            <filter id="golf-shadow"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="var(--velvet)" floodOpacity=".55" /></filter>
          </defs>
          <rect x="0" y="0" width={GOLF_W} height={GOLF_H} rx="18" fill="var(--velvet)" />
          <rect x="8" y="8" width={GOLF_W - 16} height={GOLF_H - 16} rx="14" fill="url(#turf)" />
          {/* mown stripes */}
          {Array.from({ length: 11 }).map((_, i) => (
            <rect
              key={i}
              x="8"
              y={8 + i * 40}
              width={GOLF_W - 16}
              height="20"
              fill="var(--candle)"
              opacity="0.045"
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
              fill={p.kind === "sand" ? "var(--gold)" : "var(--sky)"}
              opacity={p.kind === "sand" ? 0.72 : 0.8}
            />
          ))}
          {(hole.patches ?? []).filter((p) => p.kind === "water").map((p, i) => <rect key={`r${i}`} x={p.x} y={p.y} width={p.w} height={p.h} rx="16" fill="url(#water-ripple)" />)}

          {/* walls */}
          {hole.walls.map((w, i) => (
            <g key={`w${i}`}>
              <rect x={w.x} y={w.y + 4} width={w.w} height={w.h} rx="4" fill="var(--velvet)" opacity=".45" />
              <rect x={w.x} y={w.y} width={w.w} height={w.h} rx="4" fill="var(--candle)" stroke="var(--border)" />
            </g>
          ))}

          {/* bumpers */}
          {(hole.bumpers ?? []).map((b, i) => (
            <g key={`b${i}`}>
              <circle cx={b.x} cy={b.y + 4} r={b.r} fill="var(--velvet)" opacity=".5" />
              <circle cx={b.x} cy={b.y} r={b.r} fill="var(--petal)" opacity="0.9" />
              <circle cx={b.x} cy={b.y} r={b.r * 0.55} fill="var(--candle)" opacity="0.32" />
            </g>
          ))}

          {/* cup + flag */}
          <ellipse cx={hole.cup.x} cy={hole.cup.y + 3} rx={GOLF_CUP_R + 4} ry={GOLF_CUP_R - 1} fill="var(--velvet)" opacity=".35" />
          <circle className={cupFlash ? "animate-pulse" : ""} cx={hole.cup.x} cy={hole.cup.y} r={GOLF_CUP_R} fill="var(--velvet)" stroke="var(--candle)" strokeWidth="2" />
          <rect x={hole.cup.x - 1} y={hole.cup.y - 43} width="2" height="35" fill="var(--candle)" />
          <path d={`M ${hole.cup.x + 1} ${hole.cup.y - 43} l 23 8 l -23 8 z`} fill="var(--petal)" filter="url(#golf-shadow)" />

          {/* trail */}
          {trail.length > 1 && (
            <polyline
              points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--candle)"
              strokeWidth="2"
              opacity="0.28"
            />
          )}

          {/* opponent ball */}
          {!s.holed[otherIdx] && anim?.seat !== otherIdx && <circle cx={s.ball[otherIdx].x} cy={s.ball[otherIdx].y} r={GOLF_BALL_R} fill="var(--gold)" stroke="var(--velvet)" opacity="0.9" />}

          {/* aim guide */}
          {drag && pullDist > 8 && (
            <>
              <line
                x1={activeBall.x}
                y1={activeBall.y}
                x2={drag.x}
                y2={drag.y}
                stroke="var(--candle)"
                strokeWidth="2"
                opacity="0.4"
              />
              <line
                x1={activeBall.x}
                y1={activeBall.y}
                x2={aimX}
                y2={aimY}
                stroke="var(--petal)"
                strokeWidth="3"
                strokeDasharray="6 6"
              />
            </>
          )}

          {/* active ball */}
          {!s.holed[s.turn] && <g transform={`translate(${activeBall.x} ${activeBall.y}) rotate(${anim?.rotation ?? 0})`} filter="url(#golf-shadow)"><circle cy="2" r={GOLF_BALL_R} fill="var(--velvet)" opacity=".35" /><circle r={GOLF_BALL_R} fill="var(--candle)" stroke="var(--border)" /><circle cx="-2" cy="-2" r="1.2" fill="var(--velvet)" opacity=".25" /></g>}
        </svg>

        <div className="border-t border-border bg-surface-elevated px-4 py-3">
        <div className="flex items-center gap-3"><Flag className="size-4 text-petal" /><div className="h-2 flex-1 overflow-hidden rounded-full bg-velvet/40"><div className="h-full rounded-full bg-petal transition-[width] duration-75" style={{ width: `${powerPct}%` }} /></div><span className="w-10 text-right text-[10px] font-semibold text-candle-muted">{powerPct}%</span></div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-candle-muted"><span>{lie} lie</span><span>{GOLF_MAX_STROKES - s.strokes[s.turn]} strokes left</span></div>
        <p className="mt-2 text-center text-[11px] text-candle-muted">
          {s.winner != null ? "Match over" : anim ? "Ball rolling…" : !myTurn ? "Waiting for your opponent…" : drag ? "Release to putt" : (note ?? "Pull back from your ball")}
        </p>
        </div>
      </section>
      {s.last && <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-2 text-[11px] text-candle-muted"><span className="inline-flex items-center gap-1"><Waves className="size-3" /> {s.last.splash ? "Water penalty" : s.last.sank ? "Holed" : s.last.lippedOut ? "Lipped out" : "Putt complete"}</span><span>{Math.round(s.last.power * 100)}% power</span></div>}
      </div>
      {s.winner != null && <div className="fixed inset-0 z-40 grid place-items-center bg-velvet/80 p-5 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-border bg-surface-elevated p-6 text-center shadow-2xl"><p className="text-[10px] uppercase tracking-[0.25em] text-petal">Final score</p><h2 className="mt-2 font-serif text-3xl italic">{s.winner === "draw" ? "Draw" : s.winner === seat ? "You win" : "Opponent wins"}</h2><p className="mt-2 text-candle-muted">{s.totals[0]} — {s.totals[1]}</p><div className="mt-5 grid grid-cols-2 gap-2"><Button onClick={duo.reset}><RotateCcw /> Play again</Button><Button variant="outline" onClick={() => navigate({ to: "/app/play" })}>Exit</Button></div></div></div>}
    </DuoGameFrame>
  );
}
