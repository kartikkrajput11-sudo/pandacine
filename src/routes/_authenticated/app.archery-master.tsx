import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Crosshair, RotateCcw, Volume2, VolumeX, Wind } from "lucide-react";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { Button } from "@/components/ui/button";
import { ARCHERY_CONFIG, ARCHERY_ROUNDS, ARROWS_PER_ROUND, archeryInitial, archeryPoints, archeryResolveShot, archeryShoot, archeryWind, type ArcheryShot, type ArcheryState } from "@/lib/duo/arcade";
import {
  isSfxEnabled,
  setSfxEnabled,
  sfxArcheryDraw,
  sfxArcheryImpact,
  sfxArcheryRelease,
  sfxArcheryResult,
} from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/app/archery-master")({
  component: Archery,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Archery Master — PandaCine" },
      { name: "description", content: "Aim from the shooting line, draw your bow, and compete for the gold." },
      { property: "og:title", content: "Archery Master — PandaCine" },
      { property: "og:description", content: "Aim from the shooting line, draw your bow, and compete for the gold." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const RULES = [
  { heading: "Aim", lines: ["Touch the range and drag the crosshair over the target."] },
  { heading: "Draw", lines: ["Keep holding to draw the bow. Full draw is strongest but your hand sways more."] },
  { heading: "Shoot", lines: ["Release to fire. Read the wind flag and time the sway."] },
  { heading: "Match", lines: ["Shoot 5 arrows per round for 3 rounds. Highest total wins."] },
];

const W = 760;
const H = 430;
const TARGET = { x: 565, y: 184, r: 62 };
const BOW = { x: 116, y: 314 };
type Point = { x: number; y: number };
type Flight = Point & { rotation: number; progress: number };

function Archery() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const duo = useDuoGame<ArcheryState>({ game: "archery-master", search, initial: archeryInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const holdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const aimRef = useRef<Point>({ x: 0, y: 0 });
  const powerRef = useRef(0);
  const swayRef = useRef(0);
  const winnerSoundRef = useRef<ArcheryState["winner"]>(null);
  const [aim, setAim] = useState<Point>(aimRef.current);
  const [power, setPower] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [result, setResult] = useState<{ points: number; id: number } | null>(null);
  const [soundOn, setSoundOn] = useState(() => isSfxEnabled());

  const wind = s.winds?.[Math.max(0, s.round - 1)] ?? archeryWind(s.round);
  const shotHistory = s.shots ?? [[], []];
  const arrowKey = `${s.arrows[0]}-${s.arrows[1]}-${s.turn}-${s.suddenDeath}`;
  useEffect(() => {
    aimRef.current = { x: 0, y: 0 };
    setAim(aimRef.current);
    setResult(null);
  }, [arrowKey]);

  useEffect(() => {
    if (s.winner == null || winnerSoundRef.current === s.winner) return;
    winnerSoundRef.current = s.winner;
    sfxArcheryResult(s.winner !== "draw" && s.winner === seat);
  }, [s.winner, seat]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const pointFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return aimRef.current;
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    const point = {
      x: Math.max(-1, Math.min(1, (x - TARGET.x) / 170)),
      y: Math.max(-1, Math.min(1, (TARGET.y - y) / 120)),
    };
    aimRef.current = point;
    setAim(point);
    return point;
  };

  const startAim = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!myTurn || s.winner != null || flight || drawing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointFromPointer(event);
  };

  const moveAim = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) pointFromPointer(event);
  };

  const endAim = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const startDraw = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!myTurn || s.winner != null || flight || drawing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
    setPower(0);
    powerRef.current = 0;
    holdRef.current = performance.now();
    sfxArcheryDraw();
    const loop = () => {
      const held = (performance.now() - holdRef.current) / 1000;
      const nextPower = Math.min(1, held / 1.15);
      const shake = 1.3 + nextPower * 3.6 + Math.max(0, held - 1.35) * 4;
      const nextSway = Math.sin(held * 7.2) * shake + Math.sin(held * 12.7) * shake * 0.32;
      powerRef.current = nextPower;
      swayRef.current = nextSway;
      setPower(nextPower);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drawing) return;
    setDrawing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const releasePower = Math.max(0.12, powerRef.current);
    const shotInput = { aimX: aimRef.current.x, aimY: aimRef.current.y, power: releasePower };
    const resolved = archeryResolveShot(shotInput, wind);
    const points = archeryPoints(resolved.dist);
    const shooter = s.turn;
    setPower(0);
    powerRef.current = 0;
    swayRef.current = 0;
    sfxArcheryRelease();

    let z = 0;
    let lateral = 0;
    let height = 0;
    const vz = resolved.speed * Math.cos(resolved.pitch) * Math.cos(resolved.yaw);
    let vx = resolved.speed * Math.cos(resolved.pitch) * Math.sin(resolved.yaw);
    let vy = resolved.speed * Math.sin(resolved.pitch);
    let previous = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = Math.min(0.032, (now - previous) / 1000);
      previous = now;
      vx += wind * ARCHERY_CONFIG.windAcceleration * dt;
      vy -= ARCHERY_CONFIG.gravity * dt;
      lateral += vx * dt;
      height += vy * dt;
      z += vz * dt;
      const progress = Math.min(1, z / ARCHERY_CONFIG.targetDistance);
      const perspective = 1 - progress * 0.45;
      const x = BOW.x + progress * (TARGET.x - BOW.x) + lateral * 8 * perspective;
      const y = BOW.y + progress * (TARGET.y - BOW.y) - height * 7 * perspective;
      const rotation = (Math.atan2(-(vy * 7), Math.max(1, vz * 6)) * 180) / Math.PI;
      setFlight({ x, y, rotation, progress });
      if (z < ARCHERY_CONFIG.targetDistance) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      setFlight(null);
      setResult({ points, id: Date.now() });
      window.setTimeout(() => setResult(null), 900);
      sfxArcheryImpact(points);
      duo.push(archeryShoot(s, shooter, shotInput));
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  const cancelDraw = () => {
    setDrawing(false);
    setPower(0);
    powerRef.current = 0;
    swayRef.current = 0;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSfxEnabled(next);
  };

  const crosshair = { x: TARGET.x + aim.x * 170 + (drawing ? swayRef.current : 0), y: TARGET.y - aim.y * 120 };
  const scoreText = s.winner != null
    ? s.winner === "draw" ? "Dead heat" : s.winner === seat ? "You win" : "Opponent wins"
    : s.suddenDeath ? "Sudden death" : `Round ${s.round}/${ARCHERY_ROUNDS} · Arrow ${(s.arrows[s.turn] % ARROWS_PER_ROUND) + 1}/${ARROWS_PER_ROUND}`;

  const preview = useMemo(() => {
    const resolved = archeryResolveShot({ aimX: aim.x, aimY: aim.y, power: Math.max(0.55, power) }, wind);
    return Array.from({ length: 8 }, (_, i) => {
      const t = (resolved.flightTime * 0.45 * i) / 7;
      const z = resolved.speed * Math.cos(resolved.pitch) * Math.cos(resolved.yaw) * t;
      const xw = resolved.speed * Math.cos(resolved.pitch) * Math.sin(resolved.yaw) * t + 0.5 * wind * ARCHERY_CONFIG.windAcceleration * t * t;
      const yw = resolved.speed * Math.sin(resolved.pitch) * t - 0.5 * ARCHERY_CONFIG.gravity * t * t;
      const p = z / ARCHERY_CONFIG.targetDistance;
      return `${BOW.x + p * (TARGET.x - BOW.x) + xw * 8 * (1 - p * .45)},${BOW.y + p * (TARGET.y - BOW.y) - yw * 7 * (1 - p * .45)}`;
    }).join(" ");
  }, [aim, power, wind]);

  const targetHit = (shot: ArcheryShot) => ({
    x: TARGET.x + (shot.impactX / ARCHERY_CONFIG.targetRadius) * TARGET.r,
    y: TARGET.y - (shot.impactY / ARCHERY_CONFIG.targetRadius) * TARGET.r,
  });

  return (
    <DuoGameFrame game="archery-master" title="Archery Master" tagline="Draw. Steady. Find the gold." rules={RULES} duo={duo} onReset={duo.reset}>
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-semibold">
              <div className="min-w-0"><span className={s.turn === 0 ? "text-petal" : "text-candle-muted"}>P1 · {s.scores[0]}</span><p className="truncate text-[9px] text-candle-muted">{shotHistory[0].slice(-ARROWS_PER_ROUND).map((shot) => shot.points).join(" · ") || "—"}</p></div>
              <span className="text-[10px] text-candle-muted">VS</span>
              <div className="min-w-0 text-right"><span className={s.turn === 1 ? "text-petal" : "text-candle-muted"}>P2 · {s.scores[1]}</span><p className="truncate text-[9px] text-candle-muted">{shotHistory[1].slice(-ARROWS_PER_ROUND).map((shot) => shot.points).join(" · ") || "—"}</p></div>
            </div>
            <p className="mt-1 truncate text-center text-[11px] text-candle-muted">{scoreText}</p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={toggleSound} aria-label={soundOn ? "Mute sound" : "Turn sound on"}>
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
        </header>

        <section className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-lg" aria-label="Archery range">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            role="application"
            aria-label="Drag the crosshair, hold to draw, and release to shoot"
            className={`block aspect-[16/9] w-full select-none touch-none ${myTurn && s.winner == null && !flight ? "cursor-crosshair" : "pointer-events-none opacity-80"}`}
            onPointerDown={startAim}
            onPointerMove={moveAim}
            onPointerUp={endAim}
            onPointerCancel={endAim}
          >
            <defs>
              <linearGradient id="archery-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--surface-elevated)"/><stop offset="1" stopColor="color-mix(in srgb, var(--petal) 20%, transparent)"/></linearGradient>
              <linearGradient id="archery-grass" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--sage)"/><stop offset="1" stopColor="var(--velvet)"/></linearGradient>
              <linearGradient id="archery-bow" x1="0" y1="0" x2="1" y2="0"><stop stopColor="var(--petal)"/><stop offset=".5" stopColor="var(--candle)"/><stop offset="1" stopColor="var(--petal)"/></linearGradient>
              <filter id="archery-shadow"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="var(--velvet)" floodOpacity=".4"/></filter>
            </defs>

            <rect width={W} height={H} fill="url(#archery-sky)" />
             <path d="M0 156 Q130 102 260 150 T520 132 T760 160 V238 H0Z" fill="color-mix(in srgb, var(--velvet) 72%, transparent)" />
             <path d="M0 210 Q180 184 360 210 T760 195 V430 H0Z" fill="url(#archery-grass)" />
             <path d="M70 430 L490 235M740 430 L620 235" stroke="color-mix(in srgb, var(--candle) 82%, transparent)" strokeWidth="4" />

             <g transform="translate(690 72)">
              <line y2="96" stroke="color-mix(in srgb, var(--candle) 70%, transparent)" strokeWidth="2" />
              <path d={`M0 3 q ${wind * 12} 8 ${wind * 20} 17 q ${-wind * 8} 7 ${-wind * 20} 12Z`} fill="var(--petal)" />
            </g>

            <g filter="url(#archery-shadow)">
               <rect x="493" y="112" width="144" height="150" rx="3" fill="var(--candle)" stroke="var(--velvet)" strokeWidth="4" />
               <line x1="515" y1="262" x2="500" y2="326" stroke="var(--velvet)" strokeWidth="7" />
               <line x1="615" y1="262" x2="630" y2="326" stroke="var(--velvet)" strokeWidth="7" />
              {[
                { r: 68, fill: "var(--candle)" },
                { r: 57, fill: "var(--velvet)" },
                { r: 45, fill: "var(--sky)" },
                { r: 33, fill: "var(--petal)" },
                { r: 21, fill: "var(--gold)" },
                { r: 9, fill: "var(--candle)" },
              ].map((ring) => <circle key={ring.r} cx={TARGET.x} cy={TARGET.y} r={ring.r} fill={ring.fill} stroke="color-mix(in srgb, var(--velvet) 55%, transparent)" strokeWidth="1" />)}
            </g>

             {shotHistory.flat().filter((shot) => shot.dist <= 1).slice(-12).map((shot) => {
               const hit = targetHit(shot);
               return <g key={`${shot.seat}-${shot.timestamp}`} opacity={.74}>
                 <line x1={hit.x - 20} y1={hit.y + 9} x2={hit.x} y2={hit.y} stroke="var(--candle)" strokeWidth="2.5" />
                 <circle cx={hit.x} cy={hit.y} r="3" fill="var(--velvet)" stroke="var(--petal)" />
              </g>
             })}

            <g aria-hidden="true">
               <ellipse cx="44" cy="305" rx="60" ry="70" fill="var(--velvet)" />
               <path d="M0 323 Q53 280 118 322 L154 430 H0Z" fill="var(--surface-elevated)" />
               <path d={`M118 218 Q${150 + power * 18} 300 116 402`} fill="none" stroke="url(#archery-bow)" strokeWidth="10" strokeLinecap="round" />
               <path d={`M118 218 L${118 - power * 28} 314 L116 402`} fill="none" stroke="color-mix(in srgb, var(--candle) 90%, transparent)" strokeWidth="2" />
               {!flight && <g transform={`translate(${118 - power * 28} 314) rotate(-13)`}><line x1="-12" x2="96" stroke="var(--candle)" strokeWidth="3"/><path d="M98 0 l-11 -5 v10Z" fill="var(--petal)"/></g>}
            </g>

             {!flight && <polyline points={preview} fill="none" stroke="var(--candle)" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" opacity=".38" />}

            {flight && (
               <g transform={`translate(${flight.x} ${flight.y}) rotate(${flight.rotation}) scale(${1.45 - flight.progress * .55})`}>
                <line x1="-30" x2="10" stroke="var(--candle)" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M12 0 l-9 -4 v8Z" fill="var(--petal)" />
              </g>
            )}

            {!flight && (
              <g transform={`translate(${crosshair.x} ${crosshair.y})`} className={drawing ? "animate-pulse" : ""} pointerEvents="none">
                <circle r="18" fill="none" stroke="var(--candle)" strokeWidth="5" opacity=".55" />
                <circle r="18" fill="none" stroke="var(--petal)" strokeWidth="2" />
                <circle r="3" fill="var(--petal)" />
                <path d="M-29 0h17M12 0h17M0-29v17M0 12v17" stroke="var(--petal)" strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
          </svg>

           <div className="grid gap-3 border-t border-border bg-surface-elevated px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
             <div className="min-w-0">
              <div className="flex items-center gap-3">
              <Crosshair className="size-4 shrink-0 text-petal" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-velvet/40">
                <div className="h-full rounded-full bg-petal transition-[width] duration-75" style={{ width: `${power * 100}%` }} />
              </div>
              <span className="w-14 text-right text-[10px] font-semibold uppercase text-candle-muted">{drawing ? `${Math.round(power * 100)}%` : "Ready"}</span>
            </div>
            <p className="mt-2 text-center text-[11px] text-candle-muted">
               {s.winner != null ? "Match over" : !myTurn ? "Waiting for your opponent…" : flight ? "Arrow in flight…" : drawing ? "Drawing bow… release to shoot" : "Drag on the range to aim"}
            </p>
             </div>
             <Button className="h-12 w-full select-none touch-none sm:w-40" disabled={!myTurn || s.winner != null || Boolean(flight)} onPointerDown={startDraw} onPointerUp={release} onPointerCancel={cancelDraw}>
               {drawing ? `Release · ${Math.round(power * 100)}%` : "Hold to draw"}
             </Button>
          </div>
           {result && <div key={result.id} className="pointer-events-none absolute inset-0 grid place-items-center"><div className="animate-scale-in rounded-2xl border border-border bg-surface-elevated/95 px-6 py-3 text-center shadow-xl"><p className="font-serif text-2xl italic text-petal">{result.points ? `+${result.points}` : "Miss"}</p></div></div>}
        </section>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-2 text-[11px] text-candle-muted">
           <span className="inline-flex items-center gap-1"><Wind className="size-3" /> {wind < 0 ? "←" : "→"} {Math.abs(wind).toFixed(1)} m/s</span>
          {s.last && <span>Last arrow · {s.last.points} pts</span>}
        </div>
       {s.winner != null && (
         <div className="fixed inset-0 z-40 grid place-items-center bg-velvet/80 p-5 backdrop-blur-sm">
           <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-elevated p-6 text-center shadow-2xl">
             <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Final score</p>
             <h2 className="mt-2 font-serif text-3xl italic">{s.winner === "draw" ? "Draw" : s.winner === seat ? "You win" : "Opponent wins"}</h2>
             <p className="mt-2 text-candle-muted">{s.scores[0]} — {s.scores[1]}</p>
             <div className="mt-5 grid grid-cols-2 gap-2">
               <Button onClick={duo.reset}><RotateCcw className="size-4" /> Play again</Button>
               <Button variant="outline" onClick={() => navigate({ to: "/app/play" })}>Exit</Button>
             </div>
           </div>
         </div>
       )}
      </div>
    </DuoGameFrame>
  );
}