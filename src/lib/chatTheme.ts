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

const themeKey = (peerId: string) => `pandacine:chat-theme:${peerId}`;
const photoKey = (peerId: string) => `pandacine:chat-photo:${peerId}`;
const glowKey = (peerId: string) => `pandacine:chat-photo-glow:${peerId}`;

export const CHAT_THEME_EVENT = "pandacine:chat-theme";
export const CHAT_WALLPAPER_BUCKET = "chat-wallpapers";

function emit(peerId: string) {
  window.dispatchEvent(new CustomEvent(CHAT_THEME_EVENT, { detail: { peerId } }));
}

export function getChatTheme(peerId: string): ChatThemeId {
  if (typeof window === "undefined") return "velvet";
  try {
    const v = window.localStorage.getItem(themeKey(peerId));
    if (v === "photo") return "photo";
    if (v && CHAT_THEMES.some((t) => t.id === v)) return v as ChatThemeId;
  } catch {
    /* storage unavailable */
  }
  return "velvet";
}

export function setChatTheme(peerId: string, theme: ChatThemeId) {
  try {
    window.localStorage.setItem(themeKey(peerId), theme);
  } catch {
    /* storage unavailable */
  }
  emit(peerId);
}

/** Storage path (inside the chat-wallpapers bucket) of the custom photo for this chat. */
export function getChatPhotoPath(peerId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(photoKey(peerId));
  } catch {
    return null;
  }
}

export function setChatPhotoPath(peerId: string, path: string | null) {
  try {
    if (path) window.localStorage.setItem(photoKey(peerId), path);
    else window.localStorage.removeItem(photoKey(peerId));
  } catch {
    /* storage unavailable */
  }
  emit(peerId);
}

/** Whether the live romantic overlay (drifting hearts + warm bloom) rides on top of the photo. */
export function getChatPhotoGlow(peerId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(glowKey(peerId)) !== "0";
  } catch {
    return true;
  }
}

export function setChatPhotoGlow(peerId: string, on: boolean) {
  try {
    window.localStorage.setItem(glowKey(peerId), on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  emit(peerId);
}
