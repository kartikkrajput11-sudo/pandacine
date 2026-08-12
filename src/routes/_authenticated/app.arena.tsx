import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Crown, Gamepad2, Heart, MessageSquare, Trophy, Upload } from "lucide-react";
import { EditorialSectionHeader } from "@/components/editorial/SectionHeader";
import { AvatarImg } from "@/components/AvatarImg";
import { Button } from "@/components/ui/button";
import { LuviesAmount } from "@/components/luvies/LuviesAmount";
import { useLeaderboard, useTournament } from "@/hooks/useEarn";
import { ACTIVITY_RULES, WIN_BONUS, STREAK_BONUS } from "@/lib/earn";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/arena")({
  head: () => ({
    meta: [
      { title: "Arena — Tournaments & Leaderboards | PANDACINE" },
      {
        name: "description",
        content:
          "Enter the weekly PandaCine drawing tournament, climb the monthly message and game-win leaderboards, and earn Luvies together.",
      },
      { property: "og:title", content: "Arena — Tournaments & Leaderboards | PANDACINE" },
      {
        property: "og:description",
        content: "Weekly couple drawing contests, monthly leaderboards and Luvies rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Arena,
});

function countdown(iso?: string) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Voting closed";
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function Arena() {
  const { tournament, entries, myVote, submit, vote } = useTournament();
  const [tab, setTab] = useState<"messages" | "wins">("messages");
  const board = useLeaderboard(tab);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const t = tournament.data;
  const prizes: number[] = (t?.prizes as any) ?? [3000, 1500, 750];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 space-y-8">
      <Link to="/app" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-candle-muted">
        <ArrowLeft className="size-3.5" /> Home
      </Link>

      <header className="rounded-3xl glass p-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-petal">PandaCine Arena</p>
        <h1 className="mt-1 font-serif text-3xl italic md:text-4xl">Play, draw, climb, earn</h1>
        <p className="mt-2 max-w-xl text-sm text-candle-muted">
          Luvies are earned by living in PandaCine: minutes watched, minutes played, games won, and the weekly couple
          drawing tournament.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Earn label={ACTIVITY_RULES.watch.label} value={`${ACTIVITY_RULES.watch.rate}/min`} hint={`cap ${ACTIVITY_RULES.watch.cap}/day`} />
          <Earn label={ACTIVITY_RULES.game.label} value={`${ACTIVITY_RULES.game.rate}/min`} hint={`cap ${ACTIVITY_RULES.game.cap}/day`} />
          <Earn label="Game win" value={`+${WIN_BONUS}`} hint={`+${STREAK_BONUS} per streak win`} />
          <Earn label="Tournament" value={`${prizes[0]}`} hint="top couple, weekly" />
        </div>
      </header>

      {/* ---- Weekly drawing tournament ---- */}
      <section>
        <EditorialSectionHeader
          eyebrow="This week"
          title={t ? t.theme : "Loading this week's theme"}
          action={<span className="text-[11px] uppercase tracking-[0.2em] text-candle-muted">{countdown(t?.closes_at)}</span>}
        />

        <div className="rounded-3xl glass p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-candle-muted">
            <span className="inline-flex items-center gap-1.5 text-petal">
              <Trophy className="size-3.5" /> 1st <LuviesAmount value={prizes[0]} size="sm" />
            </span>
            <span>2nd <LuviesAmount value={prizes[1]} size="sm" /></span>
            <span>3rd <LuviesAmount value={prizes[2]} size="sm" /></span>
            <span className="text-candle-muted">· both partners paid</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <button
              onClick={() => fileRef.current?.click()}
              className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface/60 text-candle-muted transition hover:border-petal/60"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Your entry preview" className="size-full object-cover" />
              ) : (
                <Upload className="size-5" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your artwork"
              className="w-full rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-petal/60"
            />
            <Button
              disabled={!file || submit.isPending}
              onClick={() => file && submit.mutate({ file, title })}
            >
              Submit entry
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(entries.data ?? []).map((e, i) => {
              const voted = myVote.data === e.id;
              return (
                <article
                  key={e.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-surface/60",
                    voted ? "border-petal/60" : "border-border",
                  )}
                >
                  <div className="relative aspect-[4/3] bg-ink">
                    <AvatarImg src={e.image_url} alt={e.title} className="size-full object-cover" />
                    {i < 3 && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest text-white">
                        <Crown className="size-3" /> #{i + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-serif italic">{e.title}</p>
                      <p className="text-[11px] text-candle-muted">{e.votes} votes</p>
                    </div>
                    <Button
                      size="sm"
                      variant={voted ? "petal" : "quiet"}
                      disabled={vote.isPending}
                      onClick={() => vote.mutate(e.id)}
                    >
                      <Heart className={cn("size-3.5", voted && "fill-current")} /> {voted ? "Voted" : "Vote"}
                    </Button>
                  </div>
                </article>
              );
            })}
            {entries.data?.length === 0 && (
              <p className="text-sm text-candle-muted">No entries yet — be the first couple on the wall.</p>
            )}
          </div>
        </div>
      </section>

      {/* ---- Leaderboards ---- */}
      <section>
        <EditorialSectionHeader eyebrow="This month" title="Leaderboards" />
        <div className="rounded-3xl glass p-5">
          <div className="mb-4 flex gap-2">
            {([
              { key: "messages", label: "Messages", Icon: MessageSquare },
              { key: "wins", label: "Game wins", Icon: Gamepad2 },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] transition",
                  tab === key ? "bg-petal/15 text-petal" : "text-candle-muted",
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
          <ol className="space-y-2">
            {(board.data ?? []).map((r, i) => (
              <li
                key={r.user_id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface/60 px-3 py-2"
              >
                <span className="w-6 text-center font-serif italic text-petal">{i + 1}</span>
                <AvatarImg src={r.avatar_url} alt="" className="size-8 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{r.display_name}</p>
                  <p className="truncate text-[11px] text-candle-muted">@{r.username}</p>
                </div>
                <span className="tabular-nums text-sm text-petal">{r.total}</span>
              </li>
            ))}
            {board.data?.length === 0 && (
              <li className="text-sm text-candle-muted">Nothing yet this month — you could be first.</li>
            )}
          </ol>
          <p className="mt-4 text-[11px] text-candle-muted">
            Monthly winners are paid in Luvies at the start of each month.
          </p>
        </div>
      </section>
    </div>
  );
}

function Earn({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-3">
      <p className="text-[10px] uppercase tracking-widest text-candle-muted">{label}</p>
      <p className="mt-1 font-serif text-lg italic text-petal">{value}</p>
      <p className="text-[10px] text-candle-muted">{hint}</p>
    </div>
  );
}
