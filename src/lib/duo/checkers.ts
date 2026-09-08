export type Piece = { p: 0 | 1; king: boolean } | null;
export type CkState = {
  board: Piece[]; // 64, index = r*8+c
  turn: 0 | 1;
  /** Index of the piece locked into a multi-capture chain, if any. */
  chain: number | null;
  winner: 0 | 1 | null;
};

export const idx = (r: number, c: number) => r * 8 + c;
export const rc = (i: number) => [Math.floor(i / 8), i % 8] as const;
export const isDark = (r: number, c: number) => (r + c) % 2 === 1;

export function ckInitial(): CkState {
  const board: Piece[] = Array(64).fill(null);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++) if (isDark(r, c)) board[idx(r, c)] = { p: 1, king: false };
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++) if (isDark(r, c)) board[idx(r, c)] = { p: 0, king: false };
  return { board, turn: 0, chain: null, winner: null };
}

// Player 0 moves up the board (decreasing row), player 1 moves down.
function dirsFor(pc: NonNullable<Piece>) {
  const fwd = pc.p === 0 ? -1 : 1;
  return pc.king
    ? [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]
    : [
        [fwd, -1],
        [fwd, 1],
      ];
}

export type Move = { from: number; to: number; captured: number | null };

export function movesForPiece(s: CkState, from: number, capturesOnly: boolean): Move[] {
  const pc = s.board[from];
  if (!pc) return [];
  const [r, c] = rc(from);
  const out: Move[] = [];
  for (const [dr, dc] of dirsFor(pc)) {
    const r1 = r + dr;
    const c1 = c + dc;
    const r2 = r + dr * 2;
    const c2 = c + dc * 2;
    if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
    const midI = idx(r1, c1);
    const mid = s.board[midI];
    if (!mid && !capturesOnly) out.push({ from, to: midI, captured: null });
    if (mid && mid.p !== pc.p && r2 >= 0 && r2 <= 7 && c2 >= 0 && c2 <= 7 && !s.board[idx(r2, c2)]) {
      out.push({ from, to: idx(r2, c2), captured: midI });
    }
  }
  return out;
}

/** Legal moves for the side to move, honouring mandatory capture + chains. */
export function legalMoves(s: CkState): Move[] {
  if (s.winner != null) return [];
  if (s.chain != null) return movesForPiece(s, s.chain, true);
  const mine: number[] = [];
  s.board.forEach((pc, i) => {
    if (pc && pc.p === s.turn) mine.push(i);
  });
  const caps = mine.flatMap((i) => movesForPiece(s, i, true));
  if (caps.length) return caps;
  return mine.flatMap((i) => movesForPiece(s, i, false));
}

export function ckApply(s: CkState, mv: Move): CkState {
  const board = s.board.slice();
  const pc = board[mv.from];
  if (!pc) return s;
  board[mv.from] = null;
  if (mv.captured != null) board[mv.captured] = null;
  const [tr] = rc(mv.to);
  const king = pc.king || (pc.p === 0 && tr === 0) || (pc.p === 1 && tr === 7);
  const promoted = king && !pc.king;
  board[mv.to] = { p: pc.p, king };

  let next: CkState = { board, turn: s.turn, chain: null, winner: null };
  // Chain continues only when the same piece can capture again and it did not
  // just get crowned (standard rule: crowning ends the turn).
  const more = mv.captured != null && !promoted && movesForPiece(next, mv.to, true).length > 0;
  if (more) {
    next.chain = mv.to;
  } else {
    next.turn = (s.turn === 0 ? 1 : 0) as 0 | 1;
  }
  const oppHas = board.some((p) => p && p.p === next.turn);
  if (!oppHas || legalMoves(next).length === 0) {
    next.winner = (next.turn === 0 ? 1 : 0) as 0 | 1;
  }
  return next;
}
