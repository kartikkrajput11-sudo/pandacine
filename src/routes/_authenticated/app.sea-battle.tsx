import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import {
  SB_FLEET,
  SB_SIZE,
  canPlace,
  randomFleet,
  sbFire,
  sbIdx,
  sbInitial,
  shipCells,
  sunkShips,
  type SBState,
  type Ship,
} from "@/lib/duo/seabattle";

export const Route = createFileRoute("/_authenticated/app/sea-battle")({
  component: SeaBattle,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Sea Battle — PandaCine" },
      { name: "description", content: "Hide your fleet, hunt theirs. Live two-player sea battle." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Sink your opponent's whole fleet before they sink yours."] },
  { heading: "Players", lines: ["2 players, alternating shots."] },
  {
    heading: "Fleet",
    lines: ["Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2 — 17 cells on a 10×10 grid."],
  },
  {
    heading: "Setup",
    lines: [
      "Place each ship horizontally or vertically; no overlaps, nothing off the board.",
      "Both players must confirm their fleet before firing starts.",
      "Ship positions stay hidden from the opponent.",
    ],
  },
  { heading: "Turns", lines: ["Fire at one unfired square per turn. Results: Miss, Hit or Sunk."] },
  { heading: "Win", lines: ["First to sink all five enemy ships."] },
];

function SeaBattle() {
  const search = Route.useSearch();
  const duo = useDuoGame<SBState>({ game: "sea-battle", search, initial: sbInitial });
  const s = duo.state;
  const seat = duo.mode === "local" ? s.turn : duo.seat;
  const opp = (seat === 0 ? 1 : 0) as 0 | 1;

  const [placing, setPlacing] = useState(0);
  const [horizontal, setHorizontal] = useState(true);
  const myBoard = s.boards[seat];
  const ready = s.ready[0] && s.ready[1];

  const setMyShips = (ships: Ship[], readyFlag = s.ready[seat]) => {
    const boards = [s.boards[0], s.boards[1]] as [typeof myBoard, typeof myBoard];
    boards[seat] = { ...boards[seat], ships };
    const rdy: [boolean, boolean] = [s.ready[0], s.ready[1]];
    rdy[seat] = readyFlag;
    duo.push({ ...s, boards, ready: rdy });
  };

  const place = (cell: number) => {
    if (s.ready[seat] || placing >= SB_FLEET.length) return;
    const spec = SB_FLEET[placing];
    const cells = shipCells(cell, spec.len, horizontal);
    if (!cells || !canPlace(myBoard.ships, cells)) {
      toast("That ship does not fit there.");
      return;
    }
    setMyShips([...myBoard.ships, { id: spec.id, name: spec.name, cells }]);
    setPlacing((p) => p + 1);
  };

  const fire = (cell: number) => {
    if (!ready || s.winner != null) return;
    if (!duo.canAct(s.turn)) return;
    const next = sbFire(s, s.turn, cell);
    if (next === s) return;
    duo.push(next);
    if (next.last) toast(next.last.result.toUpperCase());
  };

  const grid = (which: "mine" | "theirs") => {
    const board = which === "mine" ? myBoard : s.boards[opp];
    const shipCellsSet = new Set(which === "mine" ? board.ships.flatMap((sh) => sh.cells) : []);
    return (
      <div className="grid grid-cols-10 gap-[2px] rounded-2xl bg-velvet/60 p-2">
        {Array.from({ length: SB_SIZE * SB_SIZE }, (_, i) => {
          const shot = board.shots.includes(i);
          const hit = shot && board.ships.some((sh) => sh.cells.includes(i));
          const ship = shipCellsSet.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => (which === "mine" ? place(i) : fire(i))}
              className={`aspect-square rounded-[3px] text-[8px] ${
                hit
                  ? "bg-petal"
                  : shot
                    ? "bg-candle/25"
                    : ship
                      ? "bg-candle/70"
                      : "bg-surface-elevated/70 hover:bg-petal/20"
              }`}
            />
          );
        })}
      </div>
    );
  };

  const status = !ready
    ? s.ready[seat]
      ? "Fleet locked — waiting for your opponent."
      : placing < SB_FLEET.length
        ? `Place your ${SB_FLEET[placing].name} (${SB_FLEET[placing].len} cells)`
        : "Fleet placed — confirm to begin."
    : s.winner != null
      ? s.winner === seat
        ? "You sank the enemy fleet."
        : "Your fleet is gone."
      : duo.canAct(s.turn)
        ? "Your shot."
        : "Waiting for their shot…";

  return (
    <DuoGameFrame
      game={"sea-battle" as never}
      title="Sea Battle"
      tagline="Sink their fleet before they sink yours."
      rules={RULES}
      duo={duo}
      onReset={() => {
        setPlacing(0);
        duo.reset();
      }}
      status={<div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-candle">{status}</div>}
    >
      {!ready ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHorizontal((h) => !h)}
              className="px-4 py-2 rounded-full border border-border text-sm hover:border-petal/50"
            >
              {horizontal ? "Horizontal" : "Vertical"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMyShips(randomFleet());
                setPlacing(SB_FLEET.length);
              }}
              className="px-4 py-2 rounded-full border border-border text-sm hover:border-petal/50"
            >
              Random fleet
            </button>
            <button
              type="button"
              onClick={() => {
                setMyShips([]);
                setPlacing(0);
              }}
              className="px-4 py-2 rounded-full border border-border text-sm hover:border-petal/50"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={myBoard.ships.length < SB_FLEET.length || s.ready[seat]}
              onClick={() => setMyShips(myBoard.ships, true)}
              className="px-4 py-2 rounded-full bg-petal text-white text-sm disabled:opacity-40"
            >
              Confirm fleet
            </button>
          </div>
          {grid("mine")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-petal mb-2">Enemy waters</p>
            {grid("theirs")}
            <p className="text-[11px] text-candle-muted mt-2">
              Sunk: {sunkShips(s.boards[opp]).length}/{SB_FLEET.length}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-candle-muted mb-2">Your fleet</p>
            {grid("mine")}
            <p className="text-[11px] text-candle-muted mt-2">
              Lost: {sunkShips(myBoard).length}/{SB_FLEET.length}
            </p>
          </div>
        </div>
      )}
    </DuoGameFrame>
  );
}
