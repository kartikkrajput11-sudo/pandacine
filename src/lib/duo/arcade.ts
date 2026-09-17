/**
 * Shared helpers for the aim-and-power duo arcade games (darts, mini golf,
 * cup pong, tank shot, basketball, archery). Every outcome here is a pure
 * function of the shot vector, so both clients agree on the result and the
 * host can validate it before broadcasting.
 */

export type Seat = 0 | 1;
export const otherSeat = (s: Seat): Seat => (s === 0 ? 1 : 0);

/** Drag vector -> normalised aim {angle in rad, power 0..1}. */
export function aimFromDrag(dx: number, dy: number, maxLen = 160) {
  const len = Math.min(Math.hypot(dx, dy), maxLen);
  return { angle: Math.atan2(dy, dx), power: len / maxLen, len };
}

/* ------------------------------- 101 Darts ------------------------------ */

export type DartHit = { label: string; value: number; isDouble: boolean };
export type DartsState = {
  scores: [number, number];
  turn: Seat;
  darts: DartHit[]; // darts thrown in the current turn
  turnStart: number; // score at the beginning of the current turn
  winner: Seat | null;
  log: string[];
};

export const dartsInitial = (): DartsState => ({
  scores: [101, 101],
  turn: 0,
  darts: [],
  turnStart: 101,
  winner: null,
  log: [],
});

/** Score a dart from a normalised board hit (dx, dy in -1..1 from centre). */
export function scoreDart(dx: number, dy: number): DartHit {
  const r = Math.hypot(dx, dy);
  if (r > 1) return { label: "Miss", value: 0, isDouble: false };
  if (r <= 0.06) return { label: "Bullseye", value: 50, isDouble: true };
  if (r <= 0.13) return { label: "Outer bull", value: 25, isDouble: false };
  const sectors = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const ang = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / 20;
  const norm = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const n = sectors[Math.floor((norm / (Math.PI * 2)) * 20) % 20];
  if (r >= 0.62 && r <= 0.7) return { label: `T${n}`, value: n * 3, isDouble: false };
  if (r >= 0.92) return { label: `D${n}`, value: n * 2, isDouble: true };
  return { label: `${n}`, value: n, isDouble: false };
}

export function dartsThrow(s: DartsState, seat: Seat, hit: DartHit): DartsState {
  if (s.winner != null || s.turn !== seat) return s;
  const darts = [...s.darts, hit];
  const scores: [number, number] = [s.scores[0], s.scores[1]];
  const next = scores[seat] - hit.value;
  const log = [...s.log];

  const bust = next < 0 || next === 1 || (next === 0 && !hit.isDouble);
  if (bust) {
    scores[seat] = s.turnStart;
    log.unshift(`Bust — back to ${s.turnStart}.`);
    const t = otherSeat(seat);
    return { ...s, scores, darts: [], turn: t, turnStart: scores[t], winner: null, log };
  }

  scores[seat] = next;
  log.unshift(`${hit.label} for ${hit.value} → ${next}`);
  if (next === 0) return { ...s, scores, darts, winner: seat, log };
  if (darts.length === 3) {
    const t = otherSeat(seat);
    return { ...s, scores, darts: [], turn: t, turnStart: scores[t], log };
  }
  return { ...s, scores, darts, log };
}

/* ------------------------------ Archery --------------------------------- */

export type ArcheryState = {
  scores: [number, number];
  arrows: [number, number]; // arrows shot
  shots: [ArcheryShot[], ArcheryShot[]];
  turn: Seat;
  round: number; // 1..3
  winds: number[];
  last: ArcheryShot | null;
  suddenDeath: boolean;
  sd: [number | null, number | null];
  winner: Seat | "draw" | null;
};

export type ArcheryShotInput = {
  aimX: number;
  aimY: number;
  power: number;
};

export type ArcheryShot = ArcheryShotInput & {
  seat: Seat;
  wind: number;
  impactX: number;
  impactY: number;
  dist: number;
  points: number;
  timestamp: number;
};

