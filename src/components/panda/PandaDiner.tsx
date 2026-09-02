import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PandaCharacter } from "./PandaCharacter";
import type { Action, Costume, Emotion, PandaState } from "./usePandaBrain";
import { pandaSfx } from "@/lib/panda-sfx";
import { cn } from "@/lib/utils";

export type DinerFood = { key: string; name: string; emoji: string; qty: number };

type Piece = {
  id: number;
  key: string;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  held: boolean;
  eaten: boolean;
};

const GRAVITY = 2600; // px/s²
const REST = 0.34; // bounce
const FRICTION = 0.86;
const SIZE = 46;

/**
 * The dinner table: the panda sits behind a real table with a plate in front of
 * it. Food is a rigid body — pick it up, throw it, watch it bounce off the
 * table and roll. Drop it on the muzzle and the panda actually eats it.
 */
export function PandaDiner({
  name,
  foods,
  costume,
  wear,
  onEat,
  className,
}: {
  name: string;
  foods: DinerFood[];
  costume?: Costume;
  wear?: { outfit?: string | null; accessory?: string | null; prop?: string | null };
  /** Fired when a piece reaches the mouth. Return false to reject the bite. */
  onEat: (key: string) => void;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<number, HTMLDivElement>());
  const pieces = useRef<Piece[]>([]);
  const seq = useRef(0);
  const drag = useRef<{ id: number; px: number; py: number; t: number } | null>(null);
  const [, bump] = useState(0);

  const [emotion, setEmotion] = useState<Emotion>("hungry");
  const [action, setAction] = useState<Action>("sit");
  const [says, setSays] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<{ id: number; x: number; y: number }[]>([]);

  const state = useMemo<PandaState>(
    () => ({
      emotion,
      action,
      look: { x: 0, y: 0.25 },
      position: { x: 0, y: 0 },
      tickle: 0,
      interactions: 0,
      chaos: false,
      costume: costume ?? "classic",
      thought: null,
      hearts: 0,
      confetti: 0,
      says,
      ignoring: false,
      hunger: 0.5,
    }),
    [emotion, action, says, costume],
  );

  /* ── spawning ────────────────────────────────────────────── */

  const spawn = useCallback((food: DinerFood) => {
    const box = boxRef.current;
    if (!box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    const plateX = w * 0.5 + (Math.random() - 0.5) * w * 0.22;
    pieces.current.push({
      id: ++seq.current,
      key: food.key,
      emoji: food.emoji,
      x: plateX - SIZE / 2,
      y: h * 0.74 - SIZE,
      vx: 0,
      vy: 0,
      rot: (Math.random() - 0.5) * 30,
      vr: 0,
      held: false,
      eaten: false,
    });
    bump((n) => n + 1);
  }, []);

  // Lay the plate on load with whatever the pantry holds.
  useEffect(() => {
    if (pieces.current.length) return;
    foods.filter((f) => f.qty > 0).slice(0, 4).forEach(spawn);
    bump((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foods.length]);

  /* ── physics ─────────────────────────────────────────────── */

  useEffect(() => {
    let last = performance.now();
    let raf = 0;

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const box = boxRef.current;
      if (!box) return;
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;

      const w = box.clientWidth;
      const h = box.clientHeight;
      const tableY = h * 0.74; // table top surface
      const mouth = { x: w * 0.5, y: h * 0.44, r: Math.max(52, w * 0.11) };

      for (const p of pieces.current) {
        if (p.eaten) continue;
        if (!p.held) {
          p.vy += GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;

          // table surface
          if (p.y + SIZE > tableY) {
            p.y = tableY - SIZE;
            if (Math.abs(p.vy) > 60) {
              p.vy = -p.vy * REST;
              pandaSfx.step();
            } else {
              p.vy = 0;
            }
            p.vx *= FRICTION;
            p.vr *= FRICTION;
          }
          // side walls
          if (p.x < 4) {
            p.x = 4;
            p.vx = Math.abs(p.vx) * REST;
          }
          if (p.x + SIZE > w - 4) {
            p.x = w - 4 - SIZE;
            p.vx = -Math.abs(p.vx) * REST;
          }
        }

        // mouth check — works both when dropped in and when thrown
        const cx = p.x + SIZE / 2;
        const cy = p.y + SIZE / 2;
        if (Math.hypot(cx - mouth.x, cy - mouth.y) < mouth.r) {
          p.eaten = true;
          eat(p);
        }
      }

      pieces.current = pieces.current.filter((p) => !p.eaten);

      for (const p of pieces.current) {
        const el = nodes.current.get(p.id);
        if (el) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg)`;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eat = useCallback(
    (p: Piece) => {
      onEat(p.key);
      pandaSfx.chew();
      setAction("chew");
      setEmotion("happy");
      setSays("mmm 😋");
      const box = boxRef.current;
      if (box) {
        const w = box.clientWidth;
        const h = box.clientHeight;
        const made = Array.from({ length: 6 }, (_, i) => ({
          id: Date.now() + i,
          x: w * 0.5 + (Math.random() - 0.5) * 70,
          y: h * 0.47 + Math.random() * 20,
        }));
        setCrumbs((c) => [...c, ...made]);
        window.setTimeout(() => setCrumbs((c) => c.filter((x) => !made.some((m) => m.id === x.id))), 900);
      }
      window.setTimeout(() => {
        setAction("sit");
        setSays(null);
        setEmotion("relaxed");
      }, 2000);
      bump((n) => n + 1);
    },
    [onEat],
  );

  /* ── dragging ────────────────────────────────────────────── */

  function onPointerDown(e: React.PointerEvent, id: number) {
    const box = boxRef.current;
    const p = pieces.current.find((x) => x.id === id);
    if (!box || !p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const r = box.getBoundingClientRect();
    p.held = true;
    p.vx = 0;
    p.vy = 0;
    drag.current = { id, px: e.clientX - r.left, py: e.clientY - r.top, t: performance.now() };
    setEmotion("curious");
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const box = boxRef.current;
    if (!d || !box) return;
    const p = pieces.current.find((x) => x.id === d.id);
    if (!p) return;
    const r = box.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const dt = Math.max(0.008, (performance.now() - d.t) / 1000);
    p.vx = (x - d.px) / dt;
    p.vy = (y - d.py) / dt;
    p.x = x - SIZE / 2;
    p.y = y - SIZE / 2;
    p.rot += (x - d.px) * 0.6;
    drag.current = { id: d.id, px: x, py: y, t: performance.now() };
  }

  function release() {
    const d = drag.current;
    if (!d) return;
    const p = pieces.current.find((x) => x.id === d.id);
    if (p) {
      p.held = false;
      p.vx = Math.max(-1800, Math.min(1800, p.vx));
      p.vy = Math.max(-1800, Math.min(1800, p.vy));
      p.vr = p.vx * 0.6;
    }
    drag.current = null;
    setEmotion("hungry");
  }

  const list = pieces.current;

  return (
    <div className={cn("relative select-none overflow-hidden rounded-[2rem]", className)} ref={boxRef}>
      {/* warm dining-room light */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 50% 22%, hsl(var(--primary)/0.16), transparent 70%), linear-gradient(to bottom, hsl(var(--foreground)/0.04), hsl(var(--foreground)/0.10))",
        }}
      />

      {/* the panda, seated behind the table */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[76%] items-end justify-center">
        <PandaCharacter state={state} wear={wear} className="h-[112%] w-full max-w-[360px] translate-y-[8%]" />
      </div>

      {/* crumbs */}
      {crumbs.map((c) => (
        <span
          key={c.id}
          aria-hidden
          className="pointer-events-none absolute z-20 size-1.5 rounded-full bg-[hsl(35_45%_60%)]"
          style={{ left: c.x, top: c.y, animation: "reaction-bit-fly 0.9s ease-out forwards" }}
        />
      ))}

      {/* food pieces */}
      <div className="absolute inset-0 z-30" onPointerMove={onPointerMove} onPointerUp={release} onPointerCancel={release}>
        {list.map((p) => (
          <div
            key={p.id}
            ref={(el) => {
              if (el) nodes.current.set(p.id, el);
              else nodes.current.delete(p.id);
            }}
            onPointerDown={(e) => onPointerDown(e, p.id)}
            className="absolute left-0 top-0 grid cursor-grab place-items-center active:cursor-grabbing"
            style={{
              width: SIZE,
              height: SIZE,
              fontSize: SIZE * 0.72,
              lineHeight: 1,
              transform: `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg)`,
              filter: "drop-shadow(0 6px 8px rgba(0,0,0,.35))",
              touchAction: "none",
            }}
          >
            {p.emoji}
          </div>
        ))}
      </div>

      {/* the table — drawn in front so food rests on it */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20" style={{ top: "74%", bottom: 0 }}>
        <div
          className="h-3 w-full"
          style={{ background: "linear-gradient(to bottom, hsl(28 32% 46%), hsl(28 30% 34%))" }}
        />
        <div
          className="h-full w-full"
          style={{ background: "linear-gradient(to bottom, hsl(26 28% 24%), hsl(26 26% 14%))" }}
        />
        {/* plate */}
        <div
          className="absolute left-1/2 top-[2px] h-3 w-40 -translate-x-1/2 rounded-[100%]"
          style={{ background: "radial-gradient(60% 120% at 50% 20%, hsl(0 0% 96%), hsl(0 0% 74%))", opacity: 0.9 }}
        />
      </div>

      <p className="absolute inset-x-0 bottom-2 z-40 text-center text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        drag the food up to {name}'s mouth
      </p>
    </div>
  );
}
