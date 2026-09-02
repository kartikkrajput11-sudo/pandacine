import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Square } from "lucide-react";
import { toast } from "sonner";
import { micSupported, playInPandaVoice, recordVoice, type Recording } from "@/lib/panda-voice";
import { cn } from "@/lib/utils";

const PREF = "panda.mic.enabled";

/**
 * Voice repeat, opt-in only.
 *
 * The mic is OFF by default and never opens on its own. The user first enables
 * it (one tap, which triggers the browser permission prompt), and only then can
 * they tap record. Recording always ends with the stream released.
 */
export function PandaVoiceMic({
  name,
  onTalk,
  className,
}: {
  name: string;
  /** Called with the playback duration so the panda can mouth along. */
  onTalk?: (ms: number) => void;
  className?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const recRef = useRef<Recording | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    setSupported(micSupported());
    try {
      setEnabled(localStorage.getItem(PREF) === "1");
    } catch {
      /* ignore */
    }
    return () => {
      cancelAnimationFrame(raf.current);
      recRef.current?.stop();
    };
  }, []);

  const setPref = (v: boolean) => {
    setEnabled(v);
    try {
      localStorage.setItem(PREF, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    cancelAnimationFrame(raf.current);
    setRecording(false);
    setLevel(0);
  }, []);

  async function start() {
    if (recording) return stop();
    try {
      const rec = await recordVoice({
        maxMs: 8000,
        onStop: () => {
          setRecording(false);
          setLevel(0);
        },
        onClip: async (blob) => {
          try {
            const ms = await playInPandaVoice(blob);
            if (ms > 0) {
              setSpeaking(true);
              onTalk?.(ms);
              window.setTimeout(() => setSpeaking(false), ms);
            }
          } catch {
            toast.error("Couldn't play that back");
          }
        },
      });
      recRef.current = rec;
      setRecording(true);
      const tick = () => {
        setLevel(rec.level());
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch {
      toast.error("Microphone access was blocked");
      setPref(false);
    }
  }

  if (!supported) return null;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {!enabled ? (
        <button
          onClick={() => setPref(true)}
          className="inline-flex items-center gap-2 rounded-full bg-foreground/[0.05] px-5 py-2 text-[11px] uppercase tracking-[0.26em] text-muted-foreground transition hover:text-foreground active:scale-95"
        >
          <MicOff className="size-3.5" /> Enable voice
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={start}
            aria-label={recording ? "Stop recording" : "Record for the panda to repeat"}
            className={cn(
              "relative grid size-14 place-items-center rounded-full transition active:scale-95",
              recording ? "bg-primary text-primary-foreground" : "bg-primary/12 text-primary hover:bg-primary/18",
            )}
          >
            {recording && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full border border-primary/60"
                animate={{ scale: 1 + level * 0.55, opacity: 0.35 + level * 0.5 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
              />
            )}
            {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
          </button>
          <button
            onClick={() => {
              stop();
              setPref(false);
            }}
            className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground transition hover:text-foreground"
          >
            Turn off
          </button>
        </div>
      )}
      <p className="text-center text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        {!enabled
          ? "mic stays off until you turn it on"
          : speaking
            ? `${name} is repeating you`
            : recording
              ? "listening — tap to stop"
              : "tap to talk"}
      </p>
    </div>
  );
}
