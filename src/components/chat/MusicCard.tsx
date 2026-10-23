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
    <div className="flex items-center gap-3 w-[240px]">
      <button onClick={toggle} className="relative size-14 rounded-xl overflow-hidden shrink-0 bg-candle/10" aria-label={playing ? "Pause song" : "Play song"}>
        {song.artwork && (
          <img src={song.artwork} alt="" className={`size-full object-cover ${playing ? "animate-[spin_8s_linear_infinite] rounded-full" : ""} transition-[border-radius] duration-500`} />
        )}
        <span className="absolute inset-0 grid place-items-center bg-background/30">
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-70 flex items-center gap-1"><Music2 className="size-3" /> Song</p>
        <p className="text-sm font-medium truncate">{song.title}</p>
        <p className="text-xs opacity-75 truncate">{song.artist}</p>
        <div className="mt-1.5 h-1 rounded-full bg-current/20 overflow-hidden opacity-80">
          <div className="h-full bg-current transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
