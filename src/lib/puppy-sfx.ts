import { isSfxEnabled } from "@/lib/sfx";

export function puppySound(kind: "bark" | "play" | "eat" | "sleep") {
  if (!isSfxEnabled() || typeof window === "undefined") return;
  try {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Audio();
    const notes = kind === "bark" ? [260, 190] : kind === "eat" ? [420, 390] : kind === "sleep" ? [250, 190] : [460, 580, 720];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.11;
      oscillator.type = kind === "bark" ? "sawtooth" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, start + 0.12);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.065, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
    window.setTimeout(() => void ctx.close(), 1100);
  } catch { /* audio is optional */ }
}