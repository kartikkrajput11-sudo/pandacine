import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, LockKeyhole, PawPrint, Sparkles } from "lucide-react";
import { PandaStage } from "@/components/panda/PandaStage";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { useEquippedLook } from "@/hooks/useLuvies";
import type { Profile } from "@/hooks/useProfile";
import { getPet } from "@/lib/pet.functions";
import { pandaLifecycle } from "@/lib/panda-lifecycle";

export function CoupleHomeScene({
  profile,
  partner,
  partnerName,
}: {
  profile: Profile;
  partner: Profile;
  partnerName: string;
}) {
  const fetchPet = useServerFn(getPet);
  const { data: petData, isLoading } = useQuery({
    queryKey: ["pet"],
    queryFn: () => fetchPet({ data: undefined as never }),
  });
  const look = useEquippedLook();
  const lifecycle = pandaLifecycle(petData?.pet);
  const hidden = partner.activity_visible === false;
  const lastSeenAt = partner.last_seen_at ? new Date(partner.last_seen_at).getTime() : 0;
  const online = !hidden && lastSeenAt > 0 && Date.now() - lastSeenAt < 2 * 60 * 1000;
  const wear = {
    outfit: look.outfit?.item_key ?? null,
    accessory: look.accessory?.item_key ?? null,
    prop: look.prop?.item_key ?? null,
  };

  return (
    <section
      aria-label="Our shared home"
      className="group relative min-h-[390px] overflow-hidden rounded-3xl border border-border bg-surface shadow-velvet sm:min-h-[430px]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,var(--petal-soft),transparent_35%),linear-gradient(180deg,color-mix(in_oklab,var(--surface-elevated)_88%,transparent),var(--surface))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--velvet)_68%,transparent))]" />
      <div className="pointer-events-none absolute left-[12%] top-16 h-44 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute right-[12%] top-16 h-44 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

      <div className="relative z-10 flex items-start justify-between gap-3 p-5 sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-petal">
            <Sparkles className="size-3" /> Our little world
          </p>
          <h2 className="mt-1 font-serif text-3xl italic leading-none sm:text-4xl">Together, right now.</h2>
        </div>
        <div className="flex -space-x-2">
          <UserAvatar src={profile.avatar_url} name={profile.display_name} className="size-11 border-2 border-surface" />
          <div className="relative">
            <UserAvatar src={partner.avatar_url} name={partner.display_name} className="size-11 border-2 border-surface" />
            <span className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-surface ${online ? "bg-petal" : "bg-candle-muted"}`} />
          </div>
        </div>
      </div>

      <div className="relative z-[2] mx-auto h-[230px] w-[min(82%,460px)] sm:h-[270px]">
        {isLoading ? (
          <div className="grid h-full place-items-center">
            <span className="size-9 animate-pulse rounded-full border border-petal/40 bg-petal-soft" />
          </div>
        ) : lifecycle === "ACTIVE_PANDA" ? (
          <PandaStage
            name={petData?.pet?.name ?? "Pan"}
            className="h-full w-full"
            playful
            lite
            hideActions
            wear={wear}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid size-24 place-items-center rounded-full border border-petal/30 bg-petal-soft">
              <PawPrint className="size-10 text-petal" />
            </div>
            <p className="mt-4 font-serif text-xl italic">
              {lifecycle === "DEAD_PANDA" ? "A story to remember" : "Your panda is waiting"}
            </p>
            <Button asChild variant="soft" size="pill" className="mt-3">
              <Link to="/app/pet">Visit the panda room</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="relative z-10 mx-4 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3 backdrop-blur-xl sm:mx-6 sm:mb-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-candle">You &amp; {partnerName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-candle-muted">
            {hidden ? <LockKeyhole className="size-3" /> : <Heart className="size-3 text-petal" />}
            {hidden ? "Their activity is private" : online ? "Both here now" : "Your space is ready for two"}
          </p>
        </div>
        <Button asChild variant="quiet" size="pill">
          <Link to="/app/pet">Visit</Link>
        </Button>
      </div>
    </section>
  );
}