import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import {
  ARCHERY_TARGET,
  ARROWS_PER_ROUND,
  archeryInitial,
  archeryPoints,
  archeryShoot,
  simulateArrow,
  type ArcheryState,
} from "@/lib/duo/arcade";

export const Route = createFileRoute("/_authenticated/app/archery-master")({
  component: Archery,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Archery Master — PandaCine" },
      { name: "description", content: "Draw the bow, read the wind, and loose the arrow — closest to gold wins." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Score the most points over 3 rounds of 5 arrows."] },
  { heading: "Players", lines: ["2 players, alternating arrows — 15 arrows each."] },
  {
    heading: "Controls",
    lines: [
      "Hold anywhere on the range to draw the bow — the power bar fills as you hold.",
      "Move up or down while holding to set your elevation.",
      "Release to loose the arrow.",
    ],
  },
  {
    heading: "Wind & sway",
    lines: [
      "The wind flag shows drift; aim into it.",
      "Your hand sways while drawing and gets shakier at full draw — release on the steady beat.",
    ],
  },
  { heading: "Scoring", lines: ["Gold 10, then 9 down to 1 outward. Missing the boss scores 0."] },
  { heading: "Win", lines: ["Highest total after 3 rounds."] },
  { heading: "Tie", lines: ["One sudden-death arrow each — closest to centre wins."] },
];

const VB_W = 360;
const VB_H = 260;
const BOW = { x: 62, y: 168 };

function Archery() {
  const search = Route.useSearch();
  const duo = useDuoGame<ArcheryState>({ game: "archery-master", search, initial: archeryInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const holdRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const aimRef = useRef(0);
  const [aim, setAim] = useState(0); // -1 up .. 1 down
  const [power, setPower] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [sway, setSway] = useState(0);
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);
  const [hits, setHits] = useState<{ x: number; y: number; pts: number }[]>([]);
  const [wind, setWind] = useState(0);

  // A fresh crosswind for each arrow.
  const arrowKey = `${s.arrows[0]}-${s.arrows[1]}-${s.turn}`;
  useEffect(() => {
    setWind(Number(((Math.random() - 0.5) * 1.6).toFixed(2)));
  }, [arrowKey]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const pointerAim = (e: React.PointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const v = ((e.clientY - r.top) / r.height) * 2 - 1;
    const clamped = Math.max(-1, Math.min(1, v));
    aimRef.current = clamped;
    setAim(clamped);
  };

  const startDraw = (e: React.PointerEvent) => {
    if (!myTurn || s.winner != null || flight) return;
    pointerAim(e);
    setDrawing(true);
    holdRef.current = performance.now();
    const loop = () => {
      const held = (performance.now() - (holdRef.current ?? 0)) / 1000;
      const p = Math.min(1, held / 1.25);
      setPower(p);
      // Shakier the longer you hold at full draw.
      const shake = 0.045 + p * 0.075 + Math.max(0, held - 1.4) * 0.05;
      setSway(Math.sin(held * 6.2) * shake + Math.sin(held * 11.3) * shake * 0.4);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const release = () => {
    if (!drawing) return;
    setDrawing(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const p = Math.max(0.12, power);
    const finalAim = aimRef.current + sway;
    setPower(0);
    setSway(0);
    if (!myTurn || s.winner != null) return;

    const shot = simulateArrow(finalAim, p, wind);
    const shooter = s.turn;
    let i = 0;
    const step = () => {
      setFlight(shot.path[Math.min(i, shot.path.length - 1)]);
      i += 2;
      if (i < shot.path.length) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      setFlight(null);
      const pts = archeryPoints(shot.dist);
      setHits((h) => [...h.slice(-8), { x: shot.impact.x, y: shot.impact.y, pts }]);
      duo.push(archeryShoot(s, shooter, shot.dist));
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const drawPull = drawing ? power * 14 : 0;
  const aimY = BOW.y + (aim + (drawing ? sway : 0)) * 62;

  return (
    <DuoGameFrame
      game="archery-master"
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
                : `Round ${s.round}/3 · arrow ${(s.arrows[s.turn] % ARROWS_PER_ROUND) + 1}/${ARROWS_PER_ROUND}`}
          </span>
          <span className={s.turn === 1 ? "text-petal font-semibold" : "text-candle-muted"}>P2 · {s.scores[1]}</span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md space-y-3">
        <div className="rounded-3xl border border-border bg-surface p-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className={`w-full touch-none select-none ${myTurn && s.winner == null ? "cursor-crosshair" : "opacity-70 pointer-events-none"}`}
            onPointerDown={startDraw}
            onPointerMove={(e) => drawing && pointerAim(e)}
            onPointerUp={release}
            onPointerLeave={release}
          >
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1d1a2b" />
                <stop offset="100%" stopColor="#3b2f3f" />
              </linearGradient>
              <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3c6a4c" />
                <stop offset="100%" stopColor="#24422f" />
              </linearGradient>
            </defs>

            <rect x="0" y="0" width={VB_W} height={VB_H} rx="18" fill="url(#sky)" />
            <rect x="0" y="196" width={VB_W} height={VB_H - 196} fill="url(#grass)" />

            {/* wind flag */}
            <line x1="336" y1="52" x2="336" y2="196" stroke="#efe4d8" strokeWidth="2" opacity="0.5" />
            <path
              d={`M 336 54 q ${wind * 26} 10 ${wind * 34} 20 l ${-wind * 34} 6 z`}
              fill="hsl(var(--petal))"
              opacity="0.85"
            />

            {/* target boss */}
            <ellipse cx={ARCHERY_TARGET.x} cy={ARCHERY_TARGET.y + ARCHERY_TARGET.r + 12} rx="46" ry="8" fill="#000" opacity="0.3" />
            <line x1={ARCHERY_TARGET.x} y1={ARCHERY_TARGET.y} x2={ARCHERY_TARGET.x} y2="204" stroke="#6b533c" strokeWidth="6" />
            {[
              { r: 1, fill: "#efe9df" },
              { r: 0.8, fill: "#22202a" },
              { r: 0.6, fill: "#3aa0d1" },
              { r: 0.4, fill: "#e2574c" },
              { r: 0.2, fill: "#f2b705" },
              { r: 0.1, fill: "#f7e08a" },
            ].map((ring) => (
              <circle
                key={ring.r}
                cx={ARCHERY_TARGET.x}
                cy={ARCHERY_TARGET.y}
                r={ARCHERY_TARGET.r * ring.r}
                fill={ring.fill}
                stroke="#00000022"
              />
            ))}

            {/* previous arrows stuck in the boss */}
            {hits.map((h, i) => (
              <g key={i} opacity={i === hits.length - 1 ? 1 : 0.45}>
                <line x1={h.x - 16} y1={h.y - 5} x2={h.x} y2={h.y} stroke="#f3ead9" strokeWidth="2" />
                <circle cx={h.x} cy={h.y} r="2.4" fill="hsl(var(--petal))" />
              </g>
            ))}

            {/* archer + bow */}
            <g>
              <circle cx={BOW.x - 20} cy={BOW.y - 6} r="9" fill="#2b2431" />
              <rect x={BOW.x - 27} y={BOW.y + 3} width="16" height="34" rx="7" fill="#2b2431" />
              <path
                d={`M ${BOW.x} ${aimY - 34} q 22 34 0 68`}
                fill="none"
                stroke="#c8a06a"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d={`M ${BOW.x} ${aimY - 34} L ${BOW.x - drawPull} ${aimY} L ${BOW.x} ${aimY + 34}`}
                fill="none"
                stroke="#efe4d8"
                strokeWidth="1.5"
              />
              {!flight && (
                <line
                  x1={BOW.x - drawPull}
                  y1={aimY}
                  x2={BOW.x + 34}
                  y2={aimY}
                  stroke="#f3ead9"
                  strokeWidth="2"
                />
              )}
            </g>

            {/* aim guide */}
            {drawing && (
              <line
                x1={BOW.x + 34}
                y1={aimY}
                x2={ARCHERY_TARGET.x - 10}
                y2={aimY + (1 - power) * 60}
                stroke="hsl(var(--petal))"
                strokeWidth="1.2"
                strokeDasharray="4 6"
                opacity="0.6"
              />
            )}

            {/* arrow in flight */}
            {flight && (
              <line
                x1={flight.x - 18}
                y1={flight.y - 3}
                x2={flight.x}
                y2={flight.y}
                stroke="#f3ead9"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
          </svg>

          <div className="mt-2 h-2 rounded-full bg-black/25 overflow-hidden">
            <div
              className="h-full rounded-full bg-[hsl(var(--petal))] transition-[width] duration-75"
              style={{ width: `${power * 100}%` }}
            />
          </div>
          <p className="text-center text-[11px] text-candle-muted mt-2">
            {s.winner != null
              ? "Match over."
              : myTurn
                ? drawing
                  ? "Hold to draw · move to aim · release to shoot"
                  : "Press and hold the range to draw your bow"
                : "Waiting for your opponent…"}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-2 text-[11px] text-candle-muted">
          <span>Wind {wind === 0 ? "calm" : `${wind > 0 ? "down" : "up"} ${Math.abs(wind).toFixed(1)}`}</span>
          {s.last && <span>Last arrow · {s.last.points} pts</span>}
        </div>
      </div>
    </DuoGameFrame>
  );
}
