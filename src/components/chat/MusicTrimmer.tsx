import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Check, Play, Pause } from "lucide-react";
import type { SongPick } from "@/lib/music.functions";
import { DEFAULT_CLIP_SECONDS, PREVIEW_SECONDS } from "@/lib/music-clip";

const BARS = 60;
const LENGTHS = [5, 10, 15, 30];

function fmt(s: number) {
  return `0:${String(Math.floor(s)).padStart(2, "0")}`;
}

/** Instagram-style picker: drag a window across the song to choose the part to send. */
export function MusicTrimmer({ song, onBack, onDone }: { song: SongPick; onBack: () => void; onDone: (s: SongPick) => void }) {
  const [length, setLength] = useState(song.length ?? DEFAULT_CLIP_SECONDS);
  const [start, setStart] = useState(song.start ?? 0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(start);
  const audio = useRef<HTMLAudioElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const maxStart = PREVIEW_SECONDS - length;

  // Deterministic pseudo-waveform per song.
  const bars = useMemo(() => {
    let seed = song.id % 2147483647 || 1;
    return Array.from({ length: BARS }, (_, i) => {
      seed = (seed * 16807) % 2147483647;
      const r = seed / 2147483647;
      return 0.25 + 0.75 * Math.abs(Math.sin(i * 0.45 + r * 2)) * (0.55 + r * 0.45);
    });
  }, [song.id]);

  useEffect(() => {
    const a = new Audio(song.preview_url);
    audio.current = a;
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.play().catch(() => {});
    a.currentTime = start;
    return () => { a.pause(); audio.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.preview_url]);

  // Loop playback within the window.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => {
      if (a.currentTime >= start + length || a.currentTime < start - 0.3) a.currentTime = start;
      setPos(a.currentTime);
    };
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, [start, length]);

  useEffect(() => { if (start > maxStart) setStart(maxStart); }, [maxStart, start]);

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current || !track.current) return;
    const w = track.current.clientWidth;
    const dx = e.clientX - drag.current.x;
    const next = Math.min(maxStart, Math.max(0, drag.current.start + (dx / w) * PREVIEW_SECONDS));
    setStart(Math.round(next * 10) / 10);
  }
  function onUp() {
    drag.current = null;
    const a = audio.current;
    if (a) { a.currentTime = start; a.play().catch(() => {}); }
  }

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) { a.currentTime = start; a.play().catch(() => {}); } else a.pause();
  }

  const left = (start / PREVIEW_SECONDS) * 100;
  const width = (length / PREVIEW_SECONDS) * 100;
  const playhead = ((pos - start) / length) * 100;

  return (
    <div className="px-4 pb-5 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-candle-muted mb-3">
        <ChevronLeft className="size-4" /> Back to songs
      </button>

      <div className="flex items-center gap-3 mb-5">
        <button onClick={toggle} className="relative size-16 rounded-2xl overflow-hidden shrink-0 bg-candle/10" aria-label={playing ? "Pause" : "Play"}>
          {song.artwork && <img src={song.artwork} alt="" className="size-full object-cover" />}
          <span className="absolute inset-0 grid place-items-center bg-background/35">
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </span>
        </button>
        <div className="min-w-0">
          <p className="font-medium truncate">{song.title}</p>
          <p className="text-sm text-candle-muted truncate">{song.artist}</p>
        </div>
      </div>

      <p className="text-xs text-candle-muted text-center mb-2">Slide to pick your favourite part</p>

      <div
        ref={track}
        className="relative h-16 select-none touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="absolute inset-0 flex items-center gap-[2px]">
          {bars.map((h, i) => {
            const t = (i / BARS) * PREVIEW_SECONDS;
            const inside = t >= start && t < start + length;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-colors duration-150 ${inside ? "bg-petal" : "bg-candle/20"}`}
                style={{ height: `${h * 100}%` }}
              />
            );
          })}
        </div>
        <div
          className="absolute inset-y-0 rounded-xl ring-2 ring-candle shadow-lg transition-[left] duration-75"
          style={{ left: `${left}%`, width: `${width}%` }}
        >
          {playing && (
            <span className="absolute inset-y-1 w-0.5 bg-candle rounded-full" style={{ left: `${Math.min(100, Math.max(0, playhead))}%` }} />
          )}
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-candle-muted tabular-nums mt-2">
        <span>{fmt(start)}</span>
        <span className="text-candle">{fmt(start)} – {fmt(start + length)}</span>
        <span>{fmt(PREVIEW_SECONDS)}</span>
      </div>

      <div className="flex items-center justify-center gap-2 mt-4">
        {LENGTHS.map((l) => (
          <button
            key={l}
            onClick={() => setLength(l)}
            className={`h-8 px-3 rounded-full text-xs ring-1 ${length === l ? "bg-petal text-velvet ring-petal" : "ring-candle/15 text-candle-muted"}`}
          >
            {l}s
          </button>
        ))}
      </div>

      <button
        onClick={() => onDone({ ...song, start, length })}
        className="mt-5 w-full h-12 rounded-full bg-petal text-velvet flex items-center justify-center gap-2 font-medium"
      >
        <Check className="size-4" /> Use this part
      </button>
    </div>
  );
}
