import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHAT_THEMES, type ChatThemeId, getChatTheme, setChatTheme } from "@/lib/chatTheme";

/** Reads the per-chat theme for a peer/room and keeps it in sync across the tab. */
export function useChatTheme(peerId: string): ChatThemeId {
  const [theme, setTheme] = useState<ChatThemeId>("velvet");

  useEffect(() => {
    setTheme(getChatTheme(peerId));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { peerId?: string; theme?: ChatThemeId } | undefined;
      if (detail?.peerId === peerId && detail.theme) setTheme(detail.theme);
    };
    window.addEventListener("pandacine:chat-theme", onChange);
    return () => window.removeEventListener("pandacine:chat-theme", onChange);
  }, [peerId]);

  return theme;
}

export function ChatThemePicker({
  peerId,
  open,
  onOpenChange,
}: {
  peerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const active = useChatTheme(peerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-velvet border-candle/15 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif italic text-[22px] text-candle flex items-center gap-2">
            <Palette className="size-4 text-petal" strokeWidth={1.5} /> Chat theme
          </DialogTitle>
        </DialogHeader>
        <p className="text-[11px] uppercase tracking-[0.18em] text-candle/40 -mt-2">
          Applies to this conversation only
        </p>
        <div className="grid grid-cols-2 gap-3 pt-2">
          {CHAT_THEMES.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setChatTheme(peerId, t.id)}
                className={`group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all ${
                  isActive
                    ? "bg-petal/12 ring-1 ring-petal/50"
                    : "bg-candle/[0.04] hover:bg-candle/[0.08] ring-1 ring-transparent"
                }`}
              >
                <span className="flex -space-x-2 shrink-0">
                  {t.swatch.map((c, i) => (
                    <span
                      key={i}
                      className="size-6 rounded-full ring-1 ring-black/30"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span className="flex-1 min-w-0 text-[13px] text-candle truncate">{t.name}</span>
                {isActive && <Check className="size-4 text-petal shrink-0" strokeWidth={2} />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
