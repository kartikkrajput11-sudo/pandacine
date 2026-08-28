import { useMemo } from "react";
import { motion } from "framer-motion";
import type { PandaShopItem } from "@/lib/luvies";
import { PandaCharacter } from "./PandaCharacter";
import type { Emotion, PandaState } from "./usePandaBrain";

const ENV_BG: Record<string, string> = {
  "env-bedroom": "from-[#2a1d33] via-[#1b1424] to-[#120d19]",
  "env-cafe": "from-[#33241a] via-[#221811] to-[#15100c]",
  "env-garden": "from-[#122a24] via-[#0e1d1a] to-[#0a1412]",
  "env-rain": "from-[#1a2331] via-[#131a25] to-[#0d1219]",
  "env-winter": "from-[#1c2733] via-[#141d26] to-[#0e141b]",
  "env-romantic": "from-[#331825] via-[#22101a] to-[#160a11]",
};

const EFFECT_EMOJI: Record<string, string> = {
  "effect-hearts": "💗",
  "effect-sparkles": "✨",
  "effect-petals": "🌸",
  "effect-snow": "❄️",
  "effect-fireflies": "🪄",
};

const EXPRESSION_EMOTION: Record<string, Emotion> = {
  "expr-happy": "happy",
  "expr-sleepy": "sleepy",
  "expr-excited": "excited",
  "expr-angrycute": "angry",
  "expr-dancing": "celebrating",
  "expr-crying": "disappointed",
  "expr-blushing": "shy",
  "expr-love": "happy",
};

export type PandaLook = {
  outfit?: PandaShopItem | null;
  accessory?: PandaShopItem | null;
  prop?: PandaShopItem | null;
  effect?: PandaShopItem | null;
  environment?: PandaShopItem | null;
  expression?: PandaShopItem | null;
};

/**
 * Live try-on — the actual mascot rig wearing real, hand-drawn garments
 * (with cloth physics), not emoji stickers.
 */
export function PandaPreview({ look, className = "" }: { look: PandaLook; className?: string }) {
  const envKey = look.environment?.item_key ?? "";
  const bg = ENV_BG[envKey] ?? "from-[#1a1420] via-[#141019] to-[#0d0a12]";
  const effect = EFFECT_EMOJI[look.effect?.item_key ?? ""] ?? null;
  const emotion = EXPRESSION_EMOTION[look.expression?.item_key ?? ""] ?? "happy";
  const dancing = look.expression?.item_key === "expr-dancing";

  const state = useMemo<PandaState>(
    () => ({
      emotion,
      action: null,
      look: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
      tickle: 0,
      interactions: 0,
      chaos: false,
      costume: "classic",
      thought: null,
      hearts: 0,
      confetti: 0,
      says: null,
      ignoring: false,
      hunger: 0,
    }),
    [emotion],
  );

  const wear = {
    outfit: look.outfit?.item_key ?? null,
    accessory: look.accessory?.item_key ?? null,
    prop: look.prop?.item_key ?? null,
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b ${bg} ${className}`}>
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 size-56 rounded-full bg-petal/15 blur-3xl" />

      {effect &&
        Array.from({ length: 9 }).map((_, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute text-lg select-none"
            style={{ left: `${8 + i * 10}%` }}
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: "-15%", opacity: [0, 1, 0] }}
            transition={{ duration: 5 + (i % 4), repeat: Infinity, delay: i * 0.45, ease: "linear" }}
          >
            {effect}
          </motion.span>
        ))}

      <motion.div
        className="relative flex h-full w-full items-center justify-center py-3"
        animate={dancing ? { rotate: [-5, 5, -5] } : { y: [0, -4, 0] }}
        transition={{ duration: dancing ? 1.2 : 3.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <PandaCharacter state={state} wear={wear} className="h-full max-h-full w-full max-w-full" />
      </motion.div>
    </div>
  );
}
