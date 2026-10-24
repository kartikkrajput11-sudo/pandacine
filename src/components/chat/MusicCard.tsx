import { useEffect, useRef, useState } from "react";
import { Play, Pause, Music2 } from "lucide-react";
import type { SongPick } from "@/lib/music.functions";

let current: HTMLAudioElement | null = null;

export function MusicCard({ song }: { song: SongPick }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => ref.current?.pause(), []);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!ref.current) {
      const a = new Audio(song.preview_url);
      a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
      a.onended = () => { setPlaying(false); setProgress(0); };
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      ref.current = a;
    }
    const a = ref.current;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      a.play().catch(() => {});
    } else a.pause();
  }

  return (
    <div className="relative w-[264px] rounded-[20px] overflow-hidden bg-velvet ring-1 ring-candle/10 shadow-[0_14px_34px_-14px_rgba(0,0,0,0.55)]">
      {/* ambient artwork wash */}
      {song.artwork && (
        <img
          src={song.artwork}
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute inset-0 size-full scale-150 object-cover opacity-25 blur-2xl"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-velvet/90 via-velvet/55 to-velvet/35" />

      <div className="relative flex items-center gap-3.5 p-3.5">
        {/* vinyl */}
        <button
          onClick={toggle}
          aria-label={playing ? "Pause song" : "Play song"}
          className="group relative size-16 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-petal/60"
        >
          {song.artwork ? (
            <img
              src={song.artwork}
              alt=""
              loading="lazy"
              className={`size-full rounded-full object-cover transition-transform duration-700 ${playing ? "animate-[spin_9s_linear_infinite]" : ""}`}
            />
          ) : (
            <span className="grid size-full place-items-center rounded-full bg-candle/10">
              <Music2 className="size-5 text-candle-muted" />
            </span>
          )}
          {/* grooves */}
          <span className="pointer-events-none absolute inset-[3px] rounded-full ring-1 ring-velvet/40" />
          <span className="pointer-events-none absolute inset-[8px] rounded-full ring-1 ring-velvet/25" />
          {/* spindle */}
          <span className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-velvet ring-1 ring-candle/20" />
          {/* play state */}
          <span
            className={`absolute inset-0 grid place-items-center rounded-full transition-opacity duration-200 ${
              playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
            }`}
          >
            <span className="grid size-7 place-items-center rounded-full bg-velvet/70 ring-1 ring-candle/20 backdrop-blur-sm">
              {playing ? (
                <Pause className="size-3.5 text-candle" />
              ) : (
                <Play className="size-3.5 translate-x-px text-candle" />
              )}
            </span>
          </span>
        </button>

        {/* details */}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.28em] text-petal/90">
            <Music2 className="size-3" /> Song
          </p>
          <p className="mt-1 truncate text-sm font-medium text-candle">{song.title}</p>
          <p className="truncate text-[11px] text-candle-muted">{song.artist}</p>

          <div className="mt-2 flex items-center gap-2.5">
            <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-candle/15">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-petal to-coral transition-[width] duration-200"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            {playing ? (
              <span className="flex h-3 shrink-0 items-end gap-[2.5px]" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] origin-bottom rounded-full bg-petal"
                    style={{ height: "100%", animation: `pc-eq ${(0.9 + i * 0.22).toFixed(2)}s ease-in-out ${i * 0.14}s infinite` }}
                  />
                ))}
              </span>
            ) : (
              <span className="shrink-0 text-[9px] tabular-nums text-candle-muted/70">0:30</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
