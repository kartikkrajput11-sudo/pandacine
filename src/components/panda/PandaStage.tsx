import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie, Popcorn, Camera, Hand, Sparkles, Leaf, Bell } from "lucide-react";
import { PandaCharacter } from "./PandaCharacter";
import { usePandaBrain, type Zone, type Costume } from "./usePandaBrain";
import { Spotlight } from "@/components/ui/spotlight";
import { pandaSfx } from "@/lib/panda-sfx";
import { cn } from "@/lib/utils";

export type PandaActions = {
  bamboo: () => void;
  bell: () => void;
  popcorn: () => void;
  cookie: () => void;
  paw: () => void;
  photo: () => void;
  dance: () => void;
  headpat: () => void;
  bellyRub: () => void;
  boop: () => void;
  tailPull: () => void;
};

type Props = {
  name?: string;
  className?: string;
  /** Show treats / tickle meter / hint chips. */
  playful?: boolean;
  onInteract?: (kind: string) => void;
  /** Simplified motion for small or low-power surfaces. */
  lite?: boolean;
  /** Force the outfit the mascot wears (from the saved wardrobe). */
  costume?: Costume;
  /** Hide the built-in chip rail so the host page can render its own. */
  hideActions?: boolean;
  /** Real shop garments (item keys) rendered on the rig instead of emoji. */
  wear?: { outfit?: string | null; accessory?: string | null; prop?: string | null };
  /** Receive the interaction handlers so they can be rendered elsewhere. */
  onReady?: (actions: PandaActions) => void;
};

const TICKLE_LABEL = ["", "giggle", "laughing", "rolling", "can't breathe", "cute aggression"];

/**
 * The stage the mascot lives on: cinematic lights, ambient particles,
 * drag physics, treats and every direct interaction.
 */
