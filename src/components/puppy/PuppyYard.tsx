import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import yard from "@/assets/puppy-backyard.jpg";
import puppyImage from "@/assets/puppy-character.png";

export type PuppyMood = "happy" | "excited" | "curious" | "sleepy" | "hungry" | "sad";

export function PuppyYard({ name, mood, playing, onPat }: { name: string; mood: PuppyMood; playing: string | null; onPat: () => void }) {
  const [ball, setBall] = useState(false);
  return (
    <div className="relative isolate h-[390px] w-full overflow-hidden rounded-lg border border-border sm:h-[470px]" aria-label={`${name} in the backyard`}>
      <img src={yard} alt="Sunlit puppy backyard with a doghouse" width={1280} height={1024} className="absolute inset-0 size-full object-cover" />
      <div className="absolute left-4 top-4 rounded-md border border-border bg-background/85 px-3 py-2 text-sm font-semibold text-foreground backdrop-blur">
        {mood === "excited" ? "🐾 Zoomies!" : mood === "curious" ? "👀 Curious" : mood === "sleepy" ? "💤 Sleepy" : mood === "hungry" ? "🥣 Hungry" : mood === "sad" ? "💧 Misses you" : "💛 Happy"}
      </div>
      <AnimatePresence>
        {playing === "fetch" && (
          <motion.span key="ball" aria-hidden initial={{ x: -150, y: 40, opacity: 0 }} animate={{ x: [0, 155, 0], y: [20, -45, 20], opacity: [0, 1, 1] }} exit={{ opacity: 0 }} transition={{ duration: 1.8 }} className="absolute bottom-[18%] left-1/2 z-10 text-4xl">🎾</motion.span>
        )}
      </AnimatePresence>
      <motion.div className="absolute bottom-[5%] left-1/2 z-20 w-[min(72%,310px)] -translate-x-1/2 cursor-pointer touch-manipulation" animate={playing === "fetch" ? { x: [0, 85, 0], rotate: [0, 8, -8, 0], scale: [1, 0.84, 1] } : playing === "tug" ? { x: [0, -12, 12, -8, 0], rotate: [0, -8, 9, -5, 0] } : playing === "belly" ? { rotate: [0, -25, 10, 0] } : playing === "nap" ? { y: 28, rotate: -8 } : { y: [0, -4, 0], rotate: ball ? -3 : 0 }} transition={{ duration: playing === "fetch" ? 1.8 : playing ? 0.85 : 2.5, repeat: playing ? 0 : Infinity }} onAnimationComplete={() => setBall(false)} onClick={onPat} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onPat(); }} aria-label={`Pet ${name}`}>
        <img src={puppyImage} alt={name} width={1024} height={1024} className="w-full drop-shadow-xl" />
      </motion.div>
      <AnimatePresence>
        {playing && <motion.div key={playing} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-md bg-background/80 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur">{playing === "fetch" ? "Got it! 🎾" : playing === "tug" ? "Grr... mine! 🪢" : playing === "nap" ? "Sweet dreams... 💤" : playing === "belly" ? "More belly rubs! 💛" : playing === "paw" ? "Good dog! 🐾" : "Woof! 💛"}</motion.div>}
      </AnimatePresence>
    </div>
  );
}