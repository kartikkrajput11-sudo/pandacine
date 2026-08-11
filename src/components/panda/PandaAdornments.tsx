import { motion } from "framer-motion";
import type { PandaLook } from "@/components/panda/PandaPreview";

const EFFECT_EMOJI: Record<string, string> = {
  "effect-hearts": "💗",
  "effect-sparkles": "✨",
  "effect-petals": "🌸",
  "effect-snow": "❄️",
  "effect-fireflies": "🪄",
};

const ENV_TINT: Record<string, string> = {
  "env-bedroom": "rgba(120,80,160,0.16)",
  "env-cafe": "rgba(180,120,60,0.14)",
  "env-garden": "rgba(70,170,130,0.14)",
  "env-rain": "rgba(90,130,190,0.16)",
  "env-winter": "rgba(150,190,220,0.16)",
  "env-romantic": "rgba(220,90,140,0.16)",
};

/**
 * Overlays whatever the user bought and equipped in the Panda Shop on top of
 * the live mascot stage, so purchases actually show up on the pet page.
 * Purely presentational — ownership and equip state come from the backend.
 */
export function PandaAdornments({ look }: { look: PandaLook }) {
  const effect = EFFECT_EMOJI[look.effect?.item_key ?? ""] ?? null;
  const tint = ENV_TINT[look.environment?.item_key ?? ""] ?? null;
  const nothing = !look.accessory && !look.outfit && !look.prop && !effect && !tint && !look.expression;
  if (nothing) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {tint && <div className="absolute inset-0" style={{ background: tint }} />}

      {effect &&
        Array.from({ length: 8 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute select-none text-lg"
            style={{ left: `${9 + i * 11}%` }}
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: "-12%", opacity: [0, 1, 0] }}
            transition={{ duration: 5 + (i % 4), repeat: Infinity, delay: i * 0.5, ease: "linear" }}
          >
            {effect}
          </motion.span>
        ))}

      {look.accessory && (
        <motion.span
          className="absolute left-1/2 top-[16%] -translate-x-1/2 text-4xl drop-shadow"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {look.accessory.emoji}
        </motion.span>
      )}

      {look.outfit && (
        <span className="absolute bottom-[22%] left-1/2 -translate-x-1/2 text-4xl drop-shadow">
          {look.outfit.emoji}
        </span>
      )}

      {look.expression && (
        <span className="absolute bottom-[38%] left-1/2 -translate-x-1/2 text-2xl">{look.expression.emoji}</span>
      )}

      {look.prop && (
        <motion.span
          className="absolute bottom-[20%] right-[16%] text-4xl"
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {look.prop.emoji}
        </motion.span>
      )}
    </div>
  );
}
