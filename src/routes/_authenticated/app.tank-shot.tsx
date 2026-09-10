import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { TANK_X, tankFire, tankInitial, type TankState } from "@/lib/duo/arcade";

export const Route = createFileRoute("/_authenticated/app/tank-shot")({
  component: TankShot,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Tank Shot! — PandaCine" },
      { name: "description", content: "Artillery duel — angle, power, fire." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Reduce the enemy tank from 100 HP to 0."] },
  { heading: "Players", lines: ["2 players, alternating shots."] },
  { heading: "Controls", lines: ["Set the barrel angle and shot power, then fire."] },
  { heading: "Physics", lines: ["Shells follow a gravity arc and blast a crater where they land."] },
  { heading: "Damage", lines: ["Direct hits deal up to 60. Near misses deal less the further they land, nothing beyond 90 units."] },
  { heading: "Win", lines: ["Opponent's HP reaches 0."] },
  { heading: "Draw", lines: ["If one blast destroys both tanks, the duel is a draw."] },
];

const GROUND_Y = 260;

function TankShot() {
  const search = Route.useSearch();
  const duo = useDuoGame<TankState>({ game: "tank-shot", search, initial: tankInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(60);
  const [shell, setShell] = useState<{ x: number; y: number } | null>(null);

  const fire = () => {
    if (!myTurn || s.winner != null || shell) return;
    const dir = s.turn === 0 ? 1 : -1;
    const rad = (angle * Math.PI) / 180;
    const v = power / 4.2;
    let x = TANK_X[s.turn] + dir * 20;
    let y = GROUND_Y - 14;
    let vx = Math.cos(rad) * v * dir;
    let vy = -Math.sin(rad) * v;
    const path: { x: number; y: number }[] = [];
    for (let t = 0; t < 400; t++) {
      x += vx;
      y += vy;
      vy += 0.35;
      path.push({ x, y });
      if (y >= GROUND_Y - 6 || x < 0 || x > 700) break;
    }
    let i = 0;
    const tick = window.setInterval(() => {
      setShell(path[i]);
      i += 3;
      if (i >= path.length) {
        window.clearInterval(tick);
        const end = path[path.length - 1];
        setShell(null);
        duo.push(tankFire(s, s.turn, end.x, Math.min(end.y, GROUND_Y)));
      }
    }, 16);
  };

  return (
    <DuoGameFrame
      game="tank-shot"
      title="Tank Shot!"
      tagline="Angle, power, boom."
      rules={RULES}
      duo={duo}
      onReset={duo.reset}
      status={
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm flex items-center justify-between">
          <span className={s.turn === 0 ? "text-petal font-semibold" : "text-candle-muted"}>P1 · {s.hp[0]} HP</span>
          <span className="text-[11px] text-candle-muted">
            {s.winner != null
              ? s.winner === "draw"
                ? "Both tanks destroyed — draw."
                : s.winner === seat
                  ? "You win."
                  : "Opponent wins."
              : myTurn
                ? "Your shot."
                : "Incoming…"}
          </span>
          <span className={s.turn === 1 ? "text-petal font-semibold" : "text-candle-muted"}>P2 · {s.hp[1]} HP</span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-surface p-3">
        <svg viewBox="0 0 700 300" className="w-full">
          <rect x="0" y="0" width="700" height="300" fill="hsl(var(--velvet))" opacity="0.6" rx="16" />
          <rect x="0" y={GROUND_Y} width="700" height={300 - GROUND_Y} fill="#3b2f36" />
          <rect x="320" y="170" width="60" height="90" fill="#4b3a44" rx="6" />
          <rect x="200" y="215" width="40" height="45" fill="#4b3a44" rx="6" />
          <rect x="470" y="205" width="40" height="55" fill="#4b3a44" rx="6" />
          {s.craters.map((c, i) => (
            <circle key={i} cx={c.x} cy={Math.min(c.y, GROUND_Y)} r={c.r} fill="#241b20" opacity="0.8" />
          ))}
          {[0, 1].map((p) => (
            <g key={p}>
              <rect x={TANK_X[p] - 22} y={GROUND_Y - 18} width="44" height="14" rx="5" fill={p === 0 ? "hsl(var(--petal))" : "#f0c14b"} />
              <rect x={TANK_X[p] - 10} y={GROUND_Y - 26} width="20" height="10" rx="4" fill={p === 0 ? "hsl(var(--petal))" : "#f0c14b"} />
            </g>
          ))}
          {shell && <circle cx={shell.x} cy={shell.y} r="5" fill="#fff3c4" />}
        </svg>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] text-candle-muted">
            Angle · {angle}°
            <input type="range" min={5} max={85} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full accent-[hsl(var(--petal))]" />
          </label>
          <label className="text-[11px] text-candle-muted">
            Power · {power}%
            <input type="range" min={10} max={100} value={power} onChange={(e) => setPower(Number(e.target.value))} className="w-full accent-[hsl(var(--petal))]" />
          </label>
        </div>
        <button
          type="button"
          onClick={fire}
          disabled={!myTurn || s.winner != null || !!shell}
          className="mt-3 w-full py-3 rounded-full bg-petal text-white font-semibold disabled:opacity-40"
        >
          Fire
        </button>
        {s.last && (
          <p className="text-center text-[11px] text-candle-muted mt-2">
            Last shot dealt {s.last.damage} damage.
          </p>
        )}
      </div>
    </DuoGameFrame>
  );
}
