import { useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, RotateCcw, User, Users, X } from "lucide-react";
import { GameBackLink } from "@/components/games/GameBackLink";
import { GameChat } from "@/components/games/GameChat";
import { GameRoomBadge } from "@/components/games/GameRoomBadge";
import { InviteFriendCard } from "@/components/games/InviteFriendCard";
import type { GameKind } from "@/lib/games";
import type { DuoMode } from "@/hooks/useDuoGame";

export type RuleBlock = { heading: string; lines: string[] };

/**
 * Shared shell for the duo games: mode picker, header, rules modal,
 * in-game chat and the room badge. Keeps every new game visually and
 * structurally identical to Chess / Ludo.
 */
export function DuoGameFrame({
  game,
  title,
  tagline,
  rules,
  duo,
  onReset,
  status,
  immersive = false,
  children,
}: {
  game: GameKind;
  title: string;
  tagline: string;
  rules: RuleBlock[];
  duo: {
    me: { id: string; display_name?: string | null } | null | undefined;
    partner?: { id: string; display_name?: string | null } | null;
    mode: DuoMode | null;
    setMode: (m: DuoMode) => void;
    roomKey: string;
    partnerRoom: boolean;
  };
  onReset?: () => void;
  status?: ReactNode;
  immersive?: boolean;
  children: ReactNode;
}) {
  const [showRules, setShowRules] = useState(false);
  const { me, partner, mode, setMode, roomKey, partnerRoom } = duo;

  if (!mode) {
    return (
      <div className="min-h-dvh px-5 pt-10 pb-24">
        <Header title={title} tagline={tagline} onRules={() => setShowRules(true)} />
        <div className="max-w-md mx-auto mt-8 space-y-3">
          <button
            type="button"
            disabled={!partner}
            onClick={() => setMode("partner")}
            className="w-full p-5 rounded-3xl bg-surface border border-border hover:border-petal/50 transition-colors text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <Users className="size-5 text-petal" />
              <div>
                <p className="font-serif italic text-lg">
                  {partner ? `Play ${partner.display_name ?? "your panda"}` : "Play live"}
                </p>
                <p className="text-[11px] text-candle-muted">
                  {partner ? "Live, turn by turn." : "Pair or invite a friend first."}
                </p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("local")}
            className="w-full p-5 rounded-3xl bg-surface border border-border hover:border-petal/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <User className="size-5 text-petal" />
              <div>
                <p className="font-serif italic text-lg">Side-by-side</p>
                <p className="text-[11px] text-candle-muted">Pass one device between you.</p>
              </div>
            </div>
          </button>
          <InviteFriendCard game={game} />
        </div>
        <RulesModal open={showRules} onClose={() => setShowRules(false)} title={title} rules={rules} />
      </div>
    );
  }

  return (
    <div className={immersive ? "min-h-dvh pb-28" : "min-h-dvh px-4 pt-8 pb-28"}>
      {!immersive && <Header title={title} tagline={tagline} onRules={() => setShowRules(true)} onReset={onReset} />}
      {status && <div className={immersive ? "mx-auto" : "max-w-3xl mx-auto mt-3"}>{status}</div>}
      <div className={immersive ? "mx-auto" : "max-w-3xl mx-auto mt-4"}>{children}</div>
      {mode === "partner" && partner && (
        <>
          <GameChat roomKey={roomKey} me={me} partnerName={partner.display_name} />
          <GameRoomBadge partnerRoom={partnerRoom} name={partner.display_name} />
        </>
      )}
      <RulesModal open={showRules} onClose={() => setShowRules(false)} title={title} rules={rules} />
    </div>
  );
}

function Header({
  title,
  tagline,
  onRules,
  onReset,
}: {
  title: string;
  tagline: string;
  onRules: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto flex items-start gap-3">
      <GameBackLink className="inline-flex items-center justify-center size-9 rounded-full text-candle-muted hover:bg-surface hover:text-candle transition-colors">
        <ArrowLeft className="size-5" />
      </GameBackLink>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.28em] text-petal">Duo · 2 players</p>
        <h1 className="font-serif italic text-2xl leading-tight">{title}</h1>
        <p className="text-[11px] text-candle-muted">{tagline}</p>
      </div>
      <div className="flex items-center gap-2">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Restart"
            className="inline-flex items-center justify-center size-9 rounded-full border border-border text-candle-muted hover:text-candle hover:border-petal/50 transition-colors"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onRules}
          title="Rules"
          className="inline-flex items-center justify-center size-9 rounded-full border border-border text-candle-muted hover:text-candle hover:border-petal/50 transition-colors"
        >
          <BookOpen className="size-4" />
        </button>
      </div>
    </div>
  );
}

function RulesModal({
  open,
  onClose,
  title,
  rules,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  rules: RuleBlock[];
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-surface-elevated border border-border rounded-t-3xl sm:rounded-3xl p-5 max-h-[85dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-petal">How to play</p>
            <p className="font-serif italic text-lg">{title}</p>
          </div>
          <button onClick={onClose} className="text-candle-muted hover:text-candle">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4">
          {rules.map((r) => (
            <div key={r.heading}>
              <p className="text-[10px] uppercase tracking-[0.2em] text-candle-muted mb-1">{r.heading}</p>
              <ul className="space-y-1">
                {r.lines.map((l, i) => (
                  <li key={i} className="text-sm text-candle/90 leading-snug">
                    · {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
