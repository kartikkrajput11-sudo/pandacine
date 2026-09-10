import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { C4_COLS, C4_ROWS, c4DropRow, c4Idx, c4Initial, c4Play, type C4State } from "@/lib/duo/connect4";

export const Route = createFileRoute("/_authenticated/app/four-in-a-row")({
  component: FourInARow,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Four In A Row — PandaCine" },
      { name: "description", content: "Drop, connect four and beat your panda live." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Connect four of your discs in a line before your opponent."] },
  { heading: "Players", lines: ["2 players, alternating turns."] },
  { heading: "Controls", lines: ["Tap a column to drop your disc into the lowest free slot."] },
  { heading: "Scoring", lines: ["No points — first four in a row wins."] },
  { heading: "Win", lines: ["Four in a row horizontally, vertically or diagonally."] },
  { heading: "Draw", lines: ["All 42 slots filled with no line."] },
  { heading: "Special", lines: ["Full columns cannot be played."] },
];

function FourInARow() {
  const search = Route.useSearch();
  const duo = useDuoGame<C4State>({ game: "four-in-a-row", search, initial: c4Initial });
  const s = duo.state;
  const mine = duo.seat;

  const play = (col: number) => {
    if (s.winner != null || !duo.canAct(s.turn)) return;
    if (c4DropRow(s.board, col) == null) return;
    duo.push(c4Play(s, col));
  };

  const colorFor = (v: 0 | 1 | null) =>
    v === 0 ? "bg-petal shadow-[0_0_14px_-2px_hsl(var(--petal))]" : v === 1 ? "bg-amber-300 shadow-[0_0_14px_-2px_rgba(252,211,77,0.7)]" : "bg-velvet/60";

  return (
    <DuoGameFrame
      game="four-in-a-row"
      title="Four In A Row"
      tagline="Drop, stack, connect four."
      rules={RULES}
      duo={duo}
      onReset={duo.reset}
      status={
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-candle">
          {s.winner === "draw"
            ? "Board full — a draw."
            : s.winner != null
              ? `${s.winner === mine || duo.mode === "local" ? (s.winner === 0 ? "Rose" : "Amber") : "Your opponent"} wins.`
              : duo.canAct(s.turn)
                ? "Your move — pick a column."
                : "Waiting for your opponent…"}
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-surface p-3">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${C4_COLS}, minmax(0,1fr))`, gap: 6 }}>
          {Array.from({ length: C4_ROWS * C4_COLS }, (_, i) => {
            const r = Math.floor(i / C4_COLS);
            const c = i % C4_COLS;
            const v = s.board[c4Idx(r, c)];
            const win = s.line?.includes(c4Idx(r, c));
            return (
              <button
                key={i}
                type="button"
                onClick={() => play(c)}
                className={`aspect-square rounded-full border transition-transform active:scale-95 ${
                  win ? "border-petal ring-2 ring-petal/60" : "border-border/70"
                } ${colorFor(v)}`}
                aria-label={`Column ${c + 1}`}
              />
            );
          })}
        </div>
      </div>
    </DuoGameFrame>
  );
}
