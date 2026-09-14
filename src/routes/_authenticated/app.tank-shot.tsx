import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Crosshair, Pause, RotateCcw, Settings2, Volume2, VolumeX, X } from "lucide-react";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { GameBackLink } from "@/components/games/GameBackLink";
import { AvatarImg } from "@/components/AvatarImg";
import { Button } from "@/components/ui/button";
import { TANK_X, tankFire, tankInitial, type TankState } from "@/lib/duo/arcade";
import { isSfxEnabled, setSfxEnabled, sfxTankFire, sfxTankImpact } from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/app/tank-shot")({
  component: TankShot,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Tank Shot! — PandaCine" },
      { name: "description", content: "A playful two-player artillery duel with angle, power and polished physics." },
      { property: "og:title", content: "Tank Shot! — PandaCine" },
      { property: "og:description", content: "A playful two-player artillery duel with angle, power and polished physics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const RULES = [
  { heading: "01 · Aim", lines: ["Touch the battlefield and drag the target to aim."] },
  { heading: "02 · Power", lines: ["Drag farther from your tank for a stronger shot."] },
  { heading: "03 · Fire", lines: ["Release your finger to fire immediately."] },
  { heading: "04 · Hit", lines: ["Reduce the other tank from 100 health to zero."] },
];

const GROUND_Y = 260;
const SVG_W = 700;
type Point = { x: number; y: number };
type Impact = Point & { damage: number; id: number };
type Aim = { angle: number; power: number };

function flightPath(turn: 0 | 1, angle: number, power: number) {
  const dir = turn === 0 ? 1 : -1;
  const rad = (angle * Math.PI) / 180;
  const speed = power / 4.2;
  let x = TANK_X[turn] + dir * 20;
  let y = GROUND_Y - 20;
  const vx = Math.cos(rad) * speed * dir;
  let vy = -Math.sin(rad) * speed;
  const path: Point[] = [];
  for (let t = 0; t < 400; t++) {
    x += vx;
    y += vy;
    vy += 0.35;
    path.push({ x, y });
    if (y >= GROUND_Y - 6 || x < 0 || x > SVG_W) break;
  }
  return path;
}

