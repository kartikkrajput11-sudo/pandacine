import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { HOOP_SECONDS, hoopEndTurn, hoopInitial, hoopScore, type HoopState } from "@/lib/duo/arcade";

export const Route = createFileRoute("/_authenticated/app/basketball-arcade")({
  component: Basketball,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Basketball Arcade — PandaCine" },
      { name: "description", content: "Sixty seconds each — rack up buckets and win the arcade duel." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Score more than your opponent inside your 60-second run."] },
  { heading: "Players", lines: ["2 players, one timed turn each."] },
  { heading: "Controls", lines: ["Drag down from the ball and release to set the shot power. The hoop slides, so time it."] },
  {
    heading: "Scoring",
    lines: ["Close shot 2 points, long-range shot 3 points, perfect swish adds 1 bonus point."],
  },
  { heading: "Win", lines: ["Highest score once both 60-second turns finish."] },
  { heading: "Tie", lines: ["A 30-second sudden-death round each."] },
];

const REQUIRED_MIN = 0.42;

function Basketball() {
  const search = Route.useSearch();
  const duo = useDuoGame<HoopState>({ game: "basketball-arcade", search, initial: hoopInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const [hoopX, setHoopX] = useState(160);
  const [drag, setDrag] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Hoop sweep (visual + deterministic target for both clients while shooting).
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setHoopX(160 + Math.sin(Date.now() / 900) * 95);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Countdown for the active shooter's device; the shooter owns the clock.
  useEffect(() => {
    if (!s.running || !myTurn || s.winner != null) return;
    const t = window.setInterval(() => {
      const left = s.secondsLeft - 1;
      if (left <= 0) duo.push(hoopEndTurn({ ...s, secondsLeft: 0 }));
      else duo.push({ ...s, secondsLeft: left });
    }, 1000);
    return () => window.clearInterval(t);
  }, [s, myTurn, duo]);

  const shoot = (power: number) => {
    if (!s.running || !myTurn || s.winner != null) return;
    // Deterministic: required power depends on the hoop's current distance.
    const dist = Math.abs(hoopX - 160) / 95; // 0 near, 1 far
    const required = REQUIRED_MIN + dist * 0.45;
    const err = Math.abs(power - required);
    if (err > 0.12) {
      setFlash("Miss");
      duo.push({ ...s, last: "Miss" });
      return;
    }
    const { points, label } = hoopScore(dist > 0.6, err < 0.035);
    setFlash(`${label} +${points}`);
    const scores: [number, number] = [s.scores[0], s.scores[1]];
    scores[s.turn] += points;
    duo.push({ ...s, scores, last: label });
  };

  return (
    <DuoGameFrame
      game="basketball-arcade"
      title="Basketball Arcade"
      tagline="Sixty seconds of buckets."
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
              : `${s.suddenDeath ? "Sudden death · " : ""}${s.secondsLeft}s`}
          </span>
          <span className={s.turn === 1 ? "text-petal font-semibold" : "text-candle-muted"}>P2 · {s.scores[1]}</span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-border bg-surface p-3">
        <svg
          ref={svgRef}
          viewBox="0 0 320 420"
          className={`w-full touch-none ${myTurn && s.running ? "" : "opacity-70"}`}
          onPointerDown={(e) => {
            const r = svgRef.current?.getBoundingClientRect();
            if (r) setDrag(((e.clientY - r.top) / r.height) * 420);
          }}
          onPointerMove={(e) => {
            if (drag == null) return;
            const r = svgRef.current?.getBoundingClientRect();
            if (r) setDrag(((e.clientY - r.top) / r.height) * 420);
          }}
          onPointerUp={() => {
            if (drag == null) return;
            const power = Math.min(1, Math.max(0, (drag - 240) / 150));
            setDrag(null);
            shoot(power);
          }}
        >
          <rect x="0" y="0" width="320" height="420" rx="18" fill="hsl(var(--velvet))" opacity="0.6" />
          <rect x={hoopX - 34} y="70" width="68" height="8" rx="4" fill="hsl(var(--petal))" />
          <rect x={hoopX + 30} y="40" width="8" height="46" rx="3" fill="#6b5560" />
          <path d={`M ${hoopX - 30} 78 L ${hoopX - 18} 108 L ${hoopX + 18} 108 L ${hoopX + 30} 78`} fill="none" stroke="#efe4d8" strokeWidth="2" />
          <circle cx="160" cy="360" r="18" fill="#e08a3c" />
          <path d="M 142 360 h 36 M 160 342 v 36" stroke="#7a4418" strokeWidth="2" />
          {drag != null && <line x1="160" y1="360" x2="160" y2={drag} stroke="hsl(var(--petal))" strokeWidth="3" strokeDasharray="6 6" />}
          {flash && (
            <text x="160" y="200" textAnchor="middle" fill="hsl(var(--petal))" fontSize="20">
              {flash}
            </text>
          )}
        </svg>
        {!s.running && s.winner == null && myTurn && (
          <button
            type="button"
            onClick={() => duo.push({ ...s, running: true, secondsLeft: s.suddenDeath ? 30 : HOOP_SECONDS })}
            className="mt-3 w-full py-3 rounded-full bg-petal text-white font-semibold"
          >
            Start my {s.suddenDeath ? 30 : 60}s
          </button>
        )}
        {s.running && myTurn && (
          <button
            type="button"
            onClick={() => duo.push(hoopEndTurn(s))}
            className="mt-3 w-full py-2 rounded-full border border-border text-xs"
          >
            End my turn
          </button>
        )}
      </div>
    </DuoGameFrame>
  );
}
