import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Play,
  Pause,
  X,
  Music2,
  Loader2,
  Check,
  Clock,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { searchSongs, type SongPick } from "@/lib/music.functions";

const RECENT_SONGS_KEY = "pandacine.music.recentSongs";
const RECENT_SEARCHES_KEY = "pandacine.music.recentSearches";

const SUGGESTIONS: { label: string; query: string }[] = [
  { label: "Love songs", query: "love" },
  { label: "Chill", query: "chill lofi" },
  { label: "Party", query: "party hits" },
  { label: "Romantic", query: "romantic" },
  { label: "Throwbacks", query: "2000s hits" },
  { label: "Focus", query: "instrumental focus" },
  { label: "Happy", query: "feel good" },
  { label: "Bollywood", query: "bollywood" },
];

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — recents are optional */
  }
}

export function rememberSongPick(song: SongPick) {
  const list = loadJson<SongPick[]>(RECENT_SONGS_KEY, []);
  const next = [song, ...list.filter((s) => s.id !== song.id)].slice(0, 8);
  saveJson(RECENT_SONGS_KEY, next);
}

function rememberSearch(q: string) {
  const t = q.trim();
  if (!t) return;
  const list = loadJson<string[]>(RECENT_SEARCHES_KEY, []);
  const next = [t, ...list.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 6);
  saveJson(RECENT_SEARCHES_KEY, next);
}

/** Browser-side fallback: the song catalog allows cross-origin requests. */
async function searchSongsDirect(q: string): Promise<SongPick[]> {
  const term = q.trim() || "top hits love";
  const url = `https://itunes.apple.com/search?entity=song&limit=25&term=${encodeURIComponent(term)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const j = (await res.json()) as { results?: any[] };
  return (j.results ?? [])
    .filter((r) => r.previewUrl)
    .map((r) => ({
      id: Number(r.trackId),
      title: String(r.trackName ?? "Untitled"),
      artist: String(r.artistName ?? ""),
      artwork: r.artworkUrl100 ? String(r.artworkUrl100).replace("100x100", "300x300") : null,
      preview_url: String(r.previewUrl),
      link: r.trackViewUrl ?? null,
    }));
}

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
  const [recentSongs, setRecentSongs] = useState<SongPick[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const idle = q.trim().length === 0;

  useEffect(() => {
    if (!open) return;
    setRecentSongs(loadJson<SongPick[]>(RECENT_SONGS_KEY, []));
    setRecentSearches(loadJson<string[]>(RECENT_SEARCHES_KEY, []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search({ data: { q } });
        if (r.error && r.songs.length === 0) throw new Error(r.error);
        setSongs(r.songs);
        setErr(null);
      } catch {
        // Server search unavailable (e.g. static preview) — ask the catalog directly.
        try {
          const direct = await searchSongsDirect(q);
          setSongs(direct);
          setErr(null);
        } catch {
          setSongs([]);
          setErr("Music search is unavailable right now.");
        }
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

  function pick(s: SongPick) {
    audioRef.current?.pause();
    setPlaying(null);
    rememberSongPick(s);
    if (!idle) rememberSearch(q);
    onPick(s);
  }

  const suggestionChips = useMemo(() => SUGGESTIONS, []);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full sm:max-w-md max-h-[82vh] rounded-t-[28px] sm:rounded-[28px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — quiet, editorial */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight">{title}</p>
            <p className="text-[11px] text-candle-muted tracking-wide mt-0.5">
              30-second previews · tap to listen
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-9 grid place-items-center rounded-full text-candle-muted hover:text-candle hover:bg-candle/[0.06] transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search — single soft pill, no rings */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2.5 rounded-full bg-candle/[0.05] px-4 transition-colors focus-within:bg-candle/[0.08]">
            <Search className="size-4 text-candle-muted shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search songs or artists"
              className="flex-1 bg-transparent py-3 text-sm focus:outline-none placeholder:text-candle-muted/60"
            />
            {loading ? (
              <Loader2 className="size-4 animate-spin text-candle-muted shrink-0" />
            ) : q ? (
              <button
                onClick={() => setQ("")}
                className="text-candle-muted hover:text-candle transition-colors shrink-0"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 pb-5 no-scrollbar">
          {idle ? (
            <div className="px-2 pt-1 space-y-6">
              {recentSearches.length > 0 && (
                <section>
                  <SectionLabel icon={<Clock className="size-3" />} label="Recent searches" />
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((s) => (
                      <button
                        key={s}
                        onClick={() => setQ(s)}
                        className="rounded-full border border-candle/10 px-3.5 py-1.5 text-xs text-candle/80 hover:border-petal/40 hover:text-candle transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {recentSongs.length > 0 && (
                <section>
                  <SectionLabel icon={<Music2 className="size-3" />} label="Recently shared" />
                  <div className="divide-y divide-candle/[0.06]">
                    {recentSongs.map((s) => (
                      <SongRow
                        key={`recent-${s.id}`}
                        song={s}
                        playing={playing === s.id}
                        onToggle={() => toggle(s)}
                        onPick={() => pick(s)}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <SectionLabel icon={<Sparkles className="size-3" />} label="Suggestions" />
                <div className="flex flex-wrap gap-2">
                  {suggestionChips.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setQ(s.query)}
                      className="rounded-full bg-candle/[0.05] px-3.5 py-1.5 text-xs text-candle/80 hover:bg-petal/15 hover:text-candle transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="pt-1">
              {err && <p className="text-sm text-candle-muted text-center py-10">{err}</p>}
              {!err && !loading && songs.length === 0 && (
                <p className="text-sm text-candle-muted text-center py-10">No songs found</p>
              )}
              {!err && songs.length > 0 && (
                <>
                  <div className="px-2 pb-1">
                    <SectionLabel icon={<TrendingUp className="size-3" />} label="Results" />
                  </div>
                  <div className="divide-y divide-candle/[0.06]">
                    {songs.map((s) => (
                      <SongRow
                        key={s.id}
                        song={s}
                        playing={playing === s.id}
                        onToggle={() => toggle(s)}
                        onPick={() => pick(s)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-candle-muted/80 mb-2.5">
      {icon}
      {label}
    </p>
  );
}

function SongRow({
  song,
  playing,
  onToggle,
  onPick,
}: {
  song: SongPick;
  playing: boolean;
  onToggle: () => void;
  onPick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-candle/[0.04] transition-colors">
      <button
        onClick={onToggle}
        className="relative size-12 rounded-xl overflow-hidden shrink-0 bg-candle/10"
        aria-label={playing ? "Pause preview" : "Play preview"}
      >
        {song.artwork && (
          <img src={song.artwork} alt="" className="size-full object-cover" loading="lazy" />
        )}
        <span
          className={`absolute inset-0 grid place-items-center transition-colors ${
            playing ? "bg-background/50" : "bg-background/30 opacity-0 hover:opacity-100"
          }`}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{song.title}</p>
        <p className="text-xs text-candle-muted truncate">{song.artist}</p>
      </div>
      <button
        onClick={onPick}
        className="size-9 rounded-full border border-petal/40 text-petal grid place-items-center shrink-0 hover:bg-petal hover:text-velvet transition-colors"
        aria-label={`Choose ${song.title}`}
      >
        <Check className="size-4" />
      </button>
    </div>
  );
}