function TankShot() {
  const search = Route.useSearch();
  const duo = useDuoGame<TankState>({ game: "tank-shot", search, initial: tankInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const myTurn = duo.canAct(s.turn);
  const [aims, setAims] = useState<[Aim, Aim]>([
    { angle: 45, power: 60 },
    { angle: 45, power: 60 },
  ]);
  const [aimTarget, setAimTarget] = useState<Point | null>(null);
  const [isAiming, setIsAiming] = useState(false);
  const [shell, setShell] = useState<Point | null>(null);
  const [trail, setTrail] = useState<Point[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [recoil, setRecoil] = useState<0 | 1 | null>(null);
  const [paused, setPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isSfxEnabled());
  const [countdown, setCountdown] = useState<string | null>("3");
  const [turnFlash, setTurnFlash] = useState(true);
  const timerRef = useRef<number | null>(null);
  const lastTurnRef = useRef(s.turn);

  useEffect(() => {
    const steps = ["3", "2", "1", "FIRE!"];
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= steps.length) {
        window.clearInterval(timer);
        setCountdown(null);
      } else setCountdown(steps[index]);
    }, 520);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (lastTurnRef.current === s.turn) return;
    lastTurnRef.current = s.turn;
    setTurnFlash(true);
    const timer = window.setTimeout(() => setTurnFlash(false), 1100);
    return () => window.clearTimeout(timer);
  }, [s.turn]);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
  }, []);

  const activeAim = aims[s.turn];
  const preview = useMemo(
    () => flightPath(s.turn, activeAim.angle, activeAim.power).filter((_, i) => i % 8 === 0).slice(0, 18),
    [s.turn, activeAim.angle, activeAim.power],
  );
  const opponentName = duo.partner?.display_name ?? "Opponent";
  const playerName = duo.me?.display_name ?? "You";

  const fire = (aim: Aim) => {
    if (!myTurn || s.winner != null || shell || paused || countdown) return;
    const firingSeat = s.turn;
    const path = flightPath(firingSeat, aim.angle, aim.power);
    if (!path.length) return;
    setRecoil(firingSeat);
    setTrail([]);
    sfxTankFire();
    window.setTimeout(() => setRecoil(null), 280);
    let i = 0;
    timerRef.current = window.setInterval(() => {
      const point = path[i];
      if (point) {
        setShell(point);
        setTrail((old) => [...old.slice(-7), point]);
      }
      i += 3;
      if (i < path.length) return;
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      const end = path[path.length - 1];
      if (!end) return;
      const next = tankFire(s, firingSeat, end.x, Math.min(end.y, GROUND_Y));
      const damage = next.last?.damage ?? 0;
      setShell(null);
      setImpact({ x: end.x, y: Math.min(end.y, GROUND_Y), damage, id: Date.now() });
      sfxTankImpact(damage > 0);
      window.setTimeout(() => setImpact(null), 850);
      duo.push(next);
    }, 16);
  };

  const aimFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * SVG_W,
      y: ((event.clientY - rect.top) / rect.height) * 360,
    };
    const direction = s.turn === 0 ? 1 : -1;
    const forward = Math.max(18, direction * (point.x - TANK_X[s.turn]));
    const rise = Math.max(8, GROUND_Y - 30 - point.y);
    const angle = Math.round(Math.min(85, Math.max(5, (Math.atan2(rise, forward) * 180) / Math.PI)));
    const distance = Math.hypot(forward, rise);
    const power = Math.round(Math.min(100, Math.max(10, 10 + (distance / 430) * 90)));
    const nextAim = { angle, power };
    setAims((current) => {
      const next: [Aim, Aim] = [{ ...current[0] }, { ...current[1] }];
      next[s.turn] = nextAim;
      return next;
    });
    setAimTarget(point);
    return nextAim;
  };

  const startAiming = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!myTurn || s.winner != null || shell || paused || countdown) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsAiming(true);
    aimFromPointer(event);
  };

  const moveAim = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!isAiming) return;
    aimFromPointer(event);
  };

  const releaseAim = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!isAiming) return;
    const releasedAim = aimFromPointer(event);
    setIsAiming(false);
    setAimTarget(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    fire(releasedAim);
  };

  const cancelAim = () => {
    setIsAiming(false);
    setAimTarget(null);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSfxEnabled(next);
  };

  return (
    <DuoGameFrame game="tank-shot" title="Tank Shot!" tagline="Angle, power, boom." rules={RULES} duo={duo} onReset={duo.reset} immersive>
      <main className="tank-game" aria-label="Tank Shot game">
        <div className="tank-topbar">
          <GameBackLink className="tank-icon-button" aria-label="Back to games"><ArrowLeft /></GameBackLink>
          <div className="tank-title"><span>DUO BATTLE</span><strong>Tank Shot</strong></div>
          <Button variant="ghost" size="icon" className="tank-icon-button" onClick={() => setPaused(true)} aria-label="Pause game"><Pause /></Button>
        </div>

        <PlayerHud
          left={{ name: playerName, avatar: duo.me?.avatar_url, hp: s.hp[seat] }}
          right={{ name: duo.mode === "local" ? `Player ${seat === 0 ? 2 : 1}` : opponentName, avatar: duo.partner?.avatar_url, hp: s.hp[seat === 0 ? 1 : 0] }}
          myTurn={myTurn}
          activeSide={s.turn === seat ? "left" : "right"}
        />

        <section className={`tank-battlefield ${impact ? (impact.damage > 0 ? "is-hit" : "is-impact") : ""}`}>
          <svg
            viewBox="0 0 700 360"
            role="application"
            aria-label="Drag across the battlefield and release to fire"
            className={isAiming ? "is-aiming" : ""}
            onPointerDown={startAiming}
            onPointerMove={moveAim}
            onPointerUp={releaseAim}
            onPointerCancel={cancelAim}
          >
            <defs>
              <linearGradient id="tankSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="tank-sky-top" /><stop offset="1" className="tank-sky-bottom" />
              </linearGradient>
              <linearGradient id="tankGround" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="tank-grass" /><stop offset="1" className="tank-soil" />
              </linearGradient>
              <filter id="softBlur"><feGaussianBlur stdDeviation="7" /></filter>
            </defs>
            <rect width="700" height="360" fill="url(#tankSky)" />
            <circle cx="570" cy="64" r="29" className="tank-sun" />
            <g className="tank-clouds" fill="currentColor">
              <path d="M70 77c8-22 40-20 45 2 17-7 36 4 37 21H47c1-14 10-23 23-23Z" />
              <path d="M480 108c7-18 33-17 38 2 15-6 30 3 31 17h-88c1-11 8-18 19-19Z" />
            </g>
            <path d="M0 190 Q95 116 205 181 T420 167 T700 180 V360 H0Z" className="tank-hills-far" />
            <path d="M0 225 Q120 160 245 218 T470 206 T700 215 V360 H0Z" className="tank-hills-near" />
            <path d="M0 278 Q95 240 191 273 T375 252 T540 272 T700 252 V360 H0Z" fill="url(#tankGround)" />
            <path d="M0 287 Q160 260 312 282 T700 268" className="tank-ground-highlight" />
            {s.craters.map((c, i) => <ellipse key={`${c.x}-${i}`} cx={c.x} cy={Math.min(c.y, GROUND_Y) + 16} rx={c.r + 5} ry={c.r / 2.5} className="tank-crater" />)}
            {!shell && myTurn && !paused && !countdown && isAiming && preview.map((p, i) => (
              <circle key={`${p.x}-${i}`} cx={p.x} cy={p.y} r={Math.max(1.5, 3.4 - i * 0.12)} className="tank-trajectory" style={{ opacity: Math.max(0.12, 0.75 - i * 0.035) }} />
            ))}
            {aimTarget && isAiming && <g className="tank-aim-target" transform={`translate(${aimTarget.x} ${aimTarget.y})`}><circle r="20" /><circle r="7" /><path d="M-29 0h18M11 0h18M0-29v18M0 11v18" /></g>}
            <TankSvg seat={0} angle={aims[0].angle} active={s.turn === 0} recoil={recoil === 0} hit={Boolean(impact?.damage && Math.abs(impact.x - TANK_X[0]) < 90)} />
            <TankSvg seat={1} angle={aims[1].angle} active={s.turn === 1} recoil={recoil === 1} hit={Boolean(impact?.damage && Math.abs(impact.x - TANK_X[1]) < 90)} />
            {trail.map((p, i) => <circle key={`${p.x}-${i}`} cx={p.x} cy={p.y} r={1.5 + i * 0.28} className="tank-shell-trail" style={{ opacity: (i + 1) / trail.length }} />)}
            {shell && <g className="tank-shell"><path d={`M${shell.x - 11} ${shell.y + 4}l-13 4 9-10Z`} /><circle cx={shell.x} cy={shell.y} r="5" /></g>}
            {recoil != null && <g className="tank-muzzle" transform={`translate(${TANK_X[recoil] + (recoil === 0 ? 44 : -44)} 230)`}><circle r="12" /><circle r="5" /></g>}
            {impact && <ImpactFx impact={impact} />}
          </svg>

          <div className={`tank-turn-pill ${turnFlash ? "is-entering" : ""}`}>
            <span />{s.winner != null ? "Match complete" : myTurn ? "Your turn" : "Opponent’s turn"}
          </div>

          {countdown && <div className="tank-countdown"><strong key={countdown}>{countdown}</strong></div>}
          {s.winner != null && <ResultOverlay winner={s.winner} seat={seat} hp={s.hp} onReset={duo.reset} />}
        </section>

        <section className={`tank-drag-guide ${isAiming ? "is-aiming" : ""}`} aria-live="polite">
          <Crosshair />
          <div><strong>{isAiming ? `${activeAim.angle}° · ${activeAim.power}% power` : myTurn ? "Drag target to aim" : "Waiting for opponent"}</strong><span>{isAiming ? "Release to fire" : "Aim directly on the battlefield"}</span></div>
        </section>

        {s.last && <p className="tank-last-shot">Last shot · {s.last.damage > 0 ? `${s.last.damage} damage` : "near miss"}</p>}

        {(paused || showRules) && (
          <div className="tank-sheet-backdrop" onClick={() => { setPaused(false); setShowRules(false); }}>
            <section className="tank-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="tank-sheet-handle" />
              <div className="tank-sheet-heading"><div><span>{showRules ? "Quick guide" : "Game paused"}</span><h2>{showRules ? "How to play" : "Take a breath"}</h2></div><Button variant="ghost" size="icon" onClick={() => { setPaused(false); setShowRules(false); }}><X /></Button></div>
              {showRules ? <RulesContent /> : <div className="tank-pause-actions">
                <Button variant="petal" size="block" onClick={() => setPaused(false)}>Resume game</Button>
                <Button variant="quiet" size="block" onClick={toggleSound}>{soundOn ? <Volume2 /> : <VolumeX />}{soundOn ? "Sound on" : "Sound off"}</Button>
                <Button variant="quiet" size="block" onClick={() => setShowRules(true)}><BookOpen />How to play</Button>
                <Button variant="quiet" size="block" onClick={duo.reset}><RotateCcw />Restart match</Button>
                <Button variant="ghost" size="block" asChild><Link to="/app/play">Exit to Play</Link></Button>
              </div>}
            </section>
          </div>
        )}
        <div className="tank-landscape"><Settings2 /><strong>Rotate your phone</strong><span>Please return to portrait mode.</span></div>
      </main>
    </DuoGameFrame>
  );
}

