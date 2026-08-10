import { motion } from "framer-motion";
import type { PandaShopItem } from "@/lib/luvies";

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

const EXPRESSION_FACE: Record<string, string> = {
  "expr-happy": "😊",
  "expr-sleepy": "😴",
  "expr-excited": "🤩",
  "expr-angrycute": "😾",
  "expr-dancing": "💃",
  "expr-crying": "🥺",
  "expr-blushing": "☺️",
  "expr-love": "😍",
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
 * Live look preview — the panda wearing whatever is equipped or being previewed.
 * Purely presentational; ownership always comes from the backend.
 */
export function PandaPreview({ look, className = "" }: { look: PandaLook; className?: string }) {
  const envKey = look.environment?.item_key ?? "";
  const bg = ENV_BG[envKey] ?? "from-[#1a1420] via-[#141019] to-[#0d0a12]";
  const effect = EFFECT_EMOJI[look.effect?.item_key ?? ""] ?? null;
  const face = EXPRESSION_FACE[look.expression?.item_key ?? ""] ?? null;
  const dancing = look.expression?.item_key === "expr-dancing";

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b ${bg} ${className}`}
    >
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

      <div className="relative flex flex-col items-center justify-end h-full py-8">
        <motion.div
          className="relative"
          animate={dancing ? { rotate: [-7, 7, -7], y: [0, -6, 0] } : { y: [0, -5, 0] }}
          transition={{ duration: dancing ? 1.1 : 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Accessory sits on the head */}
          {look.accessory && (
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl drop-shadow">
              {look.accessory.emoji}
            </span>
          )}

          <span className="block text-[86px] leading-none select-none drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)]">
            🐼
          </span>

          {/* Expression overlays the muzzle */}
          {face && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-2xl">{face}</span>
          )}

          {/* Outfit across the body */}
          {look.outfit && (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-3xl drop-shadow">
              {look.outfit.emoji}
            </span>
          )}

          {/* Prop held to the side */}
          {look.prop && (
            <motion.span
              className="absolute -right-7 bottom-3 text-3xl"
              animate={{ rotate: [-8, 8, -8] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              {look.prop.emoji}
            </motion.span>
          )}
        </motion.div>

        <div className="mt-4 h-3 w-24 rounded-full bg-black/40 blur-md" />
      </div>
    </div>
  );
}
