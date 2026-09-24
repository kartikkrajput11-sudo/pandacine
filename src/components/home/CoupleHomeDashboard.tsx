import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookHeart,
  CalendarHeart,
  Clapperboard,
  Compass,
  Feather,
  Film,
  Gamepad2,
  Gift,
  Heart,
  LineChart,
  MapPin,
  ShoppingBag,
  Sparkles,
  Smartphone,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { CountdownCard } from "@/components/CountdownCard";
import { DailyQuestionCard } from "@/components/DailyQuestionCard";
import { MemoryOfTheDayCard } from "@/components/MemoryOfTheDayCard";
import NotificationCenter from "@/components/NotificationCenter";
import { Petals } from "@/components/Petals";
import { QuickActions } from "@/components/QuickActions";
import { StreakBadge } from "@/components/StreakBadge";
import { StreakRecoveryCard } from "@/components/StreakRecoveryCard";
import { AvatarImg } from "@/components/AvatarImg";
import { Button } from "@/components/ui/button";
import { LuviesAmount } from "@/components/luvies/LuviesAmount";
import { useLuviesWallet } from "@/hooks/useLuvies";
import { useProfile } from "@/hooks/useProfile";
import { CoupleHomeScene } from "./CoupleHomeScene";

type Destination = {
  to: string;
  label: string;
  caption: string;
  Icon: LucideIcon;
  search?: Record<string, string>;
};

const TONIGHT: Destination[] = [
  { to: "/app/movies", label: "Watch together", caption: "Pick tonight’s film", Icon: Film, search: { q: "" } },
  { to: "/app/play", label: "Play together", caption: "A little rivalry", Icon: Gamepad2 },
  { to: "/app/concierge", label: "Date concierge", caption: "An idea made for two", Icon: Compass },
  { to: "/app/daily-challenge", label: "Daily challenge", caption: "One small shared mission", Icon: Sparkles },
];

const OUR_STORY: Destination[] = [
  { to: "/app/memories", label: "Memories", caption: "The moments you kept", Icon: BookHeart },
  { to: "/app/timeline", label: "Timeline", caption: "Your story in order", Icon: Clapperboard },
  { to: "/app/letters", label: "Love letters", caption: "Seal now, open later", Icon: Feather },
  { to: "/app/calendar", label: "Calendar", caption: "Every date that matters", Icon: CalendarHeart },
  { to: "/app/journal", label: "Our journal", caption: "Write life together", Icon: BookHeart },
  { to: "/app/anniversary", label: "Anniversary", caption: "Celebrate your chapter", Icon: Heart },
  { to: "/app/bucket", label: "Bucket list", caption: "Dreams to share", Icon: MapPin },
  { to: "/app/wishlist", label: "Wishlist", caption: "Little things you love", Icon: Gift },
];

const OUR_WORLD: Destination[] = [
  { to: "/app/wallet", label: "Wallet", caption: "Your shared rewards", Icon: Wallet },
  { to: "/app/arena", label: "Arena", caption: "Weekly tournaments", Icon: Trophy },
  { to: "/app/panda-shop", label: "Panda shop", caption: "Dress your companion", Icon: ShoppingBag },
  { to: "/app/shop", label: "Tag shop", caption: "Collect profile titles", Icon: Sparkles },
  { to: "/app/friends", label: "Friends", caption: "Your circle", Icon: Users },
  { to: "/app/widget", label: "Home widget", caption: "Keep the countdown close", Icon: Smartphone },
];

