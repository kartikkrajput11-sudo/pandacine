export const C4_COLS = 7;
export const C4_ROWS = 6;

export type C4Cell = 0 | 1 | null;
export type C4State = {
  board: C4Cell[]; // row-major, row 0 = top
  turn: 0 | 1;
  winner: 0 | 1 | "draw" | null;
  line: number[] | null;
  lastCol: number | null;
};

export const c4Initial = (): C4State => ({
  board: Array(C4_COLS * C4_ROWS).fill(null),
  turn: 0,
  winner: null,
  line: null,
  lastCol: null,
});

export const c4Idx = (r: number, c: number) => r * C4_COLS + c;

export function c4DropRow(board: C4Cell[], col: number): number | null {
  for (let r = C4_ROWS - 1; r >= 0; r--) if (board[c4Idx(r, col)] == null) return r;
  return null;
}

function winLine(board: C4Cell[], r: number, c: number): number[] | null {
  const p = board[c4Idx(r, c)];
  if (p == null) return null;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (const [dr, dc] of dirs) {
    const cells = [c4Idx(r, c)];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (
        rr >= 0 &&
        rr < C4_ROWS &&
        cc >= 0 &&
        cc < C4_COLS &&
        board[c4Idx(rr, cc)] === p
      ) {
        cells.push(c4Idx(rr, cc));
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

export function c4Play(s: C4State, col: number): C4State {
  if (s.winner != null) return s;
  const row = c4DropRow(s.board, col);
  if (row == null) return s;
  const board = s.board.slice();
  board[c4Idx(row, col)] = s.turn;
  const line = winLine(board, row, col);
  const full = board.every((c) => c != null);
  return {
    board,
    turn: (s.turn === 0 ? 1 : 0) as 0 | 1,
    winner: line ? s.turn : full ? "draw" : null,
    line,
    lastCol: col,
  };
}
