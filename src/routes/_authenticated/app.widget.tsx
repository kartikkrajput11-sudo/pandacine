import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { computeCountdown, daysTogether, milestoneLabel, nextAnniversary, nextMilestone } from "@/lib/anniversary";
import { useStreak } from "@/hooks/useStreak";
import { ArrowLeft, Flame, Share2, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/widget")({
  component: WidgetPage,
  head: () => ({
    meta: [
      { title: "Anniversary Widget — PANDACINE" },
      {
        name: "description",
        content: "A live anniversary countdown you can pin to your phone's home screen — days, hours and minutes until your next milestone.",
      },
      { property: "og:title", content: "Anniversary Widget — PANDACINE" },
      { property: "og:description", content: "Pin a live anniversary countdown to your home screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function WidgetPage() {
  const { data } = useProfile();
  const profile = data?.profile;
  const partner = data?.partner;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { streak = 0 } = useStreak(profile?.id ?? "", profile?.partner_id ?? null);

  const ann = nextAnniversary(profile?.anniversary_date ?? null, profile?.paired_at ?? null);
  const milestone = ann ? nextMilestone(ann.base) : null;
  const target = ann
    ? milestone && milestone.target.getTime() < ann.next.getTime()
      ? milestone.target
      : ann.next
    : null;
  const label = ann
    ? milestone && milestone.target.getTime() < ann.next.getTime()
      ? milestoneLabel(milestone.days)
      : `Year ${ann.years}`
    : "";
  const cd = target ? computeCountdown(target, now) : null;
  const together = ann ? daysTogether(ann.base) : 0;

  const accent = profile?.favorite_color ?? "#f87171";

  const share = async () => {
    const url = `${window.location.origin}/app/widget`;
    try {
      if (navigator.share) await navigator.share({ title: "Our countdown", url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="relative min-h-[100dvh] px-5 pt-8 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app" className="grid size-10 place-items-center rounded-full glass" aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Home screen</p>
          <h1 className="font-serif text-2xl italic leading-tight">Anniversary Widget</h1>
        </div>
      </div>

      {/* The widget face */}
      <div
        className="relative overflow-hidden rounded-[32px] p-7 glass-strong text-center"
        style={{ boxShadow: `0 30px 90px -45px ${accent}aa, inset 0 1px 0 rgba(255,255,255,.08)` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl opacity-40"
          style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
        />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">
            {partner ? `${profile?.display_name?.split(" ")[0] ?? "You"} & ${partner.display_name.split(" ")[0]}` : "Pair up to begin"}
          </p>

          {cd ? (
            <>
              <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-petal">{label} in</p>
              <div className="mt-3 flex items-end justify-center gap-3">
                <Unit value={cd.days} unit="days" big />
                <Unit value={cd.hours} unit="hrs" />
                <Unit value={cd.minutes} unit="min" />
                <Unit value={cd.seconds} unit="sec" />
              </div>
              <p className="mt-4 text-xs text-candle-muted">
                {together.toLocaleString()} days together {profile?.favorite_emoji ?? "🌸"}
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-candle-muted">
              Add your anniversary date in your profile to start the countdown.
            </p>
          )}

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-petal/30 bg-petal/10 px-4 py-1.5 text-xs">
            <Flame className="size-3.5 text-petal" />
            {streak} day streak
          </div>
        </div>
      </div>

      {/* Install instructions */}
      <section className="rounded-3xl glass p-5 space-y-3">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-petal">
          <Smartphone className="size-3.5" /> Put it on your home screen
        </p>
        <ol className="space-y-2 text-sm text-candle-muted">
          <li>
            <b className="text-candle">iPhone:</b> open this page in Safari → Share → “Add to Home Screen”. Tap the new
            icon anytime for a live countdown.
          </li>
          <li>
            <b className="text-candle">Android:</b> open in Chrome → menu (⋮) → “Add to Home screen”. Long-press the
            icon and pick <i>Anniversary countdown</i> for a one-tap shortcut.
          </li>
        </ol>
        <button
          onClick={share}
          className="inline-flex items-center gap-2 rounded-full bg-petal px-4 py-2 text-xs font-semibold text-velvet active:scale-95 transition-transform"
        >
          <Share2 className="size-3.5" /> Share this widget link
        </button>
        <p className="text-[11px] text-candle-muted">
          The countdown updates in real time every second while the widget is open.
        </p>
      </section>
    </div>
  );
}

function Unit({ value, unit, big }: { value: number; unit: string; big?: boolean }) {
  return (
    <div className="min-w-[3.2rem]">
      <p className={`font-serif italic leading-none ${big ? "text-5xl" : "text-3xl"}`}>
        {String(value).padStart(2, "0")}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-candle-muted">{unit}</p>
    </div>
  );
}