export function CoupleHomeDashboard() {
  const { data, isLoading } = useProfile();
  const { data: wallet } = useLuviesWallet();
  const profile = data?.profile;
  const partner = data?.partner;
  const partnerName = partner ? profile?.partner_nickname || partner.display_name : "your panda";
  const firstName = profile?.display_name?.split(" ")[0] ?? "Friend";

  return (
    <div className="relative overflow-x-clip px-4 pb-10 pt-7 sm:px-6 sm:pt-10">
      <Petals count={3} />
      <header className="relative z-20 mb-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-petal">{greeting()}</p>
          <h1 className="mt-1 truncate font-serif text-3xl italic sm:text-4xl">
            {isLoading ? "Opening your world…" : `Hello, ${firstName}.`}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/app/wallet"
            aria-label="Open wallet"
            className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs text-candle sm:flex"
          >
            <Wallet className="size-3.5 text-petal" />
            <LuviesAmount value={wallet?.balance ?? 0} />
          </Link>
          <NotificationCenter />
          <Link
            to="/app/me"
            aria-label="Open profile"
            className="grid size-10 place-items-center overflow-hidden rounded-full border border-border bg-surface active:scale-95"
          >
            {profile?.avatar_url ? (
              <AvatarImg src={profile.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-serif italic text-petal">{firstName[0]?.toUpperCase() ?? "P"}</span>
            )}
          </Link>
        </div>
      </header>

      {!isLoading && profile && partner ? (
        <div className="relative z-10 space-y-8">
          <CoupleHomeScene profile={profile} partner={partner} partnerName={partnerName} />

          <QuickActions />

          <section aria-labelledby="today-title">
            <SectionHeading eyebrow="Your rhythm" title="Today together" id="today-title" />
            <div className="grid gap-4 lg:grid-cols-2">
              <StreakBadge meId={profile.id} partnerId={profile.partner_id} />
              <DailyQuestionCard meId={profile.id} partnerId={profile.partner_id} partnerName={partnerName} />
              <MoodCard emoji={profile.mood_emoji} mood={profile.mood} partnerName={partnerName} partnerMood={partner.mood} />
              <MemoryOfTheDayCard />
            </div>
            <div className="mt-4"><StreakRecoveryCard /></div>
          </section>

          <section aria-labelledby="next-date-title">
            <SectionHeading eyebrow="On the horizon" title="Your next date" id="next-date-title" />
            <CountdownCard
              anniversaryDate={profile.anniversary_date}
              pairedAt={profile.paired_at}
              emoji={profile.favorite_emoji ?? "🌸"}
              accent={profile.favorite_color ?? "var(--petal)"}
              compact
              me={{ display_name: profile.display_name, avatar_url: profile.avatar_url }}
              partner={{ display_name: partner.display_name, avatar_url: partner.avatar_url }}
            />
          </section>

          <DestinationSection eyebrow="Make a moment" title="Tonight" items={TONIGHT} featured />
          <DestinationSection eyebrow="Everything you keep" title="Our story" items={OUR_STORY} />
          <DestinationSection eyebrow="The life around you" title="Our world" items={OUR_WORLD} />
        </div>
      ) : !isLoading && profile ? (
        <InviteHome firstName={firstName} />
      ) : (
        <HomeSkeleton />
      )}
    </div>
  );
}

function MoodCard({
  emoji,
  mood,
  partnerName,
  partnerMood,
}: {
  emoji: string | null;
  mood: string | null;
  partnerName: string;
  partnerMood: string | null;
}) {
  return (
    <Link to="/app/mood" className="group flex min-h-28 items-center gap-4 rounded-3xl border border-border bg-surface p-5 transition-transform hover:-translate-y-0.5">
      <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-petal/30 bg-petal-soft text-2xl">{emoji ?? "💭"}</div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-petal"><LineChart className="size-3" /> Mood sync</p>
        <p className="mt-1 truncate font-serif text-lg italic">{mood ?? "How are you feeling?"}</p>
        <p className="mt-1 truncate text-[11px] text-candle-muted">{partnerMood ? `${partnerName} feels ${partnerMood}` : `See how ${partnerName} feels today`}</p>
      </div>
      <ArrowRight className="size-4 text-candle-muted transition-transform group-hover:translate-x-0.5 group-hover:text-petal" />
    </Link>
  );
}

function DestinationSection({ eyebrow, title, items, featured = false }: { eyebrow: string; title: string; items: Destination[]; featured?: boolean }) {
  return (
    <section aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>
      <SectionHeading eyebrow={eyebrow} title={title} id={`${title.replace(/\s+/g, "-").toLowerCase()}-title`} />
      <div className={`grid gap-3 ${featured ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
        {items.map(({ to, label, caption, Icon, search }, index) => (
          <Link
            key={to}
            to={to as never}
            search={search as never}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-petal/40 ${featured ? "min-h-32 sm:p-5" : "min-h-28"}`}
          >
            {featured && index === 0 && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,var(--petal-soft),transparent_68%)]" />}
            <div className="relative flex h-full flex-col">
              <Icon className="size-5 text-petal" />
              <div className="mt-auto pt-5">
                <p className="font-serif text-lg italic leading-tight text-candle">{label}</p>
                <p className="mt-1 text-[10px] leading-snug text-candle-muted">{caption}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.24em] text-petal">{eyebrow}</p>
        <h2 id={id} className="mt-1 font-serif text-2xl italic sm:text-3xl">{title}</h2>
      </div>
      <span aria-hidden className="mb-2 h-px w-10 bg-border sm:w-20" />
    </div>
  );
}

function InviteHome({ firstName }: { firstName: string }) {
  return (
    <section className="relative z-10 flex min-h-[68vh] flex-col justify-center overflow-hidden rounded-3xl border border-border bg-surface p-7 text-center sm:p-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,var(--petal-soft),transparent_36%)]" />
      <div className="relative mx-auto grid size-28 place-items-center rounded-full border border-petal/30 bg-petal-soft">
        <Heart className="size-11 text-petal" />
      </div>
      <div className="relative mx-auto mt-7 max-w-lg">
        <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Your world starts here</p>
        <h2 className="mt-2 font-serif text-4xl italic sm:text-5xl">Invite your person, {firstName}.</h2>
        <p className="mx-auto mt-4 max-w-[42ch] text-sm leading-relaxed text-candle-muted">Pair once, then your home fills with shared moods, questions, memories, dates, games, and a panda you care for together.</p>
        <Button asChild variant="petal" size="block" className="mx-auto mt-7 max-w-xs">
          <Link to="/app/invite">Invite your partner <ArrowRight /></Link>
        </Button>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="relative z-10 space-y-4" aria-label="Opening your home">
      <div className="h-[390px] animate-pulse rounded-3xl border border-border bg-surface" />
      <div className="grid grid-cols-2 gap-3"><div className="h-28 animate-pulse rounded-2xl bg-surface" /><div className="h-28 animate-pulse rounded-2xl bg-surface" /></div>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night at home";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Late night at home";
}