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
  /** set while the bite animation carries the piece to the mouth */
  flight: { t: number; dur: number; x0: number; y0: number; r0: number } | null;
  scale: number;
};

const GRAVITY = 2600; // px/s²
const REST = 0.34; // bounce
const FRICTION = 0.86;
const SIZE = 46;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The dinner table: pick a dish from the pantry rail and it lands on the plate.
 * Tap the plate and the panda eats everything on it, one bite at a time — the
 * food arcs up to the muzzle, the jaw chews, crumbs fly. Pieces can still be
 * dragged and thrown; they're rigid bodies until they reach the mouth.
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
  /** Fired when a piece reaches the mouth. */
  onEat: (key: string) => void;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<number, HTMLDivElement>());
  const pieces = useRef<Piece[]>([]);
  const seq = useRef(0);
  const drag = useRef<{ id: number; px: number; py: number; t: number } | null>(null);
  const biting = useRef(false);
  const [, bump] = useState(0);

  const [emotion, setEmotion] = useState<Emotion>("hungry");
  const [action, setAction] = useState<Action>("sit");
  const [says, setSays] = useState<string | null>(null);
  const [plateHit, setPlateHit] = useState(0);
  const [crumbs, setCrumbs] = useState<{ id: number; x: number; y: number }[]>([]);
  /** how many of each key are currently plated (not yet eaten) */
  const [plated, setPlated] = useState<Record<string, number>>({});

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

  const available = useCallback(
    (f: DinerFood) => Math.max(0, f.qty - (plated[f.key] ?? 0)),
    [plated],
  );

  /* ── plating ─────────────────────────────────────────────── */

  const plate = useCallback((food: DinerFood) => {
    const box = boxRef.current;
    if (!box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    const n = pieces.current.length;
    const plateX = w * 0.5 + ((n % 4) - 1.5) * 26 + (Math.random() - 0.5) * 8;
    pieces.current.push({
      id: ++seq.current,
      key: food.key,
      emoji: food.emoji,
      x: plateX - SIZE / 2,
      y: h * 0.52,
      vx: (Math.random() - 0.5) * 60,
      vy: 0,
      rot: (Math.random() - 0.5) * 40,
      vr: (Math.random() - 0.5) * 120,
      held: false,
      eaten: false,
      flight: null,
      scale: 1,
    });
    setPlated((p) => ({ ...p, [food.key]: (p[food.key] ?? 0) + 1 }));
    pandaSfx.pop();
    setEmotion("curious");
    bump((n2) => n2 + 1);
  }, []);

  /* ── biting ──────────────────────────────────────────────── */

  const startBite = useCallback(() => {
    if (biting.current) return;
    const ready = pieces.current.filter((p) => !p.eaten && !p.held && !p.flight);
    if (!ready.length) {
      setSays("plate's empty 🥺");
      setEmotion("hungry");
      window.setTimeout(() => setSays(null), 1400);
      return;
    }
    biting.current = true;
    setPlateHit((n) => n + 1);
    setEmotion("excited");
    ready.forEach((p, i) => {
      window.setTimeout(() => {
        if (p.eaten) return;
        p.held = false;
        p.flight = { t: 0, dur: 0.5, x0: p.x, y0: p.y, r0: p.rot };
        setAction("chew");
        pandaSfx.squeak();
      }, i * 620);
    });
    window.setTimeout(
      () => {
        biting.current = false;
      },
      ready.length * 620 + 700,
    );
  }, []);

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

        if (p.flight) {
          // guided arc into the muzzle
          p.flight.t += dt;
          const k = Math.min(1, p.flight.t / p.flight.dur);
          const e = easeInOut(k);
          const tx = mouth.x - SIZE / 2;
          const ty = mouth.y - SIZE / 2;
          const lift = Math.sin(Math.PI * k) * (h * 0.14);
          p.x = p.flight.x0 + (tx - p.flight.x0) * e;
          p.y = p.flight.y0 + (ty - p.flight.y0) * e - lift;
          p.rot = p.flight.r0 + 420 * e;
          p.scale = 1 - 0.55 * e;
          if (k >= 1) {
            p.eaten = true;
            eat(p);
          }
          continue;
        }

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

        // manual mouth hit — dropping or throwing food at the muzzle still works
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
        if (el)
          el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg) scale(${p.scale})`;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eat = useCallback(
    (p: Piece) => {
      onEat(p.key);
      setPlated((s) => {
        const left = (s[p.key] ?? 1) - 1;
        const next = { ...s };
        if (left > 0) next[p.key] = left;
        else delete next[p.key];
        return next;
      });
      pandaSfx.chew();
      setAction("chew");
      setEmotion("happy");
      setSays("mmm 😋");
      const box = boxRef.current;
      if (box) {
        const w = box.clientWidth;
        const h = box.clientHeight;
        const made = Array.from({ length: 8 }, (_, i) => ({
          id: Date.now() + i,
          x: w * 0.5 + (Math.random() - 0.5) * 80,
          y: h * 0.46 + Math.random() * 24,
        }));
        setCrumbs((c) => [...c, ...made]);
        window.setTimeout(() => setCrumbs((c) => c.filter((x) => !made.some((m) => m.id === x.id))), 900);
      }
      window.setTimeout(() => {
        if (biting.current) return;
        setAction("sit");
        setSays(null);
        setEmotion("relaxed");
      }, 1800);
      bump((n) => n + 1);
    },
    [onEat],
  );

  /* ── dragging ────────────────────────────────────────────── */

  function onPointerDown(e: React.PointerEvent, id: number) {
    const box = boxRef.current;
    const p = pieces.current.find((x) => x.id === id);
    if (!box || !p || p.flight) return;
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
  const onPlate = list.length;
  const pantry = foods.filter((f) => f.qty > 0);

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
              transform: `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg) scale(${p.scale})`,
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
      </div>

      {/* the plate — tap to make the panda eat */}
      <button
        type="button"
        onClick={startBite}
        aria-label={onPlate ? `Feed ${name} — ${onPlate} on the plate` : "The plate is empty"}
        className="absolute left-1/2 z-40 h-8 w-44 -translate-x-1/2 rounded-[100%] outline-none transition-transform duration-200 hover:scale-105 active:scale-95"
        style={{ top: "calc(74% - 6px)" }}
      >
        <span
          key={plateHit}
          aria-hidden
          className="absolute inset-0 rounded-[100%]"
          style={{
            background: "radial-gradient(60% 120% at 50% 20%, hsl(0 0% 97%), hsl(0 0% 72%))",
            boxShadow: onPlate
              ? "0 0 0 2px hsl(var(--primary)/0.45), 0 10px 22px -10px hsl(var(--primary)/0.7)"
              : "0 6px 16px -10px rgba(0,0,0,.6)",
            animation: plateHit ? "scale-in 0.25s ease-out" : undefined,
          }}
        />
        {onPlate > 0 && (
          <span
            aria-hidden
            className="pulse absolute inset-0 rounded-[100%] ring-2 ring-primary/30"
          />
        )}
      </button>

      {/* pantry rail — tap a dish to serve it onto the plate */}
      <div className="absolute inset-x-0 bottom-9 z-40 flex justify-center px-3">
        <div className="flex max-w-full gap-2 overflow-x-auto rounded-full bg-background/70 px-2.5 py-2 shadow-[0_10px_30px_-14px_rgba(0,0,0,.7),0_0_0_1px_hsl(var(--foreground)/0.07)] backdrop-blur-xl [scrollbar-width:none]">
          {pantry.length === 0 && (
            <span className="px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              pantry empty
            </span>
          )}
          {pantry.map((f) => {
            const left = available(f);
            return (
              <button
                key={f.key}
                type="button"
                disabled={left <= 0}
                onClick={() => plate(f)}
                title={f.name}
                className={cn(
                  "relative grid size-10 shrink-0 place-items-center rounded-full text-xl transition",
                  left > 0
                    ? "bg-foreground/[0.05] hover:scale-110 hover:bg-primary/15 active:scale-95"
                    : "cursor-not-allowed opacity-30",
                )}
              >
                {f.emoji}
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background px-1 text-[9px] tabular-nums text-muted-foreground">
                  {left}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-1.5 z-40 text-center text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        {onPlate ? `tap the plate — ${name} is ready` : `pick a dish for ${name}`}
      </p>
    </div>
  );
}
