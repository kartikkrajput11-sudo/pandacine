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
  turn: Seat;
  round: number; // 1..3
  last: { seat: Seat; points: number; dist: number } | null;
  suddenDeath: boolean;
  sd: [number | null, number | null];
  winner: Seat | "draw" | null;
};

export const ARROWS_PER_ROUND = 5;
export const archeryInitial = (): ArcheryState => ({
  scores: [0, 0],
  arrows: [0, 0],
  turn: 0,
  round: 1,
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

export function archeryShoot(s: ArcheryState, seat: Seat, dist: number): ArcheryState {
  if (s.winner != null || s.turn !== seat) return s;
  const pts = archeryPoints(dist);
  if (s.suddenDeath) {
    const sd: [number | null, number | null] = [s.sd[0], s.sd[1]];
    sd[seat] = dist;
    const both = sd[0] != null && sd[1] != null;
    return {
      ...s,
      sd,
      last: { seat, points: pts, dist },
      turn: otherSeat(seat),
      winner: both ? (sd[0]! === sd[1]! ? "draw" : sd[0]! < sd[1]! ? 0 : 1) : null,
    };
  }
  const scores: [number, number] = [s.scores[0], s.scores[1]];
  const arrows: [number, number] = [s.arrows[0], s.arrows[1]];
  scores[seat] += pts;
  arrows[seat] += 1;
  const total = ARROWS_PER_ROUND * 3;
  const done = arrows[0] >= total && arrows[1] >= total;
  const round = Math.min(3, Math.floor(Math.min(arrows[0], arrows[1]) / ARROWS_PER_ROUND) + 1);
  if (done) {
    const tie = scores[0] === scores[1];
    return {
      ...s,
      scores,
      arrows,
      round,
      last: { seat, points: pts, dist },
      turn: otherSeat(seat),
      suddenDeath: tie,
      winner: tie ? null : scores[0] > scores[1] ? 0 : 1,
    };
  }
  return { ...s, scores, arrows, round, last: { seat, points: pts, dist }, turn: otherSeat(seat) };
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
export type GolfHole = {
  par: number;
  tee: { x: number; y: number };
  cup: { x: number; y: number };
  walls: GolfWall[];
};

export const GOLF_W = 320;
export const GOLF_H = 460;

/** Nine deterministic holes: walls, bumpers and doglegs. */
export const GOLF_HOLES: GolfHole[] = [
  { par: 2, tee: { x: 160, y: 400 }, cup: { x: 160, y: 70 }, walls: [{ x: 110, y: 210, w: 100, h: 14 }] },
  { par: 3, tee: { x: 70, y: 400 }, cup: { x: 250, y: 80 }, walls: [{ x: 60, y: 230, w: 170, h: 14 }, { x: 150, y: 120, w: 14, h: 90 }] },
  { par: 3, tee: { x: 160, y: 410 }, cup: { x: 160, y: 60 }, walls: [{ x: 40, y: 260, w: 110, h: 14 }, { x: 180, y: 180, w: 110, h: 14 }] },
  { par: 4, tee: { x: 60, y: 410 }, cup: { x: 265, y: 65 }, walls: [{ x: 100, y: 300, w: 14, h: 110 }, { x: 190, y: 150, w: 14, h: 120 }, { x: 120, y: 220, w: 120, h: 14 }] },
  { par: 3, tee: { x: 260, y: 400 }, cup: { x: 60, y: 80 }, walls: [{ x: 120, y: 250, w: 150, h: 14 }, { x: 40, y: 150, w: 150, h: 14 }] },
  { par: 4, tee: { x: 160, y: 415 }, cup: { x: 160, y: 55 }, walls: [{ x: 100, y: 320, w: 120, h: 14 }, { x: 40, y: 210, w: 90, h: 14 }, { x: 195, y: 210, w: 90, h: 14 }, { x: 140, y: 110, w: 50, h: 14 }] },
  { par: 3, tee: { x: 70, y: 400 }, cup: { x: 250, y: 100 }, walls: [{ x: 150, y: 260, w: 14, h: 130 }, { x: 90, y: 160, w: 130, h: 14 }] },
  { par: 4, tee: { x: 250, y: 410 }, cup: { x: 70, y: 70 }, walls: [{ x: 60, y: 300, w: 170, h: 14 }, { x: 130, y: 170, w: 160, h: 14 }, { x: 60, y: 110, w: 14, h: 70 }] },
  { par: 5, tee: { x: 160, y: 420 }, cup: { x: 160, y: 60 }, walls: [{ x: 50, y: 340, w: 100, h: 14 }, { x: 180, y: 280, w: 100, h: 14 }, { x: 60, y: 200, w: 120, h: 14 }, { x: 190, y: 130, w: 90, h: 14 }] },
];

export const GOLF_MAX_STROKES = 6;

export type GolfState = {
  hole: number; // 0..8 (or 9+ for sudden death)
  ball: [{ x: number; y: number }, { x: number; y: number }];
  strokes: [number, number];
  holed: [boolean, boolean];
  totals: [number, number];
  turn: Seat;
  suddenDeath: boolean;
  winner: Seat | "draw" | null;
};

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

export const golfHoleAt = (i: number) => GOLF_HOLES[i % GOLF_HOLES.length];

/** Simulates a putt with wall bounces; returns the path and whether it sank. */
export function simulatePutt(
  hole: GolfHole,
  from: { x: number; y: number },
  angle: number,
  power: number,
) {
  const path: { x: number; y: number }[] = [{ ...from }];
  let x = from.x;
  let y = from.y;
  let vx = Math.cos(angle) * power * 16;
  let vy = Math.sin(angle) * power * 16;
  let sank = false;
  for (let step = 0; step < 400; step++) {
    const nx = x + vx;
    const ny = y + vy;
    // walls
    for (const w of hole.walls) {
      const insideX = nx > w.x - 6 && nx < w.x + w.w + 6;
      const insideY = ny > w.y - 6 && ny < w.y + w.h + 6;
      if (insideX && insideY) {
        if (Math.abs(vx) > Math.abs(vy)) vx = -vx * 0.75;
        else vy = -vy * 0.75;
      }
    }
    x += vx;
    y += vy;
    if (x < 10) {
      x = 10;
      vx = -vx * 0.8;
    }
    if (x > GOLF_W - 10) {
      x = GOLF_W - 10;
      vx = -vx * 0.8;
    }
    if (y < 10) {
      y = 10;
      vy = -vy * 0.8;
    }
    if (y > GOLF_H - 10) {
      y = GOLF_H - 10;
      vy = -vy * 0.8;
    }
    vx *= 0.97;
    vy *= 0.97;
    path.push({ x, y });
    const d = Math.hypot(x - hole.cup.x, y - hole.cup.y);
    if (d < 10 && Math.hypot(vx, vy) < 6) {
      sank = true;
      path.push({ ...hole.cup });
      break;
    }
    if (Math.hypot(vx, vy) < 0.25) break;
  }
  return { path, sank, end: sank ? { ...hole.cup } : { x, y } };
}
