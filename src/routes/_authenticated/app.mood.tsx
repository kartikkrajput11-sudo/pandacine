import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AvatarImg } from "@/components/AvatarImg";

export const Route = createFileRoute("/_authenticated/app/mood")({
  component: MoodPage,
});

type Entry = {
  user_id: string;
  date: string;
  emoji: string | null;
  label: string | null;
  score: number;
};

const SCALE: { score: number; emoji: string; label: string }[] = [
  { score: 1, emoji: "🌧️", label: "Rough" },
  { score: 2, emoji: "😔", label: "Low" },
  { score: 3, emoji: "😌", label: "Steady" },
  { score: 4, emoji: "😊", label: "Bright" },
  { score: 5, emoji: "🥰", label: "Glowing" },
];

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
] as const;

const MINE = "var(--petal)";
const THEIRS = "var(--gilt)";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function MoodPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [range, setRange] = useState<number>(14);
  const [saving, setSaving] = useState(false);

  const today = dayKey(new Date());
  const myToday = entries.find((e) => e.user_id === me?.id && e.date === today);
  const theirToday = entries.find((e) => e.user_id === partner?.id && e.date === today);

  async function load() {
    if (!me) return;
    const since = dayKey(new Date(Date.now() - 32 * 86400000));
    const { data: rows, error } = await (supabase as any)
      .from("mood_log")
      .select("user_id,date,emoji,label,score")
      .gte("date", since)
      .order("date", { ascending: true });
    if (error) return;
    setEntries((rows ?? []) as Entry[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, partner?.id]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("mood_log_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "mood_log" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  async function log(item: (typeof SCALE)[number]) {
    if (!me || saving) return;
    setSaving(true);
    // optimistic
    setEntries((prev) => {
      const rest = prev.filter((e) => !(e.user_id === me.id && e.date === today));
      return [...rest, { user_id: me.id, date: today, score: item.score, emoji: item.emoji, label: item.label }];
    });
    const { error } = await (supabase as any).from("mood_log").upsert(
      { user_id: me.id, date: today, score: item.score, emoji: item.emoji, label: item.label },
      { onConflict: "user_id,date" },
    );
    setSaving(false);
    if (error) {
      toast.error("Couldn't save your mood");
      load();
    }
  }

  const days = useMemo(
    () =>
      Array.from({ length: range }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (range - 1 - i));
        return dayKey(d);
      }),
    [range],
  );

  const mine = useMemo(
    () => days.map((d) => entries.find((e) => e.user_id === me?.id && e.date === d)?.score ?? null),
    [days, entries, me?.id],
  );
  const theirs = useMemo(
    () => days.map((d) => entries.find((e) => e.user_id === partner?.id && e.date === d)?.score ?? null),
    [days, entries, partner?.id],
  );

  const myAvg = average(mine);
  const theirAvg = average(theirs);
  const sync = syncScore(mine, theirs);

  return (
    <div className="px-5 pt-10 pb-14 max-w-5xl mx-auto">
      <header className="flex items-center gap-3 mb-7">
        <Link to="/app" className="text-candle-muted hover:text-candle transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-petal">Together</p>
          <h1 className="font-serif text-3xl italic leading-tight">Mood</h1>
        </div>
      </header>

      {/* Today */}
      <section className="rounded-3xl border border-border bg-surface/70 backdrop-blur-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.26em] text-candle-muted">How are you today?</p>
          {myToday && (
            <span className="inline-flex items-center gap-1 text-[10px] text-petal">
              <Check className="size-3" /> Saved
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {SCALE.map((s) => {
            const active = myToday?.score === s.score;
            return (
              <button
                key={s.score}
                onClick={() => log(s)}
                disabled={saving}
                className={`group rounded-2xl border py-4 flex flex-col items-center gap-1.5 transition-all active:scale-95 ${
                  active
                    ? "border-petal/60 bg-petal-soft shadow-[0_10px_30px_-16px_var(--petal)]"
                    : "border-border bg-velvet/60 hover:border-petal/35"
                }`}
              >
                <span className="text-2xl sm:text-3xl transition-transform group-hover:scale-110">{s.emoji}</span>
                <span className="text-[10px] tracking-wide text-candle-muted">{s.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pair snapshot */}
      <section className="grid gap-3 sm:grid-cols-2 mb-5">
        <PersonCard
          name="You"
          avatar={me?.avatar_url ?? null}
          label={myToday ? `${myToday.emoji} ${myToday.label}` : "Not logged yet"}
          avg={myAvg}
          accent={MINE}
        />
        <PersonCard
          name={partner?.display_name ?? "Your partner"}
          avatar={partner?.avatar_url ?? null}
          label={
            !partner ? "Invite them to share moods" : theirToday ? `${theirToday.emoji} ${theirToday.label}` : "Not logged yet"
          }
          avg={theirAvg}
          accent={THEIRS}
        />
      </section>

      {/* Graph */}
      <section className="rounded-3xl border border-border bg-surface/70 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-candle-muted">The curve</p>
            <p className="font-serif text-xl italic">Last {range} days</p>
          </div>
          <div className="flex rounded-full border border-border p-0.5 bg-velvet/60">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
                  range === r.days ? "bg-petal text-velvet" : "text-candle-muted hover:text-candle"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <MoodChart
          days={days}
          mine={mine}
          theirs={partner ? theirs : null}
          partnerName={partner?.display_name ?? "Partner"}
        />

        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-candle-muted">
          <Legend color={MINE} label={`You · avg ${myAvg ? myAvg.toFixed(1) : "—"}`} />
          {partner && <Legend color={THEIRS} label={`${partner.display_name} · avg ${theirAvg ? theirAvg.toFixed(1) : "—"}`} />}
          {partner && sync !== null && (
            <span className="ml-auto rounded-full border border-petal/30 bg-petal-soft px-3 py-1 text-petal">
              In sync {sync}%
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function PersonCard({
  name,
  avatar,
  label,
  avg,
  accent,
}: {
  name: string;
  avatar: string | null;
  label: string;
  avg: number;
  accent: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface/70 backdrop-blur-xl p-4 flex items-center gap-4">
      <AvatarImg src={avatar} alt={name} className="size-12 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.24em] text-candle-muted truncate">{name}</p>
        <p className="font-serif text-lg italic truncate leading-tight">{label}</p>
      </div>
      <div className="text-right">
        <p className="text-[9px] uppercase tracking-[0.24em] text-candle-muted">Avg</p>
        <p className="font-serif text-2xl italic" style={{ color: accent }}>
          {avg ? avg.toFixed(1) : "—"}
        </p>
      </div>
    </div>
  );
}

/** Editorial line chart — smooth curves, soft area fill, quiet gridlines. */
function MoodChart({
  days,
  mine,
  theirs,
}: {
  days: string[];
  mine: (number | null)[];
  theirs: (number | null)[] | null;
}) {
  const W = 720;
  const H = 220;
  const padX = 14;
  const padY = 18;
  const stepX = (W - padX * 2) / Math.max(1, days.length - 1);
  const y = (v: number) => padY + (1 - (v - 1) / 4) * (H - padY * 2);
  const x = (i: number) => padX + i * stepX;

  const path = (series: (number | null)[]) => {
    const pts = series.map((v, i) => (v == null ? null : { x: x(i), y: y(v) }));
    let d = "";
    let open = false;
    pts.forEach((p, i) => {
      if (!p) {
        open = false;
        return;
      }
      if (!open) {
        d += `M${p.x},${p.y}`;
        open = true;
        return;
      }
      const prev = pts[i - 1]!;
      const cx = (prev.x + p.x) / 2;
      d += ` C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    });
    return d;
  };

  const hasAny = mine.some((v) => v != null) || (theirs?.some((v) => v != null) ?? false);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MINE} stopOpacity="0.28" />
            <stop offset="100%" stopColor={MINE} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[1, 2, 3, 4, 5].map((v) => (
          <line
            key={v}
            x1={padX}
            x2={W - padX}
            y1={y(v)}
            y2={y(v)}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
            strokeDasharray={v === 3 ? "0" : "3 7"}
            opacity={v === 3 ? 0.8 : 0.5}
          />
        ))}

        {mine.some((v) => v != null) && (
          <>
            <path
              d={`${path(mine)} L${x(days.length - 1)},${H - padY} L${x(0)},${H - padY} Z`}
              fill="url(#mineFill)"
              opacity={0.9}
            />
            <path d={path(mine)} fill="none" stroke={MINE} strokeWidth={2.5} strokeLinecap="round" />
          </>
        )}
        {theirs && <path d={path(theirs)} fill="none" stroke={THEIRS} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="6 6" />}

        {mine.map((v, i) =>
          v == null ? null : <circle key={`m${i}`} cx={x(i)} cy={y(v)} r={3.5} fill={MINE} />,
        )}
        {theirs?.map((v, i) => (v == null ? null : <circle key={`t${i}`} cx={x(i)} cy={y(v)} r={3.5} fill={THEIRS} />))}
      </svg>

      {!hasAny && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-xs text-candle-muted italic">No moods logged yet — start with today.</p>
        </div>
      )}

      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-[0.2em] text-candle-muted">
        <span>{formatDay(days[0])}</span>
        <span>{formatDay(days[Math.floor(days.length / 2)])}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function formatDay(iso?: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function average(series: (number | null)[]) {
  const v = series.filter((n): n is number => n != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/** How closely the two curves track each other, 0–100. */
function syncScore(a: (number | null)[], b: (number | null)[]) {
  const pairs = a.map((v, i) => [v, b[i]] as const).filter(([x, y]) => x != null && y != null) as [number, number][];
  if (pairs.length < 2) return null;
  const diff = pairs.reduce((sum, [x, y]) => sum + Math.abs(x - y), 0) / pairs.length;
  return Math.round(Math.max(0, 1 - diff / 4) * 100);
}
