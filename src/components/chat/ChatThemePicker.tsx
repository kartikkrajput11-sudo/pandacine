import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Palette, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  CHAT_THEMES,
  CHAT_WALLPAPER_BUCKET,
  pairKey,
  saveChatTheme,
  setChatPhotoGlow,
  setChatTheme,
} from "@/lib/chatTheme";
import { ChatAmbience, useChatThemeState, useWallpaperUrl } from "@/components/chat/ChatAmbience";
import { WallpaperCropper } from "@/components/chat/WallpaperCropper";

export { useChatThemeState } from "@/components/chat/ChatAmbience";

export function ChatThemePicker({
  peerId,
  open,
  onOpenChange,
}: {
  peerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const state = useChatThemeState(peerId);
  const previewUrl = useWallpaperUrl(state.photoPath);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function pick(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image");
    if (file.size > 10 * 1024 * 1024) return toast.error("Image must be under 10 MB");
    setPending(file);
  }

  async function upload(blob: Blob) {
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      // Shared folder so both people in the chat can read the same wallpaper.
      const path = `${pairKey(uid, peerId)}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from(CHAT_WALLPAPER_BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const old = state.photoPath;
      await saveChatTheme(peerId, { photoPath: path, theme: "photo" });
      if (old && old !== path) {
        await supabase.storage.from(CHAT_WALLPAPER_BUCKET).remove([old]);
      }
      setPending(null);
      toast.success("Wallpaper set for both of you");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    const old = state.photoPath;
    try {
      await saveChatTheme(peerId, {
        photoPath: null,
        ...(state.theme === "photo" ? { theme: "romance" as const } : {}),
      });
      if (old) await supabase.storage.from(CHAT_WALLPAPER_BUCKET).remove([old]);
      toast.success("Wallpaper removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove wallpaper");
    }
  }


  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-group-theme={state.theme}
        className="bg-velvet border-candle/15 max-w-md p-0 overflow-hidden"
      >
        <div className="relative">
          <div className="absolute inset-0 opacity-70">
            <ChatAmbience state={state} />
          </div>
          <div className="relative px-6 pt-6 pb-5">
            <DialogHeader>
              <DialogTitle className="font-serif italic text-[23px] text-candle flex items-center gap-2">
                <Palette className="size-4 text-petal" strokeWidth={1.5} /> Chat atmosphere
              </DialogTitle>
            </DialogHeader>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-candle/40">
              Shared with them — synced on every device
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5 max-h-[62vh] overflow-y-auto no-scrollbar">
          {/* Custom photo */}
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-candle/40">Your photo</h3>
            <div className="rounded-2xl overflow-hidden ring-1 ring-candle/10">
              <div
                className="relative h-28 bg-cover bg-center bg-surface/60"
                style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
              >
                {!previewUrl && (
                  <div className="absolute inset-0 grid place-items-center text-[11px] text-candle/35">
                    No photo yet
                  </div>
                )}
                {state.theme === "photo" && (
                  <span className="absolute top-2 left-2 rounded-full bg-black/45 backdrop-blur px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-candle">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 p-2 bg-candle/[0.04]">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-petal/15 hover:bg-petal/25 text-petal text-[12px] py-2 transition-colors disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                  {previewUrl ? "Replace photo" : "Upload photo"}
                </button>
                {previewUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => void setChatTheme(peerId, "photo").catch(() => {})}
                      className="rounded-xl px-3 py-2 text-[12px] text-candle/70 hover:text-candle bg-candle/[0.05] transition-colors"
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => void removePhoto()}
                      aria-label="Remove wallpaper"
                      className="rounded-xl p-2 text-candle/50 hover:text-petal bg-candle/[0.05] transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-2xl bg-candle/[0.04] px-3.5 py-3">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] text-candle">
                  <Sparkles className="size-3.5 text-petal" /> Live love layer
                </span>
                <span className="block text-[10.5px] text-candle/40 mt-0.5">
                  Drifting hearts &amp; warm bloom over your photo
                </span>
              </span>
              <Switch checked={state.glow} onCheckedChange={(v) => void setChatPhotoGlow(peerId, v).catch(() => {})} />
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pick(f);
              }}
            />
          </section>

          {/* Palettes */}
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-candle/40">Palettes</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {CHAT_THEMES.map((t) => {
                const isActive = t.id === state.theme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void setChatTheme(peerId, t.id).catch(() => {})}
                    className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${
                      isActive
                        ? "bg-petal/12 ring-1 ring-petal/50"
                        : "bg-candle/[0.04] hover:bg-candle/[0.08] ring-1 ring-transparent"
                    }`}
                  >
                    <span className="flex -space-x-2 shrink-0">
                      {t.swatch.map((c, i) => (
                        <span key={i} className="size-5 rounded-full ring-1 ring-black/30" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px] text-candle truncate">{t.name}</span>
                      {t.note && (
                        <span className="block text-[9px] uppercase tracking-[0.18em] text-petal/80">{t.note}</span>
                      )}
                    </span>
                    {isActive && <Check className="size-4 text-petal shrink-0" strokeWidth={2} />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
      <WallpaperCropper
        file={pending}
        busy={uploading}
        onCancel={() => {
          setPending(null);
          if (fileRef.current) fileRef.current.value = "";
        }}
        onConfirm={(blob) => upload(blob)}
      />
    </>
  );
}
