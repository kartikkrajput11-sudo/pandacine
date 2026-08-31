import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const RATIOS = [
  { id: "tall", label: "Phone", value: 9 / 19.5 },
  { id: "portrait", label: "Portrait", value: 3 / 4 },
  { id: "square", label: "Square", value: 1 },
  { id: "wide", label: "Desktop", value: 16 / 10 },
] as const;

type Props = {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
  busy?: boolean;
};

/**
 * Pan / zoom / aspect crop for chat wallpapers so a photo frames correctly on
 * whatever screen the conversation is opened on.
 */
export function WallpaperCropper({ file, onCancel, onConfirm, busy }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState<number>(RATIOS[0].value);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; id: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      setImg(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const confirm = useCallback(async () => {
    const frame = frameRef.current;
    if (!img || !frame) return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;

    // Displayed image geometry inside the frame (object-fit: cover + transform).
    const base = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
    const scale = base * zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = (fw - dw) / 2 + offset.x;
    const dy = (fh - dh) / 2 + offset.y;

    const OUT_W = Math.min(1600, Math.round(Math.max(900, fw * 2)));
    const out = document.createElement("canvas");
    out.width = OUT_W;
    out.height = Math.round(OUT_W * (fh / fw));
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const k = out.width / fw;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx * k, dy * k, dw * k, dh * k);

    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/jpeg", 0.92));
    if (blob) await onConfirm(blob);
  }, [img, zoom, offset, onConfirm]);

  return (
    <Dialog open={!!file} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="bg-velvet border-candle/15 max-w-md p-0 overflow-hidden">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="font-serif italic text-[22px] text-candle flex items-center gap-2">
              <Maximize2 className="size-4 text-petal" strokeWidth={1.5} /> Frame your wallpaper
            </DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-candle/40">
            Drag to position · pinch or slide to zoom
          </p>
        </div>

        <div className="px-6 pt-4">
          <div className="mx-auto w-full max-w-[260px]">
            <div
              ref={frameRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ aspectRatio: String(ratio) }}
              className="relative w-full overflow-hidden rounded-2xl ring-1 ring-candle/15 bg-surface/60 touch-none cursor-grab active:cursor-grabbing"
            >
              {src && (
                <img
                  src={src}
                  alt="Wallpaper preview"
                  draggable={false}
                  className="absolute inset-0 size-full object-cover select-none"
                  style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="border border-candle/10" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pt-4 space-y-4">
          <div className="flex gap-2">
            {RATIOS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRatio(r.value);
                  reset();
                }}
                className={`flex-1 rounded-xl py-2 text-[11px] transition-colors ${
                  ratio === r.value
                    ? "bg-petal/15 text-petal ring-1 ring-petal/40"
                    : "bg-candle/[0.05] text-candle/60 hover:text-candle"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-candle/40">Zoom</span>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
              className="flex-1"
            />
            <button
              type="button"
              onClick={reset}
              aria-label="Reset framing"
              className="rounded-lg p-1.5 text-candle/50 hover:text-petal transition-colors"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 p-6 pt-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-candle/[0.05] py-2.5 text-[12.5px] text-candle/70 hover:text-candle transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !img}
            onClick={() => void confirm()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-petal/20 hover:bg-petal/30 py-2.5 text-[12.5px] text-petal transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />} Set wallpaper
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
