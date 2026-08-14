import { useEffect, useState } from "react";
import { X, Search, Loader2 } from "lucide-react";

const GIPHY_KEY = "QAcXWFdiICY0nlBDO6uxZ23vGqXtxDvo";

export type GifPick = { url: string; width: number; height: number; title: string };

type GiphyItem = {
  id: string;
  title: string;
  images: { fixed_width: { url: string; width: string; height: string } };
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (gif: GifPick) => void;
};

/** Giphy browser — trending by default, live search as you type. */
export function GifPicker({ open, onClose, onPick }: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GifPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    const t = window.setTimeout(async () => {
      try {
        const base = q.trim()
          ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q.trim())}`
          : "https://api.giphy.com/v1/gifs/trending?";
        const res = await fetch(`${base}&api_key=${GIPHY_KEY}&limit=24&rating=pg-13&bundle=messaging_non_clips`);
        if (!res.ok) throw new Error(`Giphy ${res.status}`);
        const json = (await res.json()) as { data: GiphyItem[] };
        if (!alive) return;
        setItems(
          (json.data ?? []).map((g) => ({
            url: g.images.fixed_width.url,
            width: Number(g.images.fixed_width.width) || 200,
            height: Number(g.images.fixed_width.height) || 200,
            title: g.title || "GIF",
          })),
        );
      } catch (err) {
        console.error("[GifPicker] fetch failed", err);
        if (alive) setError("Couldn't reach GIFs right now");
      } finally {
        if (alive) setLoading(false);
      }
    }, q ? 320 : 0);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [open, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border bg-surface/95 backdrop-blur-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <p className="text-[9px] uppercase tracking-[0.32em] text-candle-muted">GIFs</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-candle-muted/70">via Giphy</span>
            <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-white/5">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-black/10 px-3 py-2">
            <Search className="size-4 text-candle-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search GIFs…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-candle-muted"
            />
          </div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-4 py-3">
          {loading && (
            <div className="grid place-items-center py-10 text-candle-muted">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}
          {!loading && error && <p className="py-10 text-center text-xs text-candle-muted">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="py-10 text-center text-xs text-candle-muted">No GIFs found.</p>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="columns-2 sm:columns-3 gap-2 [column-fill:_balance]">
              {items.map((g) => (
                <button
                  key={g.url}
                  onClick={() => {
                    onPick(g);
                    onClose();
                  }}
                  className="mb-2 block w-full overflow-hidden rounded-xl border border-border/60 hover:border-petal/60 transition-colors"
                >
                  <img src={g.url} alt={g.title} loading="lazy" className="w-full" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
