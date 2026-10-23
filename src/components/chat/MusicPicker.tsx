import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Play, Pause, X, Music2, Loader2, Check } from "lucide-react";
import { searchSongs, type SongPick } from "@/lib/music.functions";
import { MusicTrimmer } from "./MusicTrimmer";

export function MusicPicker({
  open,
  onClose,
  onPick,
  title = "Share a song",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (song: SongPick) => void;
  title?: string;
}) {
  const search = useServerFn(searchSongs);
  const [q, setQ] = useState("");
  const [songs, setSongs] = useState<SongPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trimming, setTrimming] = useState<SongPick | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search({ data: { q } });
        setSongs(r.songs);
        setErr(r.error ?? null);
      } catch {
        setErr("Music search is unavailable right now.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      setPlaying(null);
      setTrimming(null);
    }
  }, [open]);

  function toggle(s: SongPick) {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (playing === s.id) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = s.preview_url;
    a.currentTime = 0;
    a.play().catch(() => {});
    a.onended = () => setPlaying(null);
    setPlaying(s.id);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass-strong w-full sm:max-w-md max-h-[80vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Music2 className="size-4 text-petal" />
          <p className="font-display text-lg flex-1">{title}</p>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-full hover:bg-candle/10" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {trimming ? (
          <MusicTrimmer song={trimming} onBack={() => setTrimming(null)} onDone={(t) => { setTrimming(null); onPick(t); }} />
        ) : (<>
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-full ring-1 ring-candle/10 bg-candle/[0.04] px-3">
            <Search className="size-4 text-candle-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search songs or artists"
              className="flex-1 bg-transparent py-2.5 text-sm focus:outline-none"
            />
            {loading && <Loader2 className="size-4 animate-spin text-candle-muted" />}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {err && <p className="text-sm text-candle-muted text-center py-6">{err}</p>}
          {!err && !loading && songs.length === 0 && (
            <p className="text-sm text-candle-muted text-center py-6">No songs found</p>
          )}
          {songs.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-candle/[0.05]">
              <button
                onClick={() => toggle(s)}
                className="relative size-12 rounded-xl overflow-hidden shrink-0 bg-candle/10"
                aria-label={playing === s.id ? "Pause preview" : "Play preview"}
              >
                {s.artwork && <img src={s.artwork} alt="" className="size-full object-cover" loading="lazy" />}
                <span className="absolute inset-0 grid place-items-center bg-background/40">
                  {playing === s.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{s.title}</p>
                <p className="text-xs text-candle-muted truncate">{s.artist}</p>
              </div>
              <button
                onClick={() => { audioRef.current?.pause(); setPlaying(null); setTrimming(s); }}
                className="size-9 rounded-full bg-petal text-velvet grid place-items-center shrink-0"
                aria-label={`Choose ${s.title}`}
              >
                <Check className="size-4" />
              </button>
            </div>
          ))}
        </div>
        </>)}
      </div>
    </div>
  );
}
