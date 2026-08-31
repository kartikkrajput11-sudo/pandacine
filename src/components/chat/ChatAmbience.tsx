import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CHAT_THEME_EVENT,
  CHAT_WALLPAPER_BUCKET,
  DEFAULT_CHAT_THEME,
  fetchChatTheme,
  readCachedChatTheme,
  writeCachedChatTheme,
  type ChatThemeRecord,

} from "@/lib/chatTheme";

export type ChatThemeState = ChatThemeRecord;

/**
 * Shared per-conversation theme. Reads the cached value for instant paint, then
 * syncs the record both participants share (and every device they sign in on).
 */
export function useChatThemeState(peerId: string): ChatThemeState {
  const [state, setState] = useState<ChatThemeState>(DEFAULT_CHAT_THEME);

  useEffect(() => {
    let alive = true;
    setState(readCachedChatTheme(peerId));

    const pull = async () => {
      const rec = await fetchChatTheme(peerId);
      if (!alive || !rec) return;
      writeCachedChatTheme(peerId, rec);
      setState(rec);
    };
    void pull();

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { peerId?: string } | undefined;
      if (!detail?.peerId || detail.peerId === peerId) setState(readCachedChatTheme(peerId));
    };
    window.addEventListener(CHAT_THEME_EVENT, onChange);

    const channel = supabase
      .channel(`dm-theme-${peerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_chat_themes" },
        () => void pull(),
      )
      .subscribe();

    return () => {
      alive = false;
      window.removeEventListener(CHAT_THEME_EVENT, onChange);
      void supabase.removeChannel(channel);
    };
  }, [peerId]);

  return state;
}


/** Signed URL for a wallpaper stored in the private bucket. */
export function useWallpaperUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from(CHAT_WALLPAPER_BUCKET)
      .createSignedUrl(path, 60 * 60 * 6)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      })
      .catch(() => {
        if (alive) setUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

function LoveLayer({ intensity = 1 }: { intensity?: number }) {
  const hearts = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i * 1.7) % 18,
        duration: 16 + ((i * 5) % 11),
        scale: 0.5 + ((i * 13) % 9) / 12,
        drift: ((i % 5) - 2) * 26,
      })),
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: intensity }}>
      <div className="chat-love-bloom absolute inset-0" />
      {hearts.map((h, i) => (
        <span
          key={i}
          className="chat-love-heart"
          style={{
            left: `${h.left}%`,
            animationDelay: `-${h.delay}s`,
            animationDuration: `${h.duration}s`,
            ["--drift" as any]: `${h.drift}px`,
            ["--s" as any]: h.scale,
          }}
        >
          <svg viewBox="0 0 24 24" className="size-full">
            <path
              d="M12 21s-7.5-4.7-9.5-9C1.1 8.6 3 5.5 6.2 5.5c1.9 0 3.2 1 3.8 2.2.6-1.2 1.9-2.2 3.8-2.2 3.2 0 5.1 3.1 3.7 6.5-2 4.3-9.5 9-9.5 9z"
              fill="currentColor"
            />
          </svg>
        </span>
      ))}
    </div>
  );
}

/**
 * Background ambience for a conversation: custom photo wallpaper and/or the
 * live romance layer. Sits behind chat content (z-0), never intercepts input.
 */
export function ChatAmbience({ state }: { state: ChatThemeState }) {
  const photoUrl = useWallpaperUrl(state.theme === "photo" ? state.photoPath : null);
  const showPhoto = state.theme === "photo" && !!photoUrl;
  const showLove = state.theme === "romance" || (state.theme === "photo" && state.glow);

  if (state.theme !== "photo" && state.theme !== "romance") return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {showPhoto && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center animate-fade-in"
            style={{ backgroundImage: `url(${photoUrl})` }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in oklab, var(--velvet) 82%, transparent) 0%, color-mix(in oklab, var(--velvet) 62%, transparent) 40%, color-mix(in oklab, var(--velvet) 86%, transparent) 100%)",
            }}
          />
        </>
      )}
      {showLove && <LoveLayer intensity={showPhoto ? 0.7 : 1} />}
    </div>
  );
}
