import { supabase } from "@/integrations/supabase/client";

export type ChatThemeId =
  | "velvet"
  | "sunset"
  | "midnight"
  | "sakura"
  | "forest"
  | "mono"
  | "ocean"
  | "gilded"
  | "romance"
  | "photo";

export const CHAT_THEMES: {
  id: ChatThemeId;
  name: string;
  note?: string;
  swatch: string[];
}[] = [
  { id: "velvet", name: "Velvet", swatch: ["#1a1017", "#3b2030", "#e8a0b8"] },
  { id: "romance", name: "Romance", note: "Live", swatch: ["#22101c", "#4a1b32", "#ff9ec4"] },
  { id: "sunset", name: "Sunset", swatch: ["#2a1a10", "#4a2b18", "#f5a55c"] },
  { id: "midnight", name: "Midnight", swatch: ["#0f131f", "#1d2438", "#7fa8f0"] },
  { id: "sakura", name: "Sakura", swatch: ["#2a1520", "#3f2333", "#f6a8c8"] },
  { id: "forest", name: "Forest", swatch: ["#101c16", "#1d3128", "#7fd6a0"] },
  { id: "ocean", name: "Ocean", swatch: ["#0d1a1f", "#173038", "#67d3d8"] },
  { id: "gilded", name: "Gilded", swatch: ["#1a1610", "#2f2718", "#e6c477"] },
  { id: "mono", name: "Mono", swatch: ["#141414", "#2b2b2b", "#d9d9d9"] },
];

export const CHAT_THEME_EVENT = "pandacine:chat-theme";
export const CHAT_WALLPAPER_BUCKET = "chat-wallpapers";

export type ChatThemeRecord = {
  theme: ChatThemeId;
  photoPath: string | null;
  glow: boolean;
};

export const DEFAULT_CHAT_THEME: ChatThemeRecord = { theme: "velvet", photoPath: null, glow: true };

/** Deterministic key shared by both participants of a DM. */
export function pairKey(a: string, b: string) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

const cacheKey = (peerId: string) => `pandacine:chat-theme-v2:${peerId}`;

export function emitChatTheme(peerId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_THEME_EVENT, { detail: { peerId } }));
}

/** Last known theme for instant paint before the shared record loads. */
export function readCachedChatTheme(peerId: string): ChatThemeRecord {
  if (typeof window === "undefined") return DEFAULT_CHAT_THEME;
  try {
    const raw = window.localStorage.getItem(cacheKey(peerId));
    if (!raw) return DEFAULT_CHAT_THEME;
    const parsed = JSON.parse(raw) as Partial<ChatThemeRecord>;
    return {
      theme: (parsed.theme as ChatThemeId) ?? "velvet",
      photoPath: parsed.photoPath ?? null,
      glow: parsed.glow !== false,
    };
  } catch {
    return DEFAULT_CHAT_THEME;
  }
}

export function writeCachedChatTheme(peerId: string, rec: ChatThemeRecord) {
  try {
    window.localStorage.setItem(cacheKey(peerId), JSON.stringify(rec));
  } catch {
    /* storage unavailable */
  }
}

/** Fetch the shared, cross-device theme for this conversation. */
export async function fetchChatTheme(peerId: string): Promise<ChatThemeRecord | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("dm_chat_themes")
    .select("theme, photo_path, glow")
    .eq("pair_key", pairKey(uid, peerId))
    .maybeSingle();
  if (error || !data) return null;
  return {
    theme: (data.theme as ChatThemeId) ?? "velvet",
    photoPath: data.photo_path ?? null,
    glow: data.glow !== false,
  };
}

/** Upsert the shared theme so both people (and every device) see the same chat. */
export async function saveChatTheme(peerId: string, patch: Partial<ChatThemeRecord>) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const current = (await fetchChatTheme(peerId)) ?? readCachedChatTheme(peerId);
  const next: ChatThemeRecord = { ...current, ...patch };

  writeCachedChatTheme(peerId, next);
  emitChatTheme(peerId);

  const a = uid < peerId ? uid : peerId;
  const b = uid < peerId ? peerId : uid;
  const { error } = await supabase.from("dm_chat_themes").upsert(
    {
      pair_key: pairKey(uid, peerId),
      user_a: a,
      user_b: b,
      theme: next.theme,
      photo_path: next.photoPath,
      glow: next.glow,
      updated_by: uid,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "pair_key" },
  );
  if (error) throw error;
  return next;
}

export const setChatTheme = (peerId: string, theme: ChatThemeId) => saveChatTheme(peerId, { theme });
export const setChatPhotoPath = (peerId: string, photoPath: string | null) =>
  saveChatTheme(peerId, { photoPath });
export const setChatPhotoGlow = (peerId: string, glow: boolean) => saveChatTheme(peerId, { glow });
