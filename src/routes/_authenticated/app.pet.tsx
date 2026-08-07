import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Coins, Pencil, Check, Sparkles, Flame, ShoppingBasket, Heart, Utensils } from "lucide-react";
import { toast } from "sonner";
import { PandaStage } from "@/components/panda/PandaStage";
import { Button } from "@/components/ui/button";
import { getPet, renamePet, savePetProgress, unlockPet, buyPetFood, feedPet } from "@/lib/pet.functions";
import { PET_AISLES, PET_FOODS, FOOD_BY_KEY, STARVE_HOURS, fullnessNow, hoursSinceFed } from "@/lib/pet-foods";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/pet")({
  head: () => ({
    meta: [
      { title: "Your Panda — PANDACINE" },
      { name: "description", content: "Adopt, feed and play with your very own PANDACINE panda." },
      { property: "og:title", content: "Your Panda — PANDACINE" },
      { property: "og:description", content: "Adopt, feed and play with your very own PANDACINE panda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PetRoute,
});

function PetRoute() {
  const qc = useQueryClient();
  const fetchPet = useServerFn(getPet);
  const adopt = useServerFn(unlockPet);
  const rename = useServerFn(renamePet);
  const save = useServerFn(savePetProgress);
  const buy = useServerFn(buyPetFood);
  const feed = useServerFn(feedPet);

  const { data, isLoading } = useQuery({ queryKey: ["pet"], queryFn: () => fetchPet({ data: undefined as never }) });
  const pet = data?.pet as any;
  const coins = data?.coins ?? 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [adoptName, setAdoptName] = useState("Pan");
  const [tab, setTab] = useState<"play" | "market" | "pantry">("play");
  const counter = useRef({ interactions: 0, affection: 0 });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pet"] });
    qc.invalidateQueries({ queryKey: ["profile", "me"] });
  };

  const adoptM = useMutation({
    mutationFn: () => adopt({ data: { name: adoptName } }),
    onSuccess: () => {
      toast.success("Your panda is home 🐼");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't adopt"),
  });

  const renameM = useMutation({
    mutationFn: (name: string) => rename({ data: { name } }),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't rename"),
  });

  const buyM = useMutation({
    mutationFn: (key: string) => buy({ data: { key, qty: 1 } }),
    onSuccess: (_r, key) => {
      toast.success(`${FOOD_BY_KEY[key]?.name} added to the pantry`);
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't buy that"),
  });

  const feedM = useMutation({
    mutationFn: (key: string) => feed({ data: { key } }),
    onSuccess: (r: any) => {
      toast.success(r?.unlocked ? `Nom! Unlocked ${r.unlocked}` : "Nom nom nom 🐼");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't feed"),
  });

  // Persist play progress every 20s while there's something new.
  useEffect(() => {
    if (!pet?.unlocked) return;
    const id = window.setInterval(() => {
      const c = counter.current;
      if (c.interactions === 0) return;
      void save({ data: { interactions: (pet.interactions ?? 0) + c.interactions, affection: c.affection } }).catch(
        () => undefined,
      );
    }, 20_000);
    return () => window.clearInterval(id);
  }, [pet?.unlocked, pet?.interactions, save]);

  const name = pet?.name ?? "Pan";
  const alive = pet?.alive !== false;
  const fullness = useMemo(() => (pet ? fullnessNow(pet.fullness ?? 100, pet.last_fed_at) : 100), [pet]);
  const hoursLeft = Math.max(0, Math.round(STARVE_HOURS - hoursSinceFed(pet?.last_fed_at)));
  const pantry = (pet?.pantry ?? {}) as Record<string, number>;
  const pantryList = Object.entries(pantry).filter(([, n]) => n > 0);

  return (
    <div className="relative px-5 pt-8 pb-28 space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/app" aria-label="Back" className="grid size-10 place-items-center rounded-full glass">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Your companion</p>
          <h1 className="font-serif text-2xl italic leading-tight">The Panda</h1>
        </div>
        <span className="flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm">
          <Coins className="size-4 text-petal" />
          <span className="tabular-nums font-semibold text-petal">{coins}</span>
        </span>
      </header>

      {isLoading && <p className="text-sm text-candle-muted">Waking the panda…</p>}

      {!isLoading && !pet?.unlocked && (
        <section className="rounded-3xl glass-strong p-5 space-y-4">
          <div className="pointer-events-none">
            <PandaStage playful={false} lite className="mx-auto max-w-[300px]" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="font-serif text-2xl italic">Adopt your panda</h2>
            <p className="text-sm text-candle-muted">
              A living mascot that reacts to you, sleeps, dreams and grows fonder every day — but it must be fed.
            </p>
          </div>
          <input
            value={adoptName}
            onChange={(e) => setAdoptName(e.target.value)}
            maxLength={20}
            placeholder="Name your panda"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-center font-serif text-lg italic outline-none focus:border-petal/60"
          />
          <Button
            variant="petal"
            size="block"
            disabled={adoptM.isPending || coins < (data?.cost ?? 250)}
            onClick={() => adoptM.mutate()}
          >
            {coins < (data?.cost ?? 250)
              ? `Needs ${data?.cost ?? 250} coins — you have ${coins}`
              : `Adopt for ${data?.cost ?? 250} coins`}
          </Button>
          <p className="text-center text-[11px] text-candle-muted">
            Earn coins from rituals, streaks and daily questions.
          </p>
        </section>
      )}

      {!isLoading && pet?.unlocked && !alive && (
        <section className="rounded-3xl glass-strong p-8 text-center space-y-3">
          <p className="text-4xl">🕯️</p>
          <h2 className="font-serif text-2xl italic">{name} is gone</h2>
          <p className="text-sm text-candle-muted">
            {name} went {STARVE_HOURS} hours without food. Pandas don't come back — the grove keeps their memory.
          </p>
        </section>
      )}

      {!isLoading && pet?.unlocked && alive && (
        <>
          <section className="relative -mx-2 overflow-visible rounded-[2.5rem] bg-transparent p-2">
            <div className="mb-2 flex items-center justify-center gap-2">
              {editing ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={20}
                    className="w-40 rounded-xl border border-border bg-surface px-3 py-1.5 text-center font-serif italic outline-none focus:border-petal/60"
                  />
                  <Button variant="petal" size="icon" onClick={() => renameM.mutate(draft)} aria-label="Save name">
                    <Check className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="font-serif text-3xl italic">{name}</h2>
                  <button
                    onClick={() => {
                      setDraft(name);
                      setEditing(true);
                    }}
                    aria-label="Rename panda"
                    className="text-candle-muted hover:text-petal"
                  >
                    <Pencil className="size-4" />
                  </button>
                </>
              )}
            </div>

            {/* Fullness — the life meter */}
            <div className="mx-auto mb-3 max-w-[340px]">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-candle-muted">
                <span>Fullness</span>
                <span className={fullness < 30 ? "text-coral" : "text-petal"}>
                  {fullness}% · {hoursLeft}h left
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full border border-border bg-surface">
                <div
                  className={cn("h-full transition-all", fullness < 30 ? "bg-coral" : "bg-petal petal-glow")}
                  style={{ width: `${Math.max(3, fullness)}%` }}
                />
              </div>
            </div>

            <PandaStage
              name={name}
              onInteract={() => {
                counter.current.interactions += 1;
                counter.current.affection = Math.min(100, counter.current.affection + 1);
              }}
            />
          </section>

          <section className="grid grid-cols-3 gap-3">
            <Stat label="Affection" value={`${pet.affection ?? 0}%`} Icon={Heart} />
            <Stat label="Playtime" value={String(pet.interactions ?? 0)} Icon={Sparkles} />
            <Stat label="Streak" value={`${pet.streak ?? 0}d`} Icon={Flame} />
          </section>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-2">
            {(
              [
                ["play", "Play", Sparkles],
                ["market", "Supermarket", ShoppingBasket],
                ["pantry", `Pantry${pantryList.length ? ` (${pantryList.length})` : ""}`, Utensils],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-widest transition-all",
                  tab === k
                    ? "border-petal/60 bg-petal/10 text-petal"
                    : "border-border bg-surface/70 text-candle-muted hover:text-petal",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {tab === "play" && (
            <div className="space-y-3">
              <p className="text-center text-[11px] text-candle-muted">
                Seven days in a row unlocks the Golden Panda. Rare costumes appear on their own — keep visiting.
              </p>
              <Unlocks
                expressions={pet.unlocked_expressions ?? []}
                costumes={pet.unlocked_costumes ?? []}
              />
            </div>
          )}

          {tab === "market" && (
            <section className="space-y-5">
              {PET_AISLES.map((aisle) => (
                <div key={aisle} className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-petal">{aisle}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {PET_FOODS.filter((f) => f.aisle === aisle).map((f) => (
                      <div key={f.key} className="rounded-2xl glass p-3 space-y-1.5">
                        <div className="flex items-start justify-between">
                          <span className="text-2xl">{f.emoji}</span>
                          <span className="flex items-center gap-1 text-xs text-petal tabular-nums">
                            <Coins className="size-3" />
                            {f.price}
                          </span>
                        </div>
                        <p className="font-serif italic leading-tight">{f.name}</p>
                        <p className="text-[10px] leading-snug text-candle-muted">{f.note}</p>
                        <p className="text-[10px] text-candle-muted">
                          +{f.fullness} fullness · +{f.affection} affection
                        </p>
                        <Button
                          variant="soft"
                          size="block"
                          disabled={buyM.isPending || coins < f.price}
                          onClick={() => buyM.mutate(f.key)}
                        >
                          {coins < f.price ? "Not enough coins" : "Buy"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {tab === "pantry" && (
            <section className="space-y-3">
              {pantryList.length === 0 && (
                <p className="text-center text-sm text-candle-muted">
                  The pantry is empty. Visit the supermarket before {name} gets hungry.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {pantryList.map(([key, n]) => {
                  const f = FOOD_BY_KEY[key];
                  if (!f) return null;
                  return (
                    <div key={key} className="rounded-2xl glass p-3 space-y-1.5 text-center">
                      <span className="text-2xl">{f.emoji}</span>
                      <p className="font-serif italic leading-tight">{f.name}</p>
                      <p className="text-[10px] text-candle-muted">×{n} in pantry</p>
                      <Button variant="petal" size="block" disabled={feedM.isPending} onClick={() => feedM.mutate(key)}>
                        Feed
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Unlocks({ expressions, costumes }: { expressions: string[]; costumes: string[] }) {
  if (!expressions.length && !costumes.length) {
    return (
      <p className="text-center text-[11px] text-candle-muted">
        Feeding new foods unlocks new expressions and outfits.
      </p>
    );
  }
  return (
    <div className="rounded-2xl glass p-4 space-y-2">
      <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Unlocked</p>
      <div className="flex flex-wrap gap-1.5">
        {[...expressions, ...costumes].map((k) => (
          <span key={k} className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-widest">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, Icon }: { label: string; value: string; Icon: typeof Flame }) {
  return (
    <div className="rounded-2xl glass p-4 text-center">
      <Icon className="mx-auto size-4 text-petal" />
      <p className="mt-1 font-serif text-xl italic">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-candle-muted">{label}</p>
    </div>
  );
}
