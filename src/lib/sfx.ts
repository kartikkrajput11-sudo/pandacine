// WebAudio-generated sound effects. No assets, works offline.
// All effects are short, warm chiptune-style pings.

let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

// Unlock on first user interaction (Safari/iOS policy).
if (typeof window !== "undefined") {
  const unlock = () => {
    const c = ac();
    if (c && c.state === "suspended") void c.resume();
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  try {
    const raw = localStorage.getItem("pandacine.sfx.enabled");
    if (raw === "0") enabled = false;
  } catch { /* ignore */ }
}

export function setSfxEnabled(v: boolean) {
  enabled = v;
  try { localStorage.setItem("pandacine.sfx.enabled", v ? "1" : "0"); } catch { /* ignore */ }
}
export function isSfxEnabled() { return enabled; }

type Note = {
  freq: number;
  start: number;   // seconds offset from now
  dur: number;     // note length
  gain?: number;   // peak gain (default 0.08)
  type?: OscillatorType; // default "sine"
  glideTo?: number; // optional pitch glide target
};

function play(notes: Note[]) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  // Ensure context is running — needed after any auto-suspend on mobile/desktop
  // idle. Fire-and-forget; scheduled notes still play once it resumes.
  if (c.state === "suspended") { try { void c.resume(); } catch { /* ignore */ } }
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);
  const t0 = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.freq, t0 + n.start);
    if (n.glideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(n.glideTo, t0 + n.start + n.dur);
    }
    const peak = n.gain ?? 0.08;
    g.gain.setValueAtTime(0.0001, t0 + n.start);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur);
    osc.connect(g).connect(master);
    osc.start(t0 + n.start);
    osc.stop(t0 + n.start + n.dur + 0.02);
  }
}

// Outgoing message: bright rising blip
export function sfxSend() {
  play([{ freq: 620, glideTo: 980, start: 0, dur: 0.11, gain: 0.06, type: "triangle" }]);
}

// Incoming message: soft two-tone ping
export function sfxReceive() {
  play([
    { freq: 780, start: 0,    dur: 0.12, gain: 0.055, type: "sine" },
    { freq: 1040, start: 0.08, dur: 0.16, gain: 0.05,  type: "sine" },
  ]);
}

// Reaction / heart: tiny sparkle
export function sfxReaction() {
  play([
    { freq: 1320, start: 0,    dur: 0.08, gain: 0.05, type: "triangle" },
    { freq: 1760, start: 0.05, dur: 0.10, gain: 0.045, type: "triangle" },
  ]);
}

// Kiss: warm glissando
export function sfxKiss() {
  play([{ freq: 540, glideTo: 320, start: 0, dur: 0.35, gain: 0.06, type: "sine" }]);
}

// Vote cast on a poll: little confirm
export function sfxPollVote() {
  play([
    { freq: 660, start: 0, dur: 0.08, gain: 0.05, type: "square" },
    { freq: 990, start: 0.06, dur: 0.12, gain: 0.045, type: "square" },
  ]);
}

// Ludo — dice tumble (rapid clatter of pitched blips)
export function sfxLudoDiceRoll() {
  const notes: Note[] = [];
  for (let i = 0; i < 7; i++) {
    notes.push({
      freq: 420 + Math.random() * 260,
      start: i * 0.09,
      dur: 0.07,
      gain: 0.05,
      type: "square",
    });
  }
  notes.push({ freq: 880, start: 0.75, dur: 0.14, gain: 0.06, type: "triangle" });
  play(notes);
}

// Ludo — token hop (per square)
export function sfxLudoHop() {
  play([{ freq: 720, glideTo: 980, start: 0, dur: 0.07, gain: 0.05, type: "triangle" }]);
}

// Ludo — capture (opponent knocked back to yard)
export function sfxLudoCapture() {
  play([
    { freq: 520, glideTo: 180, start: 0, dur: 0.22, gain: 0.07, type: "sawtooth" },
    { freq: 260, glideTo: 110, start: 0.08, dur: 0.26, gain: 0.06, type: "square" },
  ]);
}

// Ludo — token safely home
export function sfxLudoHome() {
  play([
    { freq: 660, start: 0, dur: 0.1, gain: 0.055, type: "sine" },
    { freq: 990, start: 0.08, dur: 0.12, gain: 0.05, type: "sine" },
    { freq: 1320, start: 0.16, dur: 0.16, gain: 0.05, type: "sine" },
  ]);
}

// Ludo — victory fanfare
export function sfxLudoWin() {
  play([
    { freq: 523.25, start: 0, dur: 0.18, gain: 0.07, type: "triangle" },
    { freq: 659.25, start: 0.16, dur: 0.18, gain: 0.07, type: "triangle" },
    { freq: 783.99, start: 0.32, dur: 0.22, gain: 0.07, type: "triangle" },
    { freq: 1046.5, start: 0.5, dur: 0.4, gain: 0.08, type: "triangle" },
  ]);
}

