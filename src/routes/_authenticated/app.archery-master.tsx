import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Crosshair, Volume2, VolumeX } from "lucide-react";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { Button } from "@/components/ui/button";
import { ARROWS_PER_ROUND, archeryInitial, archeryPoints, archeryShoot, type ArcheryState } from "@/lib/duo/arcade";
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

const W = 360;
const H = 520;
const TARGET = { x: 224, y: 190, r: 68 };
const BOW = { x: 48, y: 390 };
type Point = { x: number; y: number };
type Hit = Point & { points: number; id: number };
type Flight = Point & { scale: number; rotation: number };

function Archery() {
  const search = Route.useSearch();
  const duo = useDuoGame<ArcheryState>({ game: "archery-master", search, initial: archeryInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const holdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const aimRef = useRef<Point>({ x: TARGET.x, y: TARGET.y });
  const powerRef = useRef(0);
  const swayRef = useRef(0);
  const winnerSoundRef = useRef<ArcheryState["winner"]>(null);
  const [aim, setAim] = useState<Point>(aimRef.current);
  const [power, setPower] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [sway, setSway] = useState(0);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [wind, setWind] = useState(0);
  const [soundOn, setSoundOn] = useState(() => isSfxEnabled());

  const arrowKey = `${s.arrows[0]}-${s.arrows[1]}-${s.turn}-${s.suddenDeath}`;
  useEffect(() => {
    setWind(Number(((Math.random() - 0.5) * 1.8).toFixed(1)));
    aimRef.current = { x: TARGET.x, y: TARGET.y };
    setAim(aimRef.current);
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
    const point = {
      x: Math.max(86, Math.min(340, ((event.clientX - rect.left) / rect.width) * W)),
      y: Math.max(72, Math.min(330, ((event.clientY - rect.top) / rect.height) * H)),
    };
    aimRef.current = point;
    setAim(point);
    return point;
  };

  const startDraw = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!myTurn || s.winner != null || flight || drawing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointFromPointer(event);
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
      setSway(nextSway);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const moveAim = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawing) pointFromPointer(event);
  };

  const release = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const releaseAim = pointFromPointer(event);
    setDrawing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const releasePower = Math.max(0.12, powerRef.current);
    const drop = (1 - releasePower) * 74;
    const impact = {
      x: releaseAim.x + wind * 13 + swayRef.current,
      y: releaseAim.y + drop + Math.abs(swayRef.current) * 0.35,
    };
    const dist = Math.hypot(impact.x - TARGET.x, impact.y - TARGET.y) / TARGET.r;
    const points = archeryPoints(dist);
    const shooter = s.turn;
    setPower(0);
    setSway(0);
    powerRef.current = 0;
    swayRef.current = 0;
    sfxArcheryRelease();

    const frames = 34;
    let frame = 0;
    const animate = () => {
      frame += 1;
      const t = Math.min(1, frame / frames);
      const eased = 1 - (1 - t) ** 3;
      const x = BOW.x + (impact.x - BOW.x) * eased;
      const y = BOW.y + (impact.y - BOW.y) * eased - Math.sin(Math.PI * t) * 34 * releasePower;
      const rotation = (Math.atan2(impact.y - BOW.y, impact.x - BOW.x) * 180) / Math.PI;
      setFlight({ x, y, scale: 1.7 - t * 0.85, rotation });
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      setFlight(null);
      setHits((current) => [...current.slice(-11), { ...impact, points, id: Date.now() }]);
      sfxArcheryImpact(points);
      duo.push(archeryShoot(s, shooter, dist));
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  const cancelDraw = () => {
    setDrawing(false);
    setPower(0);
    setSway(0);
    powerRef.current = 0;
    swayRef.current = 0;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSfxEnabled(next);
  };

  const crosshair = { x: aim.x + (drawing ? sway : 0), y: aim.y };
  const scoreText = s.winner != null
    ? s.winner === "draw" ? "Dead heat" : s.winner === seat ? "You win" : "Opponent wins"
    : s.suddenDeath ? "Sudden death" : `Round ${s.round}/3 · Arrow ${(s.arrows[s.turn] % ARROWS_PER_ROUND) + 1}/5`;

  return (
    <DuoGameFrame game="archery-master" title="Archery Master" tagline="Draw. Steady. Find the gold." rules={RULES} duo={duo} onReset={duo.reset}>
      <div className="mx-auto w-full max-w-md space-y-3">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span className={s.turn === 0 ? "text-petal" : "text-candle-muted"}>P1 · {s.scores[0]}</span>
              <span className={s.turn === 1 ? "text-petal" : "text-candle-muted"}>P2 · {s.scores[1]}</span>
            </div>
            <p className="mt-1 truncate text-center text-[11px] text-candle-muted">{scoreText}</p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={toggleSound} aria-label={soundOn ? "Mute sound" : "Turn sound on"}>
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
        </header>

        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-lg" aria-label="Archery range">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            role="application"
            aria-label="Drag the crosshair, hold to draw, and release to shoot"
            className={`block aspect-[9/13] w-full select-none touch-none ${myTurn && s.winner == null && !flight ? "cursor-crosshair" : "pointer-events-none opacity-80"}`}
            onPointerDown={startDraw}
            onPointerMove={moveAim}
            onPointerUp={release}
            onPointerCancel={cancelDraw}
          >
            <defs>
              <linearGradient id="archery-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--surface-elevated)"/><stop offset="1" stopColor="color-mix(in srgb, var(--petal) calc(.2 * 100%), transparent)"/></linearGradient>
              <linearGradient id="archery-grass" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--sage)"/><stop offset="1" stopColor="var(--velvet)"/></linearGradient>
              <linearGradient id="archery-bow" x1="0" y1="0" x2="1" y2="0"><stop stopColor="var(--petal)"/><stop offset=".5" stopColor="var(--candle)"/><stop offset="1" stopColor="var(--petal)"/></linearGradient>
              <filter id="archery-shadow"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="var(--velvet)" floodOpacity=".4"/></filter>
            </defs>

            <rect width={W} height={H} fill="url(#archery-sky)" />
            <path d="M0 170 Q55 118 112 160 T228 145 T360 165 V290 H0Z" fill="color-mix(in srgb, var(--velvet) calc(.72 * 100%), transparent)" />
            <path d="M0 220 Q80 198 165 214 T360 202 V520 H0Z" fill="url(#archery-grass)" />
            <path d="M0 275 Q86 252 170 269 T360 256 V293 Q258 276 171 291 T0 301Z" fill="color-mix(in srgb, var(--sage) calc(.72 * 100%), transparent)" />
            <path d="M98 520 L190 255" stroke="color-mix(in srgb, var(--candle) calc(.82 * 100%), transparent)" strokeWidth="3" />
            <path d="M338 520 L258 255" stroke="color-mix(in srgb, var(--candle) calc(.82 * 100%), transparent)" strokeWidth="3" />

            <g transform="translate(320 108)">
              <line y2="96" stroke="color-mix(in srgb, var(--candle) calc(.7 * 100%), transparent)" strokeWidth="2" />
              <path d={`M0 3 q ${wind * 12} 8 ${wind * 20} 17 q ${-wind * 8} 7 ${-wind * 20} 12Z`} fill="var(--petal)" />
            </g>

            <g filter="url(#archery-shadow)">
              <rect x="146" y="112" width="156" height="163" rx="3" fill="var(--candle)" stroke="var(--velvet)" strokeWidth="4" />
              <line x1="169" y1="275" x2="158" y2="332" stroke="var(--velvet)" strokeWidth="7" />
              <line x1="278" y1="275" x2="289" y2="332" stroke="var(--velvet)" strokeWidth="7" />
              {[
                { r: 68, fill: "var(--candle)" },
                { r: 57, fill: "var(--velvet)" },
                { r: 45, fill: "var(--sky)" },
                { r: 33, fill: "var(--petal)" },
                { r: 21, fill: "var(--gold)" },
                { r: 9, fill: "var(--candle)" },
              ].map((ring) => <circle key={ring.r} cx={TARGET.x} cy={TARGET.y} r={ring.r} fill={ring.fill} stroke="color-mix(in srgb, var(--velvet) calc(.55 * 100%), transparent)" strokeWidth="1" />)}
            </g>

            {hits.map((hit) => (
              <g key={hit.id} opacity={hit === hits[hits.length - 1] ? 1 : .68}>
                <line x1={hit.x - 18} y1={hit.y + 8} x2={hit.x} y2={hit.y} stroke="var(--candle)" strokeWidth="2.5" />
                <circle cx={hit.x} cy={hit.y} r="3" fill="var(--velvet)" stroke="var(--petal)" />
                <text x={hit.x + 6} y={hit.y - 7} fill="var(--candle)" fontSize="11" fontWeight="700">{hit.points || "MISS"}</text>
              </g>
            ))}

            <g aria-hidden="true">
              <ellipse cx="18" cy="382" rx="48" ry="56" fill="var(--velvet)" />
              <path d="M0 395 Q35 365 72 390 L103 520 H0Z" fill="var(--surface-elevated)" />
              <path d={`M62 248 Q${88 + power * 14} 334 61 476`} fill="none" stroke="url(#archery-bow)" strokeWidth="8" strokeLinecap="round" />
              <path d={`M62 248 L${62 - power * 22} 362 L61 476`} fill="none" stroke="color-mix(in srgb, var(--candle) calc(.9 * 100%), transparent)" strokeWidth="1.5" />
              {!flight && <g transform={`translate(${62 - power * 22} 362) rotate(-36)`}><line x1="-12" x2="82" stroke="var(--candle)" strokeWidth="3"/><path d="M82 0 l-10 -5 v10Z" fill="var(--petal)"/></g>}
            </g>

            {flight && (
              <g transform={`translate(${flight.x} ${flight.y}) rotate(${flight.rotation}) scale(${flight.scale})`}>
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

          <div className="border-t border-border bg-surface-elevated px-4 py-3">
            <div className="flex items-center gap-3">
              <Crosshair className="size-4 shrink-0 text-petal" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-velvet/40">
                <div className="h-full rounded-full bg-petal transition-[width] duration-75" style={{ width: `${power * 100}%` }} />
              </div>
              <span className="w-14 text-right text-[10px] font-semibold uppercase text-candle-muted">{drawing ? `${Math.round(power * 100)}%` : "Ready"}</span>
            </div>
            <p className="mt-2 text-center text-[11px] text-candle-muted">
              {s.winner != null ? "Match over" : !myTurn ? "Waiting for your opponent…" : flight ? "Arrow in flight…" : drawing ? "Steady… release to shoot" : "Drag the crosshair · hold to draw"}
            </p>
          </div>
        </section>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-2 text-[11px] text-candle-muted">
          <span>Wind {wind === 0 ? "calm" : `${wind > 0 ? "right" : "left"} ${Math.abs(wind).toFixed(1)}`}</span>
          {s.last && <span>Last arrow · {s.last.points} pts</span>}
        </div>
      </div>
    </DuoGameFrame>
  );
}