export function PandaStage({
  name = "Pan",
  className,
  playful = true,
  onInteract,
  lite = false,
  costume,
  hideActions = false,
  wear,
  onReady,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { state, interact, feel, doAction, say, burstConfetti, setCostume } = usePandaBrain({
    containerRef: ref,
    onInteract,
  });

  // Wear the outfit chosen in the wardrobe.
  useEffect(() => {
    if (costume) setCostume(costume);
  }, [costume, setCostume]);
  const [dragging, setDragging] = useState(false);
  const [hiding, setHiding] = useState(false);

  // Every so often the panda slips behind the bamboo and peeks out.
  useEffect(() => {
    if (!playful) return;
    const id = window.setInterval(() => {
      setHiding((h) => (h ? false : Math.random() < 0.35));
    }, 14_000);
    return () => window.clearInterval(id);
  }, [playful]);

  const callWithBamboo = useCallback(() => {
    setHiding(false);
    doAction("run", 1200);
    feel("excited", 2200);
    pandaSfx.pop();
    say("BAMBOO!! 🎋", 1600);
    window.setTimeout(() => {
      doAction("eat", 2600);
      feel("happy", 3000);
      interact("bamboo");
    }, 1100);
  }, [doAction, feel, say, interact]);

  const onZone = useCallback((zone: Zone) => interact(zone), [interact]);


  const treat = useCallback(
    (kind: "bamboo" | "popcorn" | "cookie") => {
      interact(kind);
      say(kind === "cookie" ? "sugar!!" : kind === "popcorn" ? "catch!" : "yum 🎋", 1800);
    },
    [interact, say],
  );

  const ringBell = useCallback(() => {
    setHiding(false);
    pandaSfx.pop();
    say("coming!! 🔔", 1500);
    doAction("run", 1400);
    feel("excited", 2000);
  }, [doAction, feel, say]);

  const dance = useCallback(() => {
    doAction("dance", 2400);
    feel("celebrating", 2600);
    burstConfetti(50);
    pandaSfx.celebrate();
  }, [doAction, feel, burstConfetti]);

  const actions = useMemo<PandaActions>(
    () => ({
      bamboo: callWithBamboo,
      bell: ringBell,
      popcorn: () => treat("popcorn"),
      cookie: () => treat("cookie"),
      paw: () => interact("paw-r"),
      photo: () => interact("camera"),
      dance,
      headpat: () => interact("head"),
      bellyRub: () => interact("belly"),
      boop: () => interact("nose"),
      tailPull: () => interact("tail"),
    }),
    [callWithBamboo, ringBell, treat, interact, dance],
  );

  useEffect(() => {
    onReady?.(actions);
  }, [actions, onReady]);


  const particles = useMemo(
    () => Array.from({ length: lite ? 6 : 14 }, (_, i) => ({ id: i, x: Math.random() * 100, d: 6 + Math.random() * 10, delay: Math.random() * 8 })),
    [lite],
  );

  const sleeping = state.emotion === "asleep" || state.emotion === "dreaming";

  return (
    <div
      ref={ref}
      className={cn("relative select-none overflow-visible", className)}
      onDoubleClick={() => interact("camera")}
      onContextMenu={(e) => {
        e.preventDefault();
        interact("peekaboo");
      }}
    >
      <Spotlight size={280} className="z-0" />

      {/* Immersive 3D World Jungle */}
      <div className="absolute inset-0 z-0 overflow-hidden rounded-[3rem]">
        {/* Sky/Atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2f24] via-[#0d1611] to-[#050806]" />
        
        {/* Distant trees (simplified parallax) */}
        <div className="absolute inset-0 opacity-40">
           {Array.from({ length: 8 }).map((_, i) => (
             <motion.div 
               key={i}
               className="absolute bottom-0 w-32 h-64 bg-[#0a1a12] blur-xl rounded-full"
               style={{ left: `${i * 15}%`, scaleY: 0.8 + Math.random() * 0.4 }}
               animate={{ x: [0, 5, 0] }}
               transition={{ duration: 10 + i, repeat: Infinity, ease: "easeInOut" }}
             />
           ))}
        </div>

        {/* Midground Foliage */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0d1a12] to-transparent z-0" />
        
        {/* Ground with organic texture */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[#08120c]">
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#1a3324 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
        </div>

        {/* Ambient jungle lights */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-30"
          style={{
            background:
              "radial-gradient(40% 40% at 20% 30%, #2e5c46, transparent), radial-gradient(35% 35% at 80% 40%, #1a3324, transparent)",
          }}
        />

        {/* Dust motes / fireflies */}
        {!lite && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-0">
            {particles.map((p) => (
              <motion.span
                key={p.id}
                className="absolute size-1 rounded-full bg-[#a8e6cf]/40 shadow-[0_0_8px_#a8e6cf]"
                style={{ left: `${p.x}%`, bottom: -8 }}
                animate={{ y: [-0, -400], x: [0, Math.sin(p.id) * 40, 0], opacity: [0, 0.8, 0] }}
                transition={{ duration: p.d * 1.5, repeat: Infinity, delay: p.delay, ease: "easeOut" as const }}
              />
            ))}
          </div>
        )}
      </div>

      {/* the panda */}
      <motion.div
        drag
        dragElastic={0.28}
        dragMomentum={false}
        dragSnapToOrigin
        onDragStart={() => {
          setDragging(true);
          interact("drag");
        }}
        onDragEnd={() => {
          setDragging(false);
          feel("playful", 1400);
          pandaSfx.pop();
        }}
        animate={
          state.chaos
            ? { x: [0, -60, 60, -30, 0] }
            : hiding
              ? { x: -70, y: 26, scale: 0.92 }
              : { x: 0, y: 0, scale: 1 }
        }
        transition={
          state.chaos ? { duration: 1.6, repeat: Infinity } : { type: "spring", stiffness: 90, damping: 16 }
        }
        className={cn(
          "relative z-10 mx-auto flex h-full max-h-[94%] w-full max-w-[480px] items-center justify-center py-3 cursor-grab active:cursor-grabbing",
          dragging && "z-20",
        )}

      >
        <PandaCharacter state={state} onZone={onZone} lite={lite} wear={wear} className="h-full max-h-full w-full max-w-full" />



        {/* speech / thought bubbles */}
        <AnimatePresence>
          {(state.says || state.thought) && (
            <motion.div
              key={state.says ?? state.thought ?? ""}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-2 rounded-2xl glass-strong px-4 py-2 text-sm font-serif italic whitespace-nowrap"
            >
              {state.thought ? `💭 ${state.thought}` : state.says}
            </motion.div>
          )}
        </AnimatePresence>

        {/* sleeping z's */}
        {sleeping && (
          <div aria-hidden className="pointer-events-none absolute right-6 top-6">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute font-serif italic text-petal"
                style={{ fontSize: 16 + i * 6 }}
                animate={{ y: [-0, -40], x: [0, 14], opacity: [0, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.9 }}
              >
                z
              </motion.span>
            ))}
          </div>
        )}

        {/* hearts */}
        <AnimatePresence>
          {state.hearts > 0 &&
            Array.from({ length: state.hearts }).map((_, i) => (
              <motion.span
                key={i}
                className="pointer-events-none absolute left-1/2 top-1/3 text-petal"
                initial={{ opacity: 0, y: 0, x: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 0], y: -120 - i * 12, x: (i - 2) * 26, scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, delay: i * 0.08 }}
              >
                ❤︎
              </motion.span>
            ))}
        </AnimatePresence>
      </motion.div>

      {/* foreground bamboo grove — the panda can slip behind it */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-[46%] overflow-hidden rounded-b-[3rem]">
        {[6, 16, 78, 90].map((left, i) => (
          <motion.div
            key={left}
            className="absolute bottom-0 w-6 rounded-t-full"
            style={{
              left: `${left}%`,
              height: `${60 + i * 8}%`,
              background: "linear-gradient(90deg,#1d3b24,#4f7f42 42%,#8ab86a 55%,#2b4c2c)",
              boxShadow: "0 0 24px rgba(0,0,0,.45) inset",
            }}
            animate={{ rotate: [0, 1.4, -1.2, 0] }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}
          >
            {[0.25, 0.5, 0.75].map((t) => (
              <span
                key={t}
                className="absolute left-0 h-[3px] w-full bg-[#12240f]/70"
                style={{ top: `${t * 100}%` }}
              />
            ))}
          </motion.div>
        ))}
        <motion.div
          className="absolute inset-x-0 bottom-0 h-14"
          style={{ background: "linear-gradient(to top, rgba(6,18,10,.95), transparent)" }}
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      {/* confetti */}

      <AnimatePresence>
        {state.confetti > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {Array.from({ length: state.confetti }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute size-1.5 rounded-[2px]"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: "-5%",
                  background: ["var(--petal)", "#f0d78c", "#5cbdb9", "#c96b7a"][i % 4],
                }}
                initial={{ y: -20, rotate: 0, opacity: 1 }}
                animate={{ y: 420, rotate: 720, opacity: [1, 1, 0] }}
                transition={{ duration: 2 + Math.random() * 1.5, ease: "easeIn" }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {playful && (
        <div className="relative z-30 mt-2 space-y-3">
          {/* tickle meter */}
          <div className="mx-auto max-w-[320px]">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-candle-muted">
              <span>Tickle meter</span>
              <span className="text-petal">{TICKLE_LABEL[state.tickle] || "calm"}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface overflow-hidden border border-border">
              <motion.div
                className="h-full bg-petal petal-glow"
                animate={{ width: `${(state.tickle / 5) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
              />
            </div>
          </div>

          {/* hunger / mood */}
          <div className="mx-auto max-w-[320px]">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-candle-muted">
              <span>Belly</span>
              <span className={state.ignoring ? "text-coral" : "text-petal"}>
                {state.ignoring
                  ? "sulking — feed bamboo"
                  : state.hunger > 0.6
                    ? "very hungry"
                    : state.hunger > 0.3
                      ? "peckish"
                      : sleeping
                        ? "sleeping"
                        : "content"}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface overflow-hidden border border-border">
              <motion.div
                className={cn("h-full", state.ignoring ? "bg-coral" : "bg-petal petal-glow")}
                animate={{ width: `${Math.max(6, (1 - state.hunger) * 100)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
              />
            </div>
          </div>

          {!hideActions && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Chip onClick={actions.bamboo} Icon={Leaf} label="Hold bamboo" />
              <Chip onClick={actions.bell} Icon={Bell} label="Ring bell" />
              <Chip onClick={actions.popcorn} Icon={Popcorn} label="Popcorn" />
              <Chip onClick={actions.cookie} Icon={Cookie} label="Cookie" />
              <Chip onClick={actions.paw} Icon={Hand} label="Paw shake" />
              <Chip onClick={actions.photo} Icon={Camera} label="Photo" />
              <Chip onClick={actions.dance} Icon={Sparkles} label="Dance" />
            </div>
          )}

          <p className="text-center text-[11px] text-candle-muted">
            Pat the head · boop the nose · rub the belly · pull the tail · drag {name} around · double-click for a photo ·
            type <span className="text-petal">PANDA</span>
          </p>

        </div>
      )}
    </div>
  );
}

function Chip({ onClick, Icon, label }: { onClick: () => void; Icon: typeof Leaf; label: string }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[11px] uppercase tracking-widest text-candle-muted transition-all hover:border-petal/50 hover:text-petal active:scale-95"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