// Pool — cue strikes the ball
export function sfxPoolCue() {
  play([
    { freq: 220, start: 0, dur: 0.05, gain: 0.09, type: "square", glideTo: 90 },
    { freq: 1200, start: 0, dur: 0.03, gain: 0.05, type: "triangle" },
  ]);
}
// Pool — ball on ball click
export function sfxPoolClick() {
  play([
    { freq: 1400, start: 0, dur: 0.04, gain: 0.06, type: "triangle", glideTo: 900 },
  ]);
}
// Pool — rail bounce (softer thump)
export function sfxPoolRail() {
  play([
    { freq: 180, start: 0, dur: 0.06, gain: 0.05, type: "sine", glideTo: 90 },
  ]);
}
// Pool — pocket sink (deep drop)
export function sfxPoolPocket() {
  play([
    { freq: 300, start: 0, dur: 0.08, gain: 0.07, type: "sine", glideTo: 120 },
    { freq: 120, start: 0.08, dur: 0.18, gain: 0.06, type: "sine", glideTo: 60 },
  ]);
}
// Pool — victory
export function sfxPoolWin() {
  play([
    { freq: 523.25, start: 0, dur: 0.16, gain: 0.07, type: "triangle" },
    { freq: 659.25, start: 0.14, dur: 0.16, gain: 0.07, type: "triangle" },
    { freq: 987.77, start: 0.28, dur: 0.34, gain: 0.08, type: "triangle" },
  ]);
}

// Tank Shot — compact, playful cannon and impact sounds.
export function sfxTankFire() {
  play([
    { freq: 150, glideTo: 72, start: 0, dur: 0.2, gain: 0.09, type: "triangle" },
    { freq: 820, glideTo: 260, start: 0, dur: 0.08, gain: 0.035, type: "square" },
  ]);
}

export function sfxTankImpact(hit: boolean) {
  play(hit
    ? [
        { freq: 120, glideTo: 48, start: 0, dur: 0.28, gain: 0.1, type: "sawtooth" },
        { freq: 420, glideTo: 110, start: 0.02, dur: 0.18, gain: 0.045, type: "triangle" },
      ]
    : [{ freq: 190, glideTo: 75, start: 0, dur: 0.18, gain: 0.055, type: "triangle" }]);
}

// Archery — taut string draw, release, target impact, and match result.
export function sfxArcheryDraw() {
  play([
    { freq: 118, glideTo: 178, start: 0, dur: 0.42, gain: 0.035, type: "triangle" },
    { freq: 236, glideTo: 312, start: 0.08, dur: 0.36, gain: 0.018, type: "sine" },
  ]);
}

export function sfxArcheryRelease() {
  play([
    { freq: 920, glideTo: 210, start: 0, dur: 0.16, gain: 0.055, type: "triangle" },
    { freq: 1420, glideTo: 480, start: 0.015, dur: 0.1, gain: 0.028, type: "square" },
  ]);
}

export function sfxArcheryImpact(points: number) {
  play(points > 0
    ? [
        { freq: 164, glideTo: 92, start: 0, dur: 0.12, gain: 0.075, type: "triangle" },
        { freq: 620 + points * 36, start: 0.06, dur: 0.16, gain: 0.04, type: "sine" },
      ]
    : [{ freq: 130, glideTo: 62, start: 0, dur: 0.2, gain: 0.04, type: "sawtooth" }]);
}

export function sfxArcheryResult(won: boolean) {
  play(won
    ? [
        { freq: 523.25, start: 0, dur: 0.18, gain: 0.065, type: "triangle" },
        { freq: 659.25, start: 0.14, dur: 0.18, gain: 0.065, type: "triangle" },
        { freq: 783.99, start: 0.28, dur: 0.18, gain: 0.07, type: "triangle" },
        { freq: 1046.5, start: 0.42, dur: 0.34, gain: 0.075, type: "triangle" },
      ]
    : [
        { freq: 330, glideTo: 196, start: 0, dur: 0.28, gain: 0.05, type: "triangle" },
        { freq: 247, glideTo: 147, start: 0.18, dur: 0.34, gain: 0.045, type: "sine" },
      ]);
}

// Mini Golf — putter, course contact, hazards, cup, and match result.
export function sfxGolfPutt(power: number) {
  play([
    { freq: 190 + power * 90, glideTo: 110, start: 0, dur: 0.08, gain: 0.065, type: "triangle" },
    { freq: 1180, glideTo: 720, start: 0.01, dur: 0.045, gain: 0.03, type: "sine" },
  ]);
}

export function sfxGolfCollision(bumper = false) {
  play([{ freq: bumper ? 620 : 260, glideTo: bumper ? 920 : 150, start: 0, dur: 0.075, gain: 0.045, type: bumper ? "triangle" : "sine" }]);
}

export function sfxGolfSand() {
  play([{ freq: 150, glideTo: 82, start: 0, dur: 0.2, gain: 0.025, type: "sawtooth" }]);
}

export function sfxGolfSplash() {
  play([
    { freq: 380, glideTo: 95, start: 0, dur: 0.28, gain: 0.055, type: "sine" },
    { freq: 760, glideTo: 180, start: 0.04, dur: 0.2, gain: 0.025, type: "triangle" },
  ]);
}

export function sfxGolfCup() {
  play([
    { freq: 430, glideTo: 180, start: 0, dur: 0.13, gain: 0.06, type: "sine" },
    { freq: 880, start: 0.1, dur: 0.16, gain: 0.045, type: "triangle" },
  ]);
}

export function sfxGolfResult(won: boolean) {
  sfxArcheryResult(won);
}