export const ARCHERY_CONFIG = {
  arrowsPerRound: 5,
  rounds: 3,
  gravity: 9.8,
  targetDistance: 72,
  targetHeight: 5.5,
  targetRadius: 4.2,
  minSpeed: 34,
  maxSpeed: 56,
  minPitchDeg: 7,
  maxPitchDeg: 17,
  maxYawDeg: 3.2,
  windAcceleration: 0.18,
  windMin: -5,
  windMax: 5,
  simulationStep: 1 / 120,
} as const;

export const ARROWS_PER_ROUND = ARCHERY_CONFIG.arrowsPerRound;
export const ARCHERY_ROUNDS = ARCHERY_CONFIG.rounds;

const ARCHERY_WINDS = [2.4, -1.8, 3.1] as const;

export function archeryWind(round: number): number {
  return ARCHERY_WINDS[Math.max(0, Math.min(ARCHERY_WINDS.length - 1, round - 1))] ?? 0;
}

export const archeryInitial = (): ArcheryState => ({
  scores: [0, 0],
  arrows: [0, 0],
  shots: [[], []],
  turn: 0,
  round: 1,
  winds: Array.from({ length: ARCHERY_ROUNDS }, (_, i) => archeryWind(i + 1)),
  last: null,
  suddenDeath: false,
  sd: [null, null],
  winner: null,
});

/** dist = normalised 0..1 distance from centre. */
export function archeryPoints(dist: number): number {
  if (dist > 1) return 0;
  return Math.max(0, 11 - Math.ceil(dist * 10));
}

/** Resolve raw controls into a deterministic target-plane impact. */
export function archeryResolveShot(input: ArcheryShotInput, wind: number) {
  const aimX = Math.max(-1, Math.min(1, input.aimX));
  const aimY = Math.max(-1, Math.min(1, input.aimY));
  const power = Math.max(0.12, Math.min(1, input.power));
  const speed = ARCHERY_CONFIG.minSpeed + (ARCHERY_CONFIG.maxSpeed - ARCHERY_CONFIG.minSpeed) * power;
  const pitch = (ARCHERY_CONFIG.minPitchDeg + (ARCHERY_CONFIG.maxPitchDeg - ARCHERY_CONFIG.minPitchDeg) * ((aimY + 1) / 2)) * Math.PI / 180;
  const yaw = aimX * ARCHERY_CONFIG.maxYawDeg * Math.PI / 180;
  const forward = speed * Math.cos(pitch) * Math.cos(yaw);
  const lateral = speed * Math.cos(pitch) * Math.sin(yaw);
  const vertical = speed * Math.sin(pitch);
  const flightTime = ARCHERY_CONFIG.targetDistance / Math.max(1, forward);
  const windAcceleration = wind * ARCHERY_CONFIG.windAcceleration;
  const impactX = lateral * flightTime + 0.5 * windAcceleration * flightTime * flightTime;
  const impactY = vertical * flightTime - 0.5 * ARCHERY_CONFIG.gravity * flightTime * flightTime - ARCHERY_CONFIG.targetHeight;
  const dist = Math.hypot(impactX, impactY) / ARCHERY_CONFIG.targetRadius;
  return { aimX, aimY, power, impactX, impactY, dist, flightTime, speed, pitch, yaw };
}

