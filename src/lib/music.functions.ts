import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SongPick = {
  id: number;
  title: string;
  artist: string;
  artwork: string | null;
  preview_url: string;
  link: string | null;
};

/** Searches songs with 30-second previews (Apple Music public catalog). */
export const searchSongs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ q: z.string().max(100) }).parse(input))
  .handler(async ({ data }): Promise<{ songs: SongPick[]; error?: string }> => {
    const q = data.q.trim() || "top hits love";
    try {
      const url = `https://itunes.apple.com/search?entity=song&limit=25&term=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) return { songs: [], error: "Music search is unavailable right now." };
      const j = (await res.json()) as { results?: any[] };
      const songs = (j.results ?? [])
        .filter((r) => r.previewUrl)
        .map((r) => ({
          id: Number(r.trackId),
          title: String(r.trackName ?? "Untitled"),
          artist: String(r.artistName ?? ""),
          artwork: r.artworkUrl100 ? String(r.artworkUrl100).replace("100x100", "300x300") : null,
          preview_url: String(r.previewUrl),
          link: r.trackViewUrl ?? null,
        }));
      return { songs };
    } catch (e) {
      console.error("[searchSongs]", e);
      return { songs: [], error: "Music search is unavailable right now." };
    }
  });