function PlayerHud({ left, right, myTurn, activeSide }: { left: { name: string; avatar?: string | null; hp: number }; right: { name: string; avatar?: string | null; hp: number }; myTurn: boolean; activeSide: "left" | "right" }) {
  return <section className="tank-hud">
    <HudPlayer {...left} side="left" active={activeSide === "left"} />
    <div className="tank-vs"><span>{myTurn ? "YOUR TURN" : "WAIT"}</span><b>VS</b></div>
    <HudPlayer {...right} side="right" active={activeSide === "right"} />
  </section>;
}

function HudPlayer({ name, avatar, hp, side, active }: { name: string; avatar?: string | null; hp: number; side: "left" | "right"; active: boolean }) {
  return <div className={`tank-player ${side} ${active ? "is-active" : ""}`}>
    <div className="tank-avatar">{avatar ? <AvatarImg src={avatar} alt={name} /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div>
    <div className="tank-player-meta"><div><strong>{name}</strong><span>{hp} HP</span></div><div className="tank-health"><i style={{ width: `${hp}%` }} /><b style={{ width: `${hp}%` }} /></div></div>
  </div>;
}

function TankSvg({ seat, angle, active, recoil, hit }: { seat: 0 | 1; angle: number; active: boolean; recoil: boolean; hit: boolean }) {
  const x = TANK_X[seat];
  const flip = seat === 1 ? -1 : 1;
  return <g transform={`translate(${x} 258) scale(${flip} 1)`} className={`tank-character tank-${seat} ${active ? "is-active" : ""} ${hit ? "is-hit" : ""}`}>
    <ellipse cx="0" cy="9" rx="39" ry="8" className="tank-shadow" />
    <g className="tank-idle">
      <rect x="-31" y="-13" width="62" height="20" rx="10" className="tank-track" />
      {[-21, -7, 7, 21].map((wheel) => <circle key={wheel} cx={wheel} cy="-3" r="7" className="tank-wheel" />)}
      <path d="M-25-19Q-19-34 2-34H22Q31-34 34-18L28-8H-29Z" className="tank-body" />
      <path d="M-15-31Q-9-46 9-46Q24-46 27-32Z" className="tank-turret" />
      <circle cx="5" cy="-34" r="4" className="tank-highlight" />
      <g className={recoil ? "tank-barrel is-recoil" : "tank-barrel"} style={{ transform: `rotate(${-angle}deg)`, transformOrigin: "7px -36px" }}>
        <rect x="5" y="-41" width="43" height="9" rx="4.5" className="tank-cannon" />
        <rect x="42" y="-43" width="10" height="13" rx="4" className="tank-cannon-tip" />
      </g>
    </g>
  </g>;
}

function ImpactFx({ impact }: { impact: Impact }) {
  return <g key={impact.id} transform={`translate(${impact.x} ${impact.y})`} className="tank-impact-fx">
    <circle r="20" className="tank-impact-ring" />
    {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={Math.cos(i) * 18} cy={Math.sin(i) * 12 - 7} r={i % 2 ? 3 : 4} className="tank-impact-particle" />)}
    {impact.damage > 0 && <text y="-40" textAnchor="middle">−{impact.damage}</text>}
  </g>;
}