export function archeryShoot(s: ArcheryState, seat: Seat, input: ArcheryShotInput, timestamp = Date.now()): ArcheryState {
  if (s.winner != null || s.turn !== seat) return s;
  if (!Number.isFinite(input.aimX) || !Number.isFinite(input.aimY) || !Number.isFinite(input.power)) return s;
  if (input.aimX < -1 || input.aimX > 1 || input.aimY < -1 || input.aimY > 1 || input.power < 0.12 || input.power > 1) return s;
  const wind = s.winds[Math.max(0, s.round - 1)] ?? 0;
  const result = archeryResolveShot(input, wind);
  const pts = archeryPoints(result.dist);
  const shot: ArcheryShot = {
    seat,
    aimX: result.aimX,
    aimY: result.aimY,
    power: result.power,
    wind,
    impactX: result.impactX,
    impactY: result.impactY,
    dist: result.dist,
    points: pts,
    timestamp,
  };
  const shots: [ArcheryShot[], ArcheryShot[]] = [s.shots[0].slice(), s.shots[1].slice()];
  shots[seat].push(shot);
  if (s.suddenDeath) {
    const sd: [number | null, number | null] = [s.sd[0], s.sd[1]];
    sd[seat] = result.dist;
    const both = sd[0] != null && sd[1] != null;
    const first = sd[0];
    const second = sd[1];
    const suddenWinner = both && first != null && second != null
      ? Math.abs(first - second) < 0.0001 ? "draw" : first < second ? 0 : 1
      : null;
    return {
      ...s,
      shots,
      sd,
      last: shot,
      turn: otherSeat(seat),
      winner: suddenWinner,
    };
  }
  const scores: [number, number] = [s.scores[0], s.scores[1]];
  const arrows: [number, number] = [s.arrows[0], s.arrows[1]];
  scores[seat] += pts;
  arrows[seat] += 1;
  const total = ARROWS_PER_ROUND * ARCHERY_ROUNDS;
  const done = arrows[0] >= total && arrows[1] >= total;
  const round = Math.min(ARCHERY_ROUNDS, Math.floor(Math.min(arrows[0], arrows[1]) / ARROWS_PER_ROUND) + 1);
  if (done) {
    const tie = scores[0] === scores[1];
    return {
      ...s,
      scores,
      arrows,
      shots,
      round,
      last: shot,
      turn: otherSeat(seat),
      suddenDeath: tie,
      winner: tie ? null : scores[0] > scores[1] ? 0 : 1,
    };
  }
  return { ...s, scores, arrows, shots, round, last: shot, turn: otherSeat(seat) };
}

/* ------------------------------ Cup Pong -------------------------------- */

export type PongState = {
  cups: [number[], number[]]; // remaining cup indexes per player's rack
  turn: Seat;
  last: { seat: Seat; cup: number | null } | null;
  winner: Seat | null;
};

export const PONG_CUPS = 10;
export const pongInitial = (): PongState => ({
  cups: [
    Array.from({ length: PONG_CUPS }, (_, i) => i),
    Array.from({ length: PONG_CUPS }, (_, i) => i),
  ],
  turn: 0,
  last: null,
  winner: null,
});

export function pongThrow(s: PongState, seat: Seat, cup: number | null): PongState {
  if (s.winner != null || s.turn !== seat) return s;
  const opp = otherSeat(seat);
  const cups: [number[], number[]] = [s.cups[0].slice(), s.cups[1].slice()];
  if (cup != null) cups[opp] = cups[opp].filter((c) => c !== cup);
  return {
    ...s,
    cups,
    last: { seat, cup },
    turn: opp,
    winner: cups[opp].length === 0 ? seat : null,
  };
}

/* ------------------------------ Tank Shot ------------------------------- */

export type TankState = {
  hp: [number, number];
  turn: Seat;
  craters: { x: number; y: number; r: number }[];
  last: { seat: Seat; landX: number; damage: number } | null;
  winner: Seat | "draw" | null;
};

export const TANK_X: [number, number] = [80, 620];
export const tankInitial = (): TankState => ({
  hp: [100, 100],
  turn: 0,
  craters: [],
  last: null,
  winner: null,
});

export function tankDamage(landX: number, targetX: number): number {
  const d = Math.abs(landX - targetX);
  if (d > 90) return 0;
  return Math.round(45 * (1 - d / 90) + (d < 12 ? 15 : 0));
}

export function tankFire(s: TankState, seat: Seat, landX: number, landY: number): TankState {
  if (s.winner != null || s.turn !== seat) return s;
  const opp = otherSeat(seat);
  const dmg = tankDamage(landX, TANK_X[opp]);
  const hp: [number, number] = [s.hp[0], s.hp[1]];
  hp[opp] = Math.max(0, hp[opp] - dmg);
  const selfDmg = tankDamage(landX, TANK_X[seat]);
  hp[seat] = Math.max(0, hp[seat] - selfDmg);
  const dead0 = hp[0] === 0;
  const dead1 = hp[1] === 0;
  return {
    hp,
    turn: opp,
    craters: [...s.craters, { x: landX, y: landY, r: 18 }].slice(-14),
    last: { seat, landX, damage: dmg },
    winner: dead0 && dead1 ? "draw" : dead1 ? 0 : dead0 ? 1 : null,
  };
}

/* --------------------------- Basketball Arcade -------------------------- */

