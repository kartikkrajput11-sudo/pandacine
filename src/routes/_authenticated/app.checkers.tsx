import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDuoGame, duoSearch } from "@/hooks/useDuoGame";
import { DuoGameFrame } from "@/components/games/DuoGameFrame";
import { ckApply, ckInitial, isDark, legalMoves, rc, type CkState } from "@/lib/duo/checkers";

export const Route = createFileRoute("/_authenticated/app/checkers")({
  component: CheckersPage,
  validateSearch: duoSearch,
  head: () => ({
    meta: [
      { title: "Checkers — PandaCine" },
      { name: "description", content: "Classic checkers with forced captures, live with your panda." },
    ],
  }),
});

const RULES = [
  { heading: "Objective", lines: ["Capture every opposing piece, or leave them with no legal move."] },
  { heading: "Players", lines: ["2 players, alternating turns on the dark squares."] },
  { heading: "Controls", lines: ["Tap one of your pieces, then tap a highlighted square."] },
  { heading: "Movement", lines: ["Men move one square diagonally forward. Kings move forward and backward."] },
  {
    heading: "Special",
    lines: [
      "Captures are mandatory — if a jump exists you must take it.",
      "Multi-jumps continue with the same piece until no more jumps remain.",
      "Reaching the far row crowns a King and ends the turn.",
    ],
  },
  { heading: "Win", lines: ["Opponent has no pieces left, or no legal moves."] },
];

function CheckersPage() {
  const search = Route.useSearch();
  const duo = useDuoGame<CkState>({ game: "checkers", search, initial: ckInitial });
  const s = duo.state;
  const [sel, setSel] = useState<number | null>(null);
  const moves = useMemo(() => legalMoves(s), [s]);
  const myTurn = duo.canAct(s.turn);

  const selMoves = sel == null ? [] : moves.filter((m) => m.from === sel);

  const tap = (i: number) => {
    if (s.winner != null || !myTurn) return;
    const mv = selMoves.find((m) => m.to === i);
    if (mv) {
      const next = ckApply(s, mv);
      duo.push(next);
      setSel(next.chain);
      return;
    }
    if (s.chain != null) return setSel(s.chain);
    if (moves.some((m) => m.from === i)) setSel(i);
    else setSel(null);
  };

  return (
    <DuoGameFrame
      game="checkers"
      title="Checkers"
      tagline="Forced captures, crowned kings."
      rules={RULES}
      duo={duo}
      onReset={() => {
        setSel(null);
        duo.reset();
      }}
      status={
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-candle">
          {s.winner != null
            ? `${s.winner === 0 ? "Ivory" : "Rose"} wins.`
            : s.chain != null
              ? "Chain capture — keep jumping."
              : myTurn
                ? "Your move."
                : "Waiting for your opponent…"}
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-surface p-3">
        <div className="grid grid-cols-8 gap-0 rounded-2xl overflow-hidden">
          {Array.from({ length: 64 }, (_, i) => {
            const [r, c] = rc(i);
            const dark = isDark(r, c);
            const pc = s.board[i];
            const target = selMoves.some((m) => m.to === i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => tap(i)}
                className={`aspect-square flex items-center justify-center ${
                  dark ? "bg-velvet/70" : "bg-surface-elevated"
                } ${target ? "ring-2 ring-inset ring-petal/80" : ""}`}
              >
                {pc && (
                  <span
                    className={`size-[76%] rounded-full flex items-center justify-center text-[10px] font-bold ${
                      pc.p === 0
                        ? "bg-candle text-velvet"
                        : "bg-petal text-white"
                    } ${sel === i ? "ring-2 ring-petal ring-offset-2 ring-offset-velvet" : ""}`}
                  >
                    {pc.king ? "K" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </DuoGameFrame>
  );
}
