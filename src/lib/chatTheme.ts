export type ChatThemeId =
  | "velvet"
  | "sunset"
  | "midnight"
  | "sakura"
  | "forest"
  | "mono"
  | "ocean"
  | "gilded";

export const CHAT_THEMES: { id: ChatThemeId; name: string; swatch: string[] }[] = [
  { id: "velvet", name: "Velvet", swatch: ["#1a1017", "#3b2030", "#e8a0b8"] },
  { id: "sunset", name: "Sunset", swatch: ["#2a1a10", "#4a2b18", "#f5a55c"] },
  { id: "midnight", name: "Midnight", swatch: ["#0f131f", "#1d2438", "#7fa8f0"] },
  { id: "sakura", name: "Sakura", swatch: ["#2a1520", "#3f2333", "#f6a8c8"] },
  { id: "forest", name: "Forest", swatch: ["#101c16", "#1d3128", "#7fd6a0"] },
  { id: "mono", name: "Mono", swatch: ["#141414", "#2b2b2b", "#d9d9d9"] },
  { id: "ocean", name: "Ocean", swatch: ["#0d1a1f", "#173038", "#67d3d8"] },
  { id: "gilded", name: "Gilded", swatch: ["#1a1610", "#2f2718", "#e6c477"] },
];

const key = (peerId: string) => `pandacine:chat-theme:${peerId}`;
export const CHAT_THEME_EVENT = "pandacine:chat-theme";

export function getChatTheme(peerId: string): ChatThemeId {
  if (typeof window === "undefined") return "velvet";
  try {
    const v = window.localStorage.getItem(key(peerId));
    if (v && CHAT_THEMES.some((t) => t.id === v)) return v as ChatThemeId;
  } catch {
    /* storage unavailable */
  }
  return "velvet";
}

export function setChatTheme(peerId: string, theme: ChatThemeId) {
  try {
    window.localStorage.setItem(key(peerId), theme);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(CHAT_THEME_EVENT, { detail: { peerId, theme } }));
}
