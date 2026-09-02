// Talking-Tom style voice repeat.
//
// Nothing here ever starts on its own: recording only begins when the user
// explicitly taps the mic (which is also when the browser permission prompt
// appears). The stream is released the moment recording stops.

import { isSfxEnabled } from "./sfx";

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  try {
    const C: Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    return ctx;
  } catch {
    return null;
  }
}

export function micSupported() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined"
  );
}

export type Recording = {
  stop: () => void;
  /** Live 0..1 input level, for the mic ring. */
  level: () => number;
};

/**
 * Records from the mic until `stop()` is called (or maxMs elapses), then hands
 * the clip back through `onClip`. Rejects if permission is denied.
 */
export async function recordVoice(opts: {
  maxMs?: number;
  onClip: (blob: Blob) => void;
  onStop?: () => void;
}): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });

  const rec = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  // Level meter — used purely for the visual ring around the mic.
  let level = 0;
  let raf = 0;
  const c = ac();
  let analyser: AnalyserNode | null = null;
  let src: MediaStreamAudioSourceNode | null = null;
  if (c) {
    try {
      src = c.createMediaStreamSource(stream);
      analyser = c.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]! - 128) / 128);
        level = level * 0.7 + peak * 0.3;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      /* level meter is optional */
    }
  }

  const cleanup = () => {
    cancelAnimationFrame(raf);
    try {
      src?.disconnect();
      analyser?.disconnect();
    } catch {
      /* ignore */
    }
    // Always release the microphone — no silent listening.
    stream.getTracks().forEach((t) => t.stop());
  };

  rec.onstop = () => {
    cleanup();
    opts.onStop?.();
    if (chunks.length) opts.onClip(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
  };

  rec.start();
  const timer = window.setTimeout(() => {
    if (rec.state === "recording") rec.stop();
  }, opts.maxMs ?? 8000);

  return {
    stop: () => {
      window.clearTimeout(timer);
      if (rec.state === "recording") rec.stop();
      else cleanup();
    },
    level: () => level,
  };
}

/**
 * Plays a clip back in the panda's voice: pitched up, slightly wobbly and
 * a touch brighter. Resolves with the playback duration in ms.
 */
export async function playInPandaVoice(blob: Blob, pitch = 1.5): Promise<number> {
  const c = ac();
  if (!c) return 0;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }
  const buf = await c.decodeAudioData(await blob.arrayBuffer());

  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;

  // A tiny vibrato keeps it cartoonish instead of chipmunk-flat.
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 5.5;
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain).connect(src.playbackRate);

  const hp = c.createBiquadFilter();
  hp.type = "highshelf";
  hp.frequency.value = 2200;
  hp.gain.value = 4;

  const gain = c.createGain();
  gain.gain.value = isSfxEnabled() ? 1 : 0.9; // voice replies are the point; never fully muted here

  src.connect(hp).connect(gain).connect(c.destination);
  lfo.start();
  src.start();

  const ms = (buf.duration / pitch) * 1000;
  window.setTimeout(() => {
    try {
      lfo.stop();
      src.disconnect();
    } catch {
      /* ignore */
    }
  }, ms + 250);

  return ms;
}
