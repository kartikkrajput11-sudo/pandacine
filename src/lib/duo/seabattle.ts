export const SB_SIZE = 10;
export const SB_FLEET = [
  { id: "carrier", name: "Carrier", len: 5 },
  { id: "battleship", name: "Battleship", len: 4 },
  { id: "cruiser", name: "Cruiser", len: 3 },
  { id: "submarine", name: "Submarine", len: 3 },
  { id: "destroyer", name: "Destroyer", len: 2 },
] as const;

export type Ship = { id: string; name: string; cells: number[] };
export type Board = { ships: Ship[]; shots: number[] }; // shots = cells fired at THIS board
export type SBState = {
  boards: [Board, Board];
  ready: [boolean, boolean];
  turn: 0 | 1;
  winner: 0 | 1 | null;
  last: { at: number; result: "miss" | "hit" | "sunk"; by: 0 | 1 } | null;
};

export const sbIdx = (r: number, c: number) => r * SB_SIZE + c;
export const sbRC = (i: number) => [Math.floor(i / SB_SIZE), i % SB_SIZE] as const;

export const sbInitial = (): SBState => ({
  boards: [
    { ships: [], shots: [] },
    { ships: [], shots: [] },
  ],
  ready: [false, false],
  turn: 0,
  winner: null,
  last: null,
});

export function shipCells(start: number, len: number, horizontal: boolean): number[] | null {
  const [r, c] = sbRC(start);
  const cells: number[] = [];
  for (let k = 0; k < len; k++) {
    const rr = horizontal ? r : r + k;
    const cc = horizontal ? c + k : c;
    if (rr >= SB_SIZE || cc >= SB_SIZE) return null;
    cells.push(sbIdx(rr, cc));
  }
  return cells;
}

export function canPlace(ships: Ship[], cells: number[]): boolean {
  const taken = new Set(ships.flatMap((s) => s.cells));
  return cells.every((c) => !taken.has(c));
}

export function randomFleet(): Ship[] {
  const ships: Ship[] = [];
  for (const spec of SB_FLEET) {
    for (let tries = 0; tries < 500; tries++) {
      const horizontal = Math.random() < 0.5;
      const start = Math.floor(Math.random() * SB_SIZE * SB_SIZE);
      const cells = shipCells(start, spec.len, horizontal);
      if (cells && canPlace(ships, cells)) {
        ships.push({ id: spec.id, name: spec.name, cells });
        break;
      }
    }
  }
  return ships;
}

export function sunkShips(board: Board): Ship[] {
  return board.ships.filter((s) => s.cells.every((c) => board.shots.includes(c)));
}

/** Fire at `target` on the opponent's board. Returns unchanged state if illegal. */
export function sbFire(s: SBState, by: 0 | 1, cell: number): SBState {
  if (s.winner != null || s.turn !== by || !s.ready[0] || !s.ready[1]) return s;
  const oppSeat = (by === 0 ? 1 : 0) as 0 | 1;
  const opp = s.boards[oppSeat];
  if (opp.shots.includes(cell)) return s;
  const shots = [...opp.shots, cell];
  const nextOpp: Board = { ...opp, shots };
  const hitShip = nextOpp.ships.find((sh) => sh.cells.includes(cell));
  const sunk = hitShip && hitShip.cells.every((c) => shots.includes(c));
  const boards: [Board, Board] = by === 0 ? [s.boards[0], nextOpp] : [nextOpp, s.boards[1]];
  const allSunk = nextOpp.ships.length > 0 && nextOpp.ships.every((sh) => sh.cells.every((c) => shots.includes(c)));
  return {
    ...s,
    boards,
    // Hits keep the turn only in classic "salvo" variants — here turns alternate always.
    turn: oppSeat,
    winner: allSunk ? by : null,
    last: { at: cell, result: sunk ? "sunk" : hitShip ? "hit" : "miss", by },
  };
}