export type HoopState = {
  scores: [number, number];
  turn: Seat;
  done: [boolean, boolean];
  secondsLeft: number;
  running: boolean;
  last: string | null;
  suddenDeath: boolean;
  winner: Seat | "draw" | null;
};

export const HOOP_SECONDS = 60;
export const hoopInitial = (): HoopState => ({
  scores: [0, 0],
  turn: 0,
  done: [false, false],
  secondsLeft: HOOP_SECONDS,
  running: false,
  last: null,
  suddenDeath: false,
  winner: null,
});

export function hoopScore(long: boolean, swish: boolean): { points: number; label: string } {
  const base = long ? 3 : 2;
  return { points: base + (swish ? 1 : 0), label: `${long ? "Long range" : "Basket"}${swish ? " + swish bonus" : ""}` };
}

export function hoopEndTurn(s: HoopState): HoopState {
  const done: [boolean, boolean] = [s.done[0], s.done[1]];
  done[s.turn] = true;
  if (done[0] && done[1]) {
    const tie = s.scores[0] === s.scores[1];
    if (tie && !s.suddenDeath) {
      return { ...s, done: [false, false], turn: 0, secondsLeft: 30, running: false, suddenDeath: true, last: "Tied — 30s sudden death." };
    }
    return { ...s, done, running: false, winner: tie ? "draw" : s.scores[0] > s.scores[1] ? 0 : 1 };
  }
  return {
    ...s,
    done,
    turn: otherSeat(s.turn),
    secondsLeft: s.suddenDeath ? 30 : HOOP_SECONDS,
    running: false,
    last: "Turn over.",
  };
}

/* ----------------------------- Mini Golf -------------------------------- */

export type GolfWall = { x: number; y: number; w: number; h: number };
export type GolfBumper = { x: number; y: number; r: number };
export type GolfPatch = { x: number; y: number; w: number; h: number; kind: "sand" | "water" };
export type GolfHole = {
  par: number;
  tee: { x: number; y: number };
  cup: { x: number; y: number };
  walls: GolfWall[];
  bumpers?: GolfBumper[];
  patches?: GolfPatch[];
};

export const GOLF_W = 320;
export const GOLF_H = 460;
export const GOLF_BALL_R = 6;
export const GOLF_CUP_R = 11;
export const GOLF_MAX_STROKES = 6;

/** Nine hand-built holes: doglegs, bumpers, sand traps and water hazards. */
export const GOLF_HOLES: GolfHole[] = [
  {
    par: 2,
    tee: { x: 160, y: 400 },
    cup: { x: 160, y: 70 },
    walls: [
      { x: 60, y: 220, w: 80, h: 14 },
      { x: 180, y: 220, w: 80, h: 14 },
    ],
    bumpers: [{ x: 160, y: 300, r: 16 }],
  },
  {
    par: 3,
    tee: { x: 70, y: 405 },
    cup: { x: 250, y: 80 },
    walls: [
      { x: 60, y: 250, w: 180, h: 14 },
      { x: 150, y: 120, w: 14, h: 100 },
    ],
    patches: [{ x: 180, y: 300, w: 90, h: 70, kind: "sand" }],
  },
  {
    par: 3,
    tee: { x: 160, y: 410 },
    cup: { x: 160, y: 62 },
    walls: [
      { x: 30, y: 270, w: 130, h: 14 },
      { x: 170, y: 180, w: 130, h: 14 },
    ],
    bumpers: [
      { x: 240, y: 300, r: 18 },
      { x: 80, y: 130, r: 18 },
    ],
  },
  {
    par: 4,
    tee: { x: 60, y: 410 },
    cup: { x: 265, y: 68 },
    walls: [
      { x: 100, y: 300, w: 14, h: 110 },
      { x: 190, y: 150, w: 14, h: 120 },
      { x: 120, y: 230, w: 120, h: 14 },
    ],
    patches: [{ x: 210, y: 300, w: 80, h: 80, kind: "water" }],
  },
  {
    par: 3,
    tee: { x: 262, y: 400 },
    cup: { x: 60, y: 84 },
    walls: [
      { x: 120, y: 260, w: 160, h: 14 },
      { x: 40, y: 160, w: 160, h: 14 },
    ],
    bumpers: [{ x: 90, y: 330, r: 15 }],
  },
  {
    par: 4,
    tee: { x: 160, y: 415 },
    cup: { x: 160, y: 58 },
    walls: [
      { x: 100, y: 330, w: 120, h: 14 },
      { x: 34, y: 220, w: 96, h: 14 },
      { x: 190, y: 220, w: 96, h: 14 },
      { x: 138, y: 112, w: 44, h: 14 },
    ],
    patches: [{ x: 120, y: 250, w: 80, h: 60, kind: "sand" }],
  },
  {
    par: 3,
    tee: { x: 70, y: 400 },
    cup: { x: 252, y: 104 },
    walls: [
      { x: 150, y: 250, w: 14, h: 140 },
      { x: 90, y: 168, w: 140, h: 14 },
    ],
    bumpers: [{ x: 250, y: 250, r: 20 }],
  },
  {
    par: 4,
    tee: { x: 252, y: 410 },
    cup: { x: 68, y: 72 },
    walls: [
      { x: 60, y: 310, w: 180, h: 14 },
      { x: 130, y: 180, w: 160, h: 14 },
      { x: 60, y: 110, w: 14, h: 70 },
    ],
    patches: [{ x: 40, y: 330, w: 70, h: 70, kind: "water" }],
  },
  {
    par: 5,
    tee: { x: 160, y: 420 },
    cup: { x: 160, y: 58 },
    walls: [
      { x: 40, y: 350, w: 110, h: 14 },
      { x: 180, y: 290, w: 110, h: 14 },
      { x: 50, y: 210, w: 130, h: 14 },
      { x: 190, y: 132, w: 90, h: 14 },
    ],
    bumpers: [
      { x: 250, y: 360, r: 16 },
      { x: 70, y: 130, r: 16 },
    ],
    patches: [{ x: 120, y: 240, w: 70, h: 46, kind: "sand" }],
  },
];

