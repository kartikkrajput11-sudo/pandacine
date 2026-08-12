import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CircleDot, RefreshCw, Send, Square, X, Zap, ZapOff } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Mode = "photo" | "video";

/**
 * In-chat live camera. Captures a photo or a short video from the device camera
 * and hands the resulting File back so the composer can upload + send it.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, kind: "image" | "video") => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [mode, setMode] = useState<Mode>("photo");
  const [mirror, setMirror] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ url: string; file: File; kind: "image" | "video" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Start / restart the stream whenever the dialog opens or the camera flips.
  // Audio is requested separately (and optionally) so a denied microphone never
  // kills the camera preview — video recording just falls back to silent.
  useEffect(() => {
    if (!open || preview) return;
    let cancelled = false;
    (async () => {
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (cancelled) mic.getTracks().forEach((t) => t.stop());
          else mic.getAudioTracks().forEach((t) => stream.addTrack(t));
        } catch {
          /* no mic / denied — keep video only */
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setError(null);
        setMirror(facing === "user");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setError(
          e?.name === "NotAllowedError"
            ? "Camera permission denied. Allow access in your browser settings to capture."
            : "No camera available on this device.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, facing, preview, stop]);


  useEffect(() => {
    if (!open) {
      stop();
      setPreview((p) => {
        if (p) URL.revokeObjectURL(p.url);
        return null;
      });
      setRecording(false);
      setElapsed(0);
    }
  }, [open, stop]);

  function snapPhoto() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `pandacine-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPreview({ url: URL.createObjectURL(blob), file, kind: "image" });
        stop();
      },
      "image/jpeg",
      0.92,
    );
  }

  function pickMime(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
    ];
    return candidates.find((c) => MediaRecorder.isTypeSupported(c));
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    if (typeof MediaRecorder === "undefined") {
      toast.error("Video recording isn't supported in this browser");
      return;
    }
    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      // Some browsers reject any explicit mimeType — fall back to the default.
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      try {
        rec = new MediaRecorder(stream);
      } catch {
        toast.error("Couldn't start recording on this device");
        return;
      }
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onerror = () => {
      toast.error("Recording failed");
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (blob.size === 0) {
        toast.error("Nothing was recorded — try holding a moment longer");
        return;
      }
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `pandacine-${Date.now()}.${ext}`, { type });
      setPreview({ url: URL.createObjectURL(blob), file, kind: "video" });
      stop();
    };
    // Timeslice keeps chunks flowing so short clips are never empty.
    rec.start(500);
    recorderRef.current = rec;
    setRecording(true);
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        if (next >= 60) stopRecording();
        return next;
      });
    }, 1000);
  }


  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setElapsed(0);
  }

  function send() {
    if (!preview) return;
    onCapture(preview.file, preview.kind);
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    stop();
    onClose();
    toast.success(preview.kind === "image" ? "Photo sent" : "Video sent");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[92dvh] p-0 overflow-hidden bg-black border-border flex flex-col">
        <div className="relative min-h-0 flex-1 aspect-[3/4] max-h-[62dvh] bg-black">
          {error ? (
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              <div>
                <Camera className="size-8 mx-auto text-candle-muted" />
                <p className="mt-3 text-sm text-candle-muted">{error}</p>
              </div>
            </div>
          ) : preview ? (
            preview.kind === "image" ? (
              <img src={preview.url} alt="Captured photo preview" className="absolute inset-0 size-full object-cover" />
            ) : (
              <video src={preview.url} controls playsInline className="absolute inset-0 size-full object-cover" />
            )
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 size-full object-cover ${mirror ? "-scale-x-100" : ""}`}
            />
          )}

          <button
            onClick={onClose}
            aria-label="Close camera"
            className="absolute top-3 left-3 size-9 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white"
          >
            <X className="size-4" />
          </button>

          {recording && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-white text-xs">
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
            </div>
          )}

          {!preview && !error && (
            <button
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              aria-label="Flip camera"
              className="absolute top-3 right-3 size-9 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white"
            >
              <RefreshCw className="size-4" />
            </button>
          )}
        </div>

        <div className="shrink-0 p-4 bg-ink space-y-3">
          {preview ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="quiet" onClick={retake}>
                Retake
              </Button>
              <Button onClick={send}>
                <Send className="size-4" /> Send
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-2">
                {(["photo", "video"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => !recording && setMode(m)}
                    className={`rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.2em] transition ${
                      mode === m ? "bg-petal/15 text-petal" : "text-candle-muted"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => setMirror((v) => !v)}
                  aria-label="Toggle mirror"
                  className="size-10 rounded-full border border-border grid place-items-center text-candle-muted"
                >
                  {mirror ? <Zap className="size-4" /> : <ZapOff className="size-4" />}
                </button>
                <button
                  disabled={!!error}
                  onClick={() => (mode === "photo" ? snapPhoto() : recording ? stopRecording() : startRecording())}
                  aria-label={mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Start recording"}
                  className="size-16 rounded-full border-4 border-white/80 grid place-items-center disabled:opacity-40"
                >
                  {mode === "video" ? (
                    recording ? (
                      <Square className="size-6 fill-rose-500 text-rose-500" />
                    ) : (
                      <CircleDot className="size-8 text-rose-400" />
                    )
                  ) : (
                    <span className="size-12 rounded-full bg-white" />
                  )}
                </button>
                <span className="size-10" />
              </div>
              <p className="text-center text-[11px] text-candle-muted">
                {mode === "photo" ? "Tap to capture" : "Hold a moment — up to 60 seconds"}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
