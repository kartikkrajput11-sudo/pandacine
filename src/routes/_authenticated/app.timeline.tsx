import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, BookHeart, Milestone, Sparkles, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/timeline")({
  component: TimelinePage,
  head: () => ({
    meta: [
      { title: "Timeline · Highlights of us — PANDACINE" },
      { name: "description", content: "Your love story, unspooled beat by beat." },
      { property: "og:title", content: "Timeline · Highlights of us" },
      { property: "og:description", content: "Your love story, unspooled beat by beat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Memory = {
  id: string;
  title: string;
  body: string | null;
  mood: string | null;
  happened_on: string | null;
  created_at: string;
};

type Kind = "anniversary" | "memory" | "milestone" | "today";

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  body?: string | null;
  mood?: string | null;
  kind: Kind;
};

const KIND_META: Record<Kind, { Icon: typeof Heart; label: string }> = {
  anniversary: { Icon: Heart, label: "Anniversary" },
  memory: { Icon: BookHeart, label: "Memory" },
  milestone: { Icon: Milestone, label: "Milestone" },
  today: { Icon: Sparkles, label: "Today" },
};

const MOODS = ["💜", "🌸", "✨", "🕯️", "🌙", "🐼", "🍷", "☕"];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtMonth = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
const daysBetween = (a: string, b: string) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

function TimelinePage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const [memories, setMemories] = useState<Memory[]>([]);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("💜");
  const [happened, setHappened] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    const { data: rows } = await (supabase as any)
      .from("memory_jar")
      .select("id,title,body,mood,happened_on,created_at")
      .order("happened_on", { ascending: true, nullsFirst: false });
    setMemories((rows ?? []) as Memory[]);
  }

  useEffect(() => {
    if (!me) return;
    void load();
    const ch = supabase
      .channel("timeline_memories")
      .on("postgres_changes", { event: "*", schema: "public", table: "memory_jar" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me?.id]);

  async function addHighlight(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !me || saving) return;
    setSaving(true);
    const { error } = await (supabase as any).from("memory_jar").insert({
      author_id: me.id,
      partner_id: partner?.id ?? null,
      title: title.trim(),
      body: body.trim() || null,
      mood,
      happened_on: happened,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setBody("");
    setComposing(false);
    toast.success("Highlight added to your timeline ✨");
    void load();
  }

  const items = useMemo<TimelineItem[]>(() => {
    const list: TimelineItem[] = [];
    const anniv = me?.anniversary_date;
    if (anniv) {
      list.push({
        id: "anniv",
        date: anniv,
        title: "The day we began",
        body: partner?.display_name
          ? `You & ${me?.partner_nickname || partner.display_name}. The first spark.`
          : "The first spark.",
        mood: "💗",
        kind: "anniversary",
      });
    }
    for (const m of memories) {
      list.push({
        id: m.id,
        date: m.happened_on ?? m.created_at,
        title: m.title,
        body: m.body,
        mood: m.mood,
        kind: "memory",
      });
    }
    if (anniv) {
      const days = daysBetween(anniv, new Date().toISOString());
      const hundred = Math.floor(days / 100) * 100;
      if (hundred >= 100) {
        list.push({
          id: `ms-${hundred}`,
          date: new Date(new Date(anniv).getTime() + hundred * 86400000).toISOString(),
          title: `${hundred} days together`,
          body: "A quiet, wonderful number.",
          mood: "✨",
          kind: "milestone",
        });
      }
    }
    list.push({
      id: "today",
      date: new Date().toISOString(),
      title: "Today",
      body: "Still writing this story, together.",
      mood: "💜",
      kind: "today",
    });
    return list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [me?.anniversary_date, me?.partner_nickname, partner?.display_name, memories]);

  const groups = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const it of items) {
      const key = it.date.slice(0, 7);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  const daysTotal = me?.anniversary_date
    ? daysBetween(me.anniversary_date, new Date().toISOString())
    : null;

  return (
    <div className="relative px-5 pt-10 pb-28 max-w-2xl mx-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[300px]"
        style={{
          background: "radial-gradient(70% 60% at 50% 0%, var(--petal-soft), transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-7">
        <Link
          to="/app"
          aria-label="Back"
          className="size-9 rounded-full grid place-items-center bg-surface/60 border border-border text-candle-muted hover:text-candle transition"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.35em] text-petal">Signature</p>
          <h1 className="font-serif text-2xl italic truncate">Our timeline</h1>
        </div>
        <Button
          variant={composing ? "quiet" : "petal"}
          size="pill"
          onClick={() => setComposing((c) => !c)}
        >
          {composing ? <X className="size-4" /> : <Plus className="size-4" />}
          <span className="hidden sm:inline">{composing ? "Close" : "Add highlight"}</span>
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <Stat value={items.length} label="Chapters" />
        <Stat value={daysTotal ?? "—"} label="Days" />
        <Stat value={memories.length} label="Highlights" />
      </div>

      {/* Composer */}
      {composing && (
        <form
          onSubmit={addHighlight}
          className="mb-7 space-y-3 rounded-3xl border border-petal/30 bg-surface/70 backdrop-blur p-5 animate-fade-in"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-petal">New highlight</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What happened?"
            autoFocus
            className="w-full bg-velvet/50 border border-border rounded-xl px-3 py-2.5 text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/50"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Tell the story…"
            className="w-full resize-none bg-velvet/50 border border-border rounded-xl px-3 py-2.5 text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/50"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {MOODS.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMood(m)}
                className={`size-9 rounded-xl grid place-items-center border text-lg transition ${
                  mood === m
                    ? "bg-petal/20 border-petal/60 scale-105"
                    : "bg-velvet/50 border-border hover:border-petal/40"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={happened}
            onChange={(e) => setHappened(e.target.value)}
            className="w-full bg-velvet/50 border border-border rounded-xl px-3 py-2.5 text-sm text-candle focus:outline-none focus:border-petal/50"
          />
          <Button type="submit" variant="petal" size="block" disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Add to timeline"}
          </Button>
        </form>
      )}

      {/* Timeline */}
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center">
          <p className="font-serif italic text-xl mb-1">Nothing here yet</p>
          <p className="text-sm text-candle-muted">
            Add a highlight or set your anniversary to begin the story.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([month, list]) => (
            <section key={month}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-petal">
                  {fmtMonth(month + "-01")}
                </p>
                <span className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-candle-muted tabular-nums">{list.length}</span>
              </div>

              <ol className="relative pl-7">
                <span
                  aria-hidden
                  className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-petal/40 via-border to-transparent"
                />
                {list.map((it) => {
                  const { Icon, label } = KIND_META[it.kind];
                  return (
                    <li key={it.id} className="relative pb-4 last:pb-0">
                      <span className="absolute -left-7 top-4 grid size-6 place-items-center rounded-full border border-petal/40 bg-velvet">
                        <Icon className="size-3 text-petal" />
                      </span>
                      <article className="rounded-2xl border border-border bg-surface/70 backdrop-blur p-4 transition hover:border-petal/40">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] uppercase tracking-[0.25em] text-petal">
                            {label}
                          </span>
                          <span className="ml-auto text-[10px] text-candle-muted tabular-nums">
                            {fmtDate(it.date)}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          {it.mood && <span className="text-xl leading-none pt-0.5">{it.mood}</span>}
                          <div className="min-w-0">
                            <h3 className="font-serif italic text-lg leading-snug">{it.title}</h3>
                            {it.body && (
                              <p className="text-sm text-candle-muted mt-1 leading-relaxed whitespace-pre-wrap">
                                {it.body}
                              </p>
                            )}
                            {me?.anniversary_date && (
                              <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-candle-muted/70">
                                Day {Math.max(0, daysBetween(me.anniversary_date, it.date))}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/70 backdrop-blur px-3 py-3 text-center">
      <p className="font-serif text-2xl italic tabular-nums text-candle">{value}</p>
      <p className="text-[9px] uppercase tracking-[0.3em] text-candle-muted mt-0.5">{label}</p>
    </div>
  );
}
