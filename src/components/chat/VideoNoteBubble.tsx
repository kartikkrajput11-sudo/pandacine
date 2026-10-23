import { useEffect, useRef, useState } from "react";
import { Play, Music2, Loader2 } from "lucide-react";
import { signMedia } from "@/lib/chat";
import type { SongPick } from "@/lib/music.functions";

export function VideoNoteBubble({ path, durationMs, song }: { path: string; durationMs?: number; song?: SongPick | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const vRef = useRef<HTMLVideoElement | null>(null);
  const aRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    signMedia(path).then((u) => alive && setUrl(u));
    return () => { alive = false; aRef.current?.pause(); };
  }, [path]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const v = vRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.ended || v.currentTime >= (v.duration || 0)) v.currentTime = 0;
      v.muted = false;
      v.play().catch(() => {});
      if (song) {
        if (!aRef.current) { aRef.current = new Audio(song.preview_url); aRef.current.volume = 0.45; }
        aRef.current.currentTime = v.currentTime;
        aRef.current.play().catch(() => {});
      }
    } else {
      v.pause();
      aRef.current?.pause();
    }
  }

  const R = 48, C = 2 * Math.PI * R;
  const secs = Math.round((durationMs ?? 0) / 1000);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button onClick={toggle} className="relative size-[200px] rounded-full" aria-label={playing ? "Pause video note" : "Play video note"}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90 pointer-events-none z-10">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--petal)" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - progress)} opacity={playing || progress > 0 ? 1 : 0} />
        </svg>
        <div className={`absolute inset-[3px] rounded-full overflow-hidden bg-velvet transition-transform duration-300 ${playing ? "scale-[1.02]" : ""}`}>
          {url ? (
            <video
              ref={vRef}
              src={url}
              playsInline
              muted
              preload="metadata"
              className="size-full object-cover"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => { setPlaying(false); setProgress(0); aRef.current?.pause(); }}
              onTimeUpdate={(e) => { const v = e.currentTarget; setProgress(v.duration && isFinite(v.duration) ? v.currentTime / v.duration : v.currentTime / Math.max(1, secs)); }}
            />
          ) : (
            <div className="size-full grid place-items-center"><Loader2 className="size-5 animate-spin" /></div>
          )}
        </div>
        {!playing && url && (
          <span className="absolute inset-0 z-20 grid place-items-center">
            <span className="size-12 rounded-full glass-strong grid place-items-center"><Play className="size-5 ml-0.5" /></span>
          </span>
        )}
        {secs > 0 && !playing && (
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-[10px] px-2 py-0.5 rounded-full glass-strong tabular-nums">
            0:{String(secs).padStart(2, "0")}
          </span>
        )}
      </button>
      {song && (
        <div className="flex items-center gap-1.5 text-[11px] opacity-80 max-w-[200px]">
          <Music2 className={`size-3 shrink-0 ${playing ? "animate-pulse" : ""}`} />
          <span className="truncate">{song.title} · {song.artist}</span>
        </div>
      )}
    </div>
  );
}