function ResultOverlay({ winner, seat, hp, onReset }: { winner: 0 | 1 | "draw"; seat: 0 | 1; hp: [number, number]; onReset: () => void }) {
  const won = winner === seat;
  return <div className="tank-result">
    <span>{winner === "draw" ? "Perfectly matched" : won ? "Perfect shot" : "Next round is yours"}</span>
    <h2>{winner === "draw" ? "Draw" : won ? "You win" : "You lose"}</h2>
    <div><p><small>Your health</small><strong>{hp[seat]}</strong></p><i /><p><small>Opponent</small><strong>{hp[seat === 0 ? 1 : 0]}</strong></p></div>
    <Button variant="petal" size="block" onClick={onReset}><RotateCcw />Rematch</Button>
    <Button variant="ghost" size="block" asChild><Link to="/app/play">Back to games</Link></Button>
  </div>;
}

function RulesContent() {
  return <div className="tank-rules">{RULES.map((rule, i) => <article key={rule.heading}><b>0{i + 1}</b><div><strong>{rule.heading.split(" · ")[1]}</strong><p>{rule.lines[0]}</p></div></article>)}<Button variant="petal" size="block" onClick={() => document.querySelector<HTMLButtonElement>(".tank-sheet-heading button")?.click()}>Got it</Button></div>;
}