export type GolfState = {
  hole: number;
  ball: [{ x: number; y: number }, { x: number; y: number }];
  strokes: [number, number];
  holed: [boolean, boolean];
  totals: [number, number];
  turn: Seat;
  suddenDeath: boolean;
  winner: Seat | "draw" | null;
};

export const golfHoleAt = (i: number) => GOLF_HOLES[i % GOLF_HOLES.length];

export const golfInitial = (): GolfState => ({
  hole: 0,
  ball: [{ ...GOLF_HOLES[0].tee }, { ...GOLF_HOLES[0].tee }],
  strokes: [0, 0],
  holed: [false, false],
  totals: [0, 0],
  turn: 0,
  suddenDeath: false,
  winner: null,
});

const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

export type PuttResult = {
  path: { x: number; y: number }[];
  sank: boolean;
  end: { x: number; y: number };
  splash: boolean;
};

/**
 * Deterministic putt simulation: swept motion with proper circle-vs-box
 * resolution (the ball is pushed out along the shallowest axis, then
 * reflected), round bumpers that kick the ball away, sand that drags it to a
 * halt and water that returns it to where the stroke began.
 */
export function simulatePutt(
  hole: GolfHole,
  from: { x: number; y: number },
  angle: number,
  power: number,
): PuttResult {
  const path: { x: number; y: number }[] = [{ ...from }];
  let x = from.x;
  let y = from.y;
  const speed = 2 + power * 13;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  let sank = false;
  let splash = false;

  for (let step = 0; step < 900; step++) {
    // Sub-step so a fast ball cannot tunnel through a wall.
    const sub = Math.max(1, Math.ceil(Math.hypot(vx, vy) / 3));
    for (let k = 0; k < sub; k++) {
      x += vx / sub;
      y += vy / sub;

      // Rails.
      if (x < GOLF_BALL_R + 8) {
        x = GOLF_BALL_R + 8;
        vx = Math.abs(vx) * 0.78;
      }
      if (x > GOLF_W - GOLF_BALL_R - 8) {
        x = GOLF_W - GOLF_BALL_R - 8;
        vx = -Math.abs(vx) * 0.78;
      }
      if (y < GOLF_BALL_R + 8) {
        y = GOLF_BALL_R + 8;
        vy = Math.abs(vy) * 0.78;
      }
      if (y > GOLF_H - GOLF_BALL_R - 8) {
        y = GOLF_H - GOLF_BALL_R - 8;
        vy = -Math.abs(vy) * 0.78;
      }

      // Walls — resolve by shallowest penetration axis.
      for (const w of hole.walls) {
        const cx = Math.max(w.x, Math.min(x, w.x + w.w));
        const cy = Math.max(w.y, Math.min(y, w.y + w.h));
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= GOLF_BALL_R) continue;
        if (d > 0.0001) {
          const nx = dx / d;
          const ny = dy / d;
          const push = GOLF_BALL_R - d;
          x += nx * push;
          y += ny * push;
          const dot = vx * nx + vy * ny;
          vx = (vx - 2 * dot * nx) * 0.8;
          vy = (vy - 2 * dot * ny) * 0.8;
        } else {
          vx = -vx * 0.8;
          vy = -vy * 0.8;
        }
      }

      // Round bumpers — livelier rebound.
      for (const b of hole.bumpers ?? []) {
        const dx = x - b.x;
        const dy = y - b.y;
        const d = Math.hypot(dx, dy);
        const min = b.r + GOLF_BALL_R;
        if (d >= min || d < 0.0001) continue;
        const nx = dx / d;
        const ny = dy / d;
        x = b.x + nx * min;
        y = b.y + ny * min;
        const dot = vx * nx + vy * ny;
        vx = (vx - 2 * dot * nx) * 1.05;
        vy = (vy - 2 * dot * ny) * 1.05;
      }

      // Cup — only drops in when rolling slowly enough.
      const dc = Math.hypot(x - hole.cup.x, y - hole.cup.y);
      if (dc < GOLF_CUP_R && Math.hypot(vx, vy) < 5.5) {
        sank = true;
        x = hole.cup.x;
        y = hole.cup.y;
        break;
      }
      // Fast ball lips out around the rim.
      if (dc < GOLF_CUP_R + 2 && Math.hypot(vx, vy) >= 5.5) {
        const nx = (x - hole.cup.x) / (dc || 1);
        const ny = (y - hole.cup.y) / (dc || 1);
        vx += nx * 0.6;
        vy += ny * 0.6;
      }
    }
    if (sank) {
      path.push({ x, y });
      break;
    }

    // Terrain friction.
    let friction = 0.985;
    for (const p of hole.patches ?? []) {
      if (!inRect(x, y, p)) continue;
      if (p.kind === "sand") friction = 0.9;
      if (p.kind === "water") {
        splash = true;
      }
    }
    if (splash) {
      path.push({ x, y });
      break;
    }
    vx *= friction;
    vy *= friction;
    path.push({ x, y });
    if (Math.hypot(vx, vy) < 0.22) break;
  }

  if (splash) {
    // Water penalty: the ball comes back to where the stroke was played.
    return { path, sank: false, end: { ...from }, splash: true };
  }
  return { path, sank, end: sank ? { ...hole.cup } : { x, y }, splash: false };
}

