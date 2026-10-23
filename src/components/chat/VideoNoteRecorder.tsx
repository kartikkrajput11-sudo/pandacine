import { useEffect, useRef, useState } from "react";
import { X, Music2, SwitchCamera, Send, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadChatMedia } from "@/lib/chat";
import { MusicPicker } from "./MusicPicker";
import type { SongPick } from "@/lib/music.functions";

const MAX_MS = 60_000;

function pickMime() {
  const c = [
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
    { mime: "video/mp4", ext: "mp4" },
  ];
  const MR: any = (window as any).MediaRecorder;
  for (const x of c) if (MR?.isTypeSupported?.(x.mime)) return x;
  return { mime: "", ext: "mp4" };
}

export function VideoNoteRecorder({
  open,
  userId,
  onClose,
  onSend,
}: {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSend: (path: string, durationMs: number, song: SongPick | null) => Promise<void>;
}) {
  const liveRef = useRef<HTMLVideoElement | null>(null);
  const reviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startAt = useRef(0);
  const rafRef = useRef<number | null>(null);
  const songAudio = useRef<HTMLAudioElement | null>(null);
  const mimeRef = useRef(pickMime());

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [song, setSong] = useState<SongPick | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function startCamera(f = facing) {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: f, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = s;
      if (liveRef.current) {
        liveRef.current.srcObject = s;
        liveRef.current.play().catch(() => {});
      }
    } catch {
      toast.error("Allow camera and microphone to record a video note");
      onClose();
    }
  }

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { recRef.current?.state === "recording" && recRef.current.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    songAudio.current?.pause();
  }

  useEffect(() => {
    if (!open) return;
    setBlob(null); setReviewUrl(null); setElapsed(0); setSong(null);
    startCamera();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => { if (reviewUrl) URL.revokeObjectURL(reviewUrl); }, [reviewUrl]);

  function playSong(fromStart = true) {
    if (!song) return;
    if (!songAudio.current) songAudio.current = new Audio();
    const a = songAudio.current;
    if (a.src !== song.preview_url) a.src = song.preview_url;
    if (fromStart) a.currentTime = 0;
    a.volume = 0.45;
    a.play().catch(() => {});
  }

  function start() {
    const s = streamRef.current;
    if (!s || recording) return;
    chunks.current = [];
    const opts = mimeRef.current.mime ? { mimeType: mimeRef.current.mime } : undefined;
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(s, opts); } catch { rec = new MediaRecorder(s); }
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      const ms = Date.now() - startAt.current;
      const b = new Blob(chunks.current, { type: rec.mimeType || mimeRef.current.mime || "video/mp4" });
      setDuration(ms);
      setBlob(b);
      setReviewUrl(URL.createObjectURL(b));
      songAudio.current?.pause();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    recRef.current = rec;
    rec.start(250);
    startAt.current = Date.now();
    setRecording(true);
    playSong(true);
    const tick = () => {
      const e = Date.now() - startAt.current;
      setElapsed(e);
      if (e >= MAX_MS) { stop(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRecording(false);
    if (Date.now() - startAt.current < 700) {
      toast.message("Hold a little longer to record");
    }
    try { recRef.current?.stop(); } catch {}
  }

  function retake() {
    setBlob(null); setReviewUrl(null); setElapsed(0);
    startCamera();
  }

  async function send() {
    if (!blob) return;
    setBusy(true);
    try {
      const path = await uploadChatMedia(blob, userId, "video", mimeRef.current.ext);
      await onSend(path, duration, song);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send video note");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const pct = Math.min(1, elapsed / MAX_MS);
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-[70] bg-background/85 backdrop-blur-xl flex flex-col items-center justify-center gap-6 animate-fade-in">
      <button onClick={() => { cleanup(); onClose(); }} className="absolute top-4 right-4 size-10 rounded-full glass grid place-items-center" aria-label="Close">
        <X className="size-5" />
      </button>

      <div className="relative size-[min(78vw,340px)]">
        <svg viewBox="0 0 100 100" className="absolute -inset-3 size-[calc(100%+1.5rem)] -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--candle)" strokeOpacity="0.12" strokeWidth="2" />
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--petal)" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
        </svg>
        <div className={`size-full rounded-full overflow-hidden ring-1 ring-candle/15 bg-velvet transition-transform duration-300 ${recording ? "scale-[1.03]" : ""}`}>
          {reviewUrl ? (
            <video ref={reviewRef} src={reviewUrl} autoPlay loop playsInline
              onPlay={() => playSong(true)}
              className={`size-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
          ) : (
            <video ref={liveRef} muted playsInline autoPlay className={`size-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
          )}
        </div>
        {song && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 glass-strong rounded-full px-3 py-1.5 flex items-center gap-2 max-w-[90%]">
            <Music2 className="size-3.5 text-petal shrink-0" />
            <span className="text-xs truncate">{song.title} · {song.artist}</span>
          </div>
        )}
      </div>

      <p className="text-sm text-candle-muted tabular-nums">
        {recording ? `${(elapsed / 1000).toFixed(1)}s / 60s` : reviewUrl ? "Preview your note" : "Hold the button to record"}
      </p>

      {!reviewUrl ? (
        <div className="flex items-center gap-6">
          <button onClick={() => setMusicOpen(true)} disabled={recording} className="size-12 rounded-full glass grid place-items-center disabled:opacity-40" aria-label="Add music">
            <Music2 className="size-5" />
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); start(); }}
            onPointerUp={stop}
            onPointerLeave={() => recording && stop()}
            onContextMenu={(e) => e.preventDefault()}
            className={`size-20 rounded-full grid place-items-center ring-4 ring-candle/20 transition-all duration-200 select-none touch-none ${recording ? "bg-destructive scale-110" : "bg-petal"}`}
            aria-label="Hold to record"
          >
            <span className={`block bg-background transition-all duration-200 ${recording ? "size-6 rounded-md" : "size-8 rounded-full"}`} />
          </button>
          <button
            onClick={() => { const f = facing === "user" ? "environment" : "user"; setFacing(f); startCamera(f); }}
            disabled={recording}
            className="size-12 rounded-full glass grid place-items-center disabled:opacity-40"
            aria-label="Switch camera"
          >
            <SwitchCamera className="size-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <button onClick={retake} disabled={busy} className="h-12 px-5 rounded-full glass flex items-center gap-2 text-sm">
            <RotateCcw className="size-4" /> Retake
          </button>
          <button onClick={() => setMusicOpen(true)} disabled={busy} className="size-12 rounded-full glass grid place-items-center" aria-label="Change music">
            <Music2 className="size-5" />
          </button>
          <button onClick={send} disabled={busy} className="h-12 px-6 rounded-full bg-petal text-velvet flex items-center gap-2 text-sm font-medium">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send
          </button>
        </div>
      )}

      <MusicPicker
        open={musicOpen}
        title="Add music to your note"
        onClose={() => setMusicOpen(false)}
        onPick={(s) => { setSong(s); setMusicOpen(false); if (reviewUrl) { songAudio.current?.pause(); songAudio.current = null; setTimeout(() => { reviewRef.current && (reviewRef.current.currentTime = 0); }, 0); } }}
      />
    </div>
  );
}
