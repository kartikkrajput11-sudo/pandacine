import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useLocation } from "@tanstack/react-router";
import { PandaCharacter } from "./PandaCharacter";
import type { PandaState } from "./usePandaBrain";
import { pandaSfx } from "@/lib/panda-sfx";
import { getPet } from "@/lib/pet.functions";
import { fullnessNow } from "@/lib/pet-foods";

const ANGRY_LINES = [
  "hmph.",
  "i'm NOT looking at you",
  "*stomp stomp*",
  "you forgot me…",
  "belly. empty.",
  "mwrp!! feed me",
  "i'm fine. (i'm not)",
];
const CALM_LINES = ["mrrp… okay", "…i missed you", "*happy chirp*", "you came back 🥺"];

const CALM_KEY = "panda:calmedAt";
const CALM_MS = 25 * 60 * 1000;

function baseState(over: Partial<PandaState>): PandaState {
  return {
    emotion: "angry",
    action: "run",
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
    ignoring: true,
    hunger: 1,
    ...over,
  };
}

/**
 * When the panda is hungry / neglected it escapes the pet page and dashes
 * across whatever page you're on, seeking attention. Tap it to calm it down.
 */
export function RoamingPanda() {
  const fetchPet = useServerFn(getPet);
  const { pathname } = useLocation();
  const { data } = useQuery({
    queryKey: ["pet"],
    queryFn: () => fetchPet({ data: undefined as never }),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const pet = data?.pet as any;
  const fullness = pet ? fullnessNow(pet.fullness ?? 100, pet.last_fed_at) : 100;
  const neglected = Boolean(pet?.unlocked) && pet?.alive !== false && fullness < 45;

  const [visible, setVisible] = useState(false);
  const [calmed, setCalmed] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [top, setTop] = useState(60);
  const timers = useRef<number[]>([]);

  // Never on the pet page itself — that's where it lives.
  const allowed = neglected && !calmed && !pathname.startsWith("/app/pet");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CALM_KEY);
      if (raw && Date.now() - Number(raw) < CALM_MS) setCalmed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!allowed) {
      setVisible(false);
      return;
    }
    const schedule = () => {
      const wait = 12_000 + Math.random() * 40_000;
      const id = window.setTimeout(() => {
        setDir(Math.random() < 0.5 ? 1 : -1);
        setTop(20 + Math.random() * 55);
        setLine(ANGRY_LINES[Math.floor(Math.random() * ANGRY_LINES.length)]!);
        setVisible(true);
        pandaSfx.pop?.();
        const hide = window.setTimeout(() => setVisible(false), 6200);
        timers.current.push(hide);
        schedule();
      }, wait);
      timers.current.push(id);
    };
    schedule();
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [allowed]);

  const state = useMemo(
    () => baseState({ says: null, emotion: "angry", action: "run" }),
    [],
  );

  const calm = () => {
    setLine(CALM_LINES[Math.floor(Math.random() * CALM_LINES.length)]!);
    pandaSfx.giggle?.();
    setCalmed(true);
    try {
      window.localStorage.setItem(CALM_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    window.setTimeout(() => setVisible(false), 1600);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="roaming-panda"
          className="pointer-events-none fixed z-[60] left-0 w-full"
          style={{ top: `${top}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="pointer-events-auto absolute w-[104px]"
            initial={{ x: dir === 1 ? -140 : window.innerWidth + 60 }}
            animate={{ x: dir === 1 ? window.innerWidth + 60 : -140 }}
            transition={{ duration: 6, ease: "linear" }}
          >
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="relative"
              style={{ transform: dir === -1 ? "scaleX(-1)" : undefined }}
            >
              <Link
                to="/app/pet"
                onClick={calm}
                aria-label="Your panda wants attention"
                className="block cursor-pointer active:scale-95"
              >
                <PandaCharacter state={state} lite className="w-full h-auto drop-shadow-2xl" />
              </Link>
            </motion.div>
            {line && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full glass-strong px-3 py-1 text-[11px] font-serif italic">
                {line}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