/* ------------------------- Archery flight model -------------------------- */

export const ARCHERY_TARGET = { x: 300, y: 130, r: 62 };

/**
 * Flies an arrow from the bow towards the target. Deterministic given the
 * release parameters, so both clients replay the identical shot.
 * `aim` is the vertical aim offset (-1 up .. 1 down), `power` the draw (0..1),
 * `wind` a lateral drift in target units.
 */
export function simulateArrow(aim: number, power: number, wind: number) {
  const path: { x: number; y: number }[] = [];
  const start = { x: 62, y: 168 };
  let x = start.x;
  let y = start.y;
  const speed = 6 + power * 16;
  let vx = speed;
  let vy = aim * speed * 0.55;
  const gravity = 0.62 - power * 0.28;
  let t = 0;
  while (x < ARCHERY_TARGET.x && t < 400) {
    x += vx;
    y += vy;
    vy += gravity;
    vx *= 0.995;
    path.push({ x, y });
    t++;
  }
  // Lateral wind shows up as extra vertical drift on this side-on view.
  const impactY = y + wind * 26;
  const dist = Math.min(2, Math.abs(impactY - ARCHERY_TARGET.y) / ARCHERY_TARGET.r);
  return { path, impact: { x: ARCHERY_TARGET.x, y: impactY }, dist };
}
