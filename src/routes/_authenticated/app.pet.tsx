import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Pencil,
  Check,
  Sparkles,
  Flame,
  Shirt,
  Crown,
  Leaf,
  Bell,
  Popcorn,
  Cookie,
  Hand,
  Camera,
  Lock,
  ShoppingBag,
  ChevronRight,
  Heart,
  PawPrint,
} from "lucide-react";
import { toast } from "sonner";
import { PandaStage, type PandaActions } from "@/components/panda/PandaStage";
import { PandaAdornments } from "@/components/panda/PandaAdornments";
import { LuvieCoin } from "@/components/luvies/LuviesAmount";
import { useEquippedLook, useLuviesWallet, usePandaEquip, usePandaInventory, usePandaShop } from "@/hooks/useLuvies";
import { PANDA_CATEGORIES } from "@/lib/luvies";
import type { Costume } from "@/components/panda/usePandaBrain";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  getPet,
  renamePet,
  savePetProgress,
  unlockPet,
  feedPet,
  buyPetFood,
  setPetCostume,
} from "@/lib/pet.functions";
import { PET_FOODS, FOOD_BY_KEY, STARVE_HOURS, fullnessNow, hoursSinceFed } from "@/lib/pet-foods";
import {
  PET_COSTUMES,
  COSTUME_BY_KEY,
  costumeProgress,
  costumeRequirementText,
  costumeUnlocked,
} from "@/lib/pet-wardrobe";
import { cn } from "@/lib/utils";
import { PandaLifePanel } from "@/components/panda/PandaLifePanel";
import { REBIRTH_COST, pandaLifecycle } from "@/lib/panda-lifecycle";
import { usePetLifeActions } from "@/hooks/usePandaLife";
import { useProfile } from "@/hooks/useProfile";


type PlayTab = "care" | "wardrobe" | "market" | "closet";
const PLAY_TABS: { key: PlayTab; label: string; Icon: typeof Leaf }[] = [
  { key: "care", label: "Care", Icon: Heart },
  { key: "wardrobe", label: "Wardrobe", Icon: Shirt },
  { key: "market", label: "Market", Icon: ShoppingBag },
  { key: "closet", label: "Boutique", Icon: Crown },
];

/** XP is earned by every interaction and every point of affection. */
const XP_PER_LEVEL = 1000;
const UNLOCKS: { level: number; label: string }[] = [
  { level: 3, label: "Dance floor" },
  { level: 5, label: "Photo mode" },
  { level: 8, label: "Golden grove" },
  { level: 12, label: "Legacy album" },
];

export const Route = createFileRoute("/_authenticated/app/pet")({
  head: () => ({
    meta: [
      { title: "Your Panda — PANDACINE" },
      { name: "description", content: "Adopt, feed, dress and play with your very own PANDACINE panda." },
      { property: "og:title", content: "Your Panda — PANDACINE" },
      { property: "og:description", content: "Adopt, feed, dress and play with your very own PANDACINE panda." },
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
  const feed = useServerFn(feedPet);
  const wear = useServerFn(setPetCostume);
  const buy = useServerFn(buyPetFood);

  const { data, isLoading } = useQuery({ queryKey: ["pet"], queryFn: () => fetchPet({ data: undefined as never }) });
  const pet = data?.pet as any;
  const { data: wallet } = useLuviesWallet();
  const coins = wallet?.balance ?? data?.coins ?? 0;
  const { data: profileData } = useProfile();


  // Panda Shop purchases, shown on the live mascot.
  const look = useEquippedLook();
  const { data: shopItems = [] } = usePandaShop();
  const { data: shopInventory = [] } = usePandaInventory();
  const equipShopItem = usePandaEquip();
  const ownedShopItems = useMemo(() => {
    const byKey = new Map(shopItems.map((i) => [i.item_key, i]));
    return shopInventory
      .map((inv) => ({ inv, item: byKey.get(inv.item_key) }))
      .filter((r): r is { inv: (typeof shopInventory)[number]; item: (typeof shopItems)[number] } => !!r.item);
  }, [shopItems, shopInventory]);

  const { birth } = usePetLifeActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [adoptName, setAdoptName] = useState("Pan");
  const [actions, setActions] = useState<PandaActions | null>(null);
  const [sheet, setSheet] = useState<PlayTab | null>(null);
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

  const feedM = useMutation({
    mutationFn: (key: string) => feed({ data: { key } }),
    onSuccess: (r: any) => {
      toast.success(r?.unlocked ? `Nom! Unlocked ${r.unlocked}` : "Nom nom nom 🐼");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't feed"),
  });

  const wearM = useMutation({
    mutationFn: (key: string) => wear({ data: { costume: key } }),
    onSuccess: (_r, key) => {
      toast.success(`${COSTUME_BY_KEY[key]?.name} on — looking sharp`);
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't change the outfit"),
  });

  const buyM = useMutation({
    mutationFn: (key: string) => buy({ data: { key, qty: 1 } as any }),
    onSuccess: (_r, key) => {
      toast.success(`${FOOD_BY_KEY[key]?.name} added to the pantry`);
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't buy that"),
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
  const lifecycle = pandaLifecycle(pet);
  const alive = lifecycle === "ACTIVE_PANDA";
  const fullness = useMemo(() => (pet ? fullnessNow(pet.fullness ?? 100, pet.last_fed_at) : 100), [pet]);
  const hoursLeft = Math.max(0, Math.round(STARVE_HOURS - hoursSinceFed(pet?.last_fed_at)));
  const pantry = (pet?.pantry ?? {}) as Record<string, number>;
  const pantryList = Object.entries(pantry).filter(([, n]) => n > 0);
  const costume = (pet?.costume ?? "classic") as Costume;
  const xpTotal = (pet?.interactions ?? 0) * 20 + (pet?.affection ?? 0) * 8 + (pet?.streak ?? 0) * 40;
  const level = Math.floor(xpTotal / XP_PER_LEVEL) + 1;
  const xpInLevel = xpTotal % XP_PER_LEVEL;
  const xpPct = Math.max(3, Math.round((xpInLevel / XP_PER_LEVEL) * 100));
  const nextUnlock = UNLOCKS.find((u) => u.level > level) ?? UNLOCKS[UNLOCKS.length - 1]!;
  const tycoon = PET_COSTUMES.find((c) => c.key === "tycoon")!;
  const tycoonReady = costumeUnlocked(tycoon, pet);

  const mood =
    !alive ? "Resting in the grove"
    : fullness < 20 ? "Starving — feed now"
    : fullness < 45 ? "Getting hungry"
    : (pet?.affection ?? 0) > 70 ? "Devoted to you"
    : "Content";

  return (
    <div className="relative px-5 pt-8 pb-28">
      <header className="mx-auto flex max-w-5xl items-center gap-3">
        <Link to="/app" aria-label="Back" className="grid size-10 place-items-center rounded-full glass">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Your companion</p>
          <h1 className="font-serif text-2xl italic leading-tight">The Panda</h1>
        </div>
        <Link
          to="/app/wallet"
          className="flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm transition hover:text-petal"
          aria-label="Open your Luvies wallet"
        >
          <LuvieCoin className="size-4" />
          <span className="tabular-nums font-semibold text-petal">{coins}</span>
        </Link>
      </header>

      {isLoading && <p className="mt-6 text-sm text-candle-muted">Waking the panda…</p>}

      {!isLoading && lifecycle === "NO_PANDA_YET" && (
        <section className="mx-auto mt-6 max-w-md rounded-3xl glass-strong p-5 space-y-4">
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
              ? `Needs ${data?.cost ?? 250} Luvies — you have ${coins}`
              : `Adopt for ${data?.cost ?? 250} Luvies`}
          </Button>
          <p className="text-center text-[11px] text-candle-muted">
            Earn Luvies from watch time, game wins and Arena tournaments.
          </p>
        </section>
      )}

      {!isLoading && lifecycle === "DEAD_PANDA" && (
        <div className="mx-auto mt-6 max-w-md space-y-4">
          <section className="rounded-3xl glass-strong p-8 text-center space-y-3">
            <p className="text-4xl">🕯️</p>
            <h2 className="font-serif text-2xl italic">{name} is gone</h2>
            <p className="text-sm text-candle-muted">
              {name} went {STARVE_HOURS} hours without food. Pandas don't come back — the grove keeps their memory.
            </p>
          </section>

          <section className="rounded-3xl glass p-5 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-petal">A new beginning</p>
              <h3 className="font-serif text-xl italic">Welcome a new panda</h3>
              <p className="mt-1 text-[12px] text-candle-muted">
                This is a brand-new panda with their own birthday and story — {name} stays in the memorial.
              </p>
            </div>
            <input
              value={adoptName}
              onChange={(e) => setAdoptName(e.target.value)}
              maxLength={20}
              placeholder="Name your new panda"
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-center font-serif text-lg italic outline-none focus:border-petal/60"
            />
            <Button
              variant="petal"
              size="block"
              disabled={birth.isPending || coins < REBIRTH_COST}
              onClick={() => birth.mutate(adoptName)}
            >
              {coins < REBIRTH_COST
                ? `Needs ${REBIRTH_COST} Luvies — you have ${coins}`
                : `Welcome a new panda · ${REBIRTH_COST} Luvies`}
            </Button>
          </section>

          <PandaLifePanel
            pet={pet}
            balance={coins}
            partnerName={profileData?.partner?.display_name}
            hasPartner={!!profileData?.partner}
          />
        </div>
      )}

      {!isLoading && lifecycle === "ACTIVE_PANDA" && (
        <div className="mx-auto mt-5 max-w-5xl space-y-4">
          {/* ── Companion card ───────────────────────────── */}
          <section className="relative overflow-hidden rounded-[28px] glass-strong p-4 sm:p-5">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(60% 55% at 50% 30%, color-mix(in oklab, var(--petal) 12%, transparent), transparent 70%)",
              }}
            />
            <div className="relative grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              {/* identity + progress */}
              <div className="order-2 sm:order-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={20}
                        className="w-36 rounded-xl border border-border bg-surface px-3 py-1.5 font-serif italic outline-none focus:border-petal/60"
                      />
                      <Button variant="petal" size="icon" onClick={() => renameM.mutate(draft)} aria-label="Save name">
                        <Check className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <h2 className="font-serif text-3xl italic uppercase tracking-tight">{name}</h2>
                      <button
                        onClick={() => {
                          setDraft(name);
                          setEditing(true);
                        }}
                        aria-label="Rename panda"
                        className="text-candle-muted transition hover:text-petal"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </>
                  )}
                </div>

                <span className="inline-block rounded-full border border-petal/40 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-petal">
                  Level {String(level).padStart(2, "0")}
                </span>

                <div className="max-w-[240px] space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-petal petal-glow" style={{ width: `${xpPct}%` }} />
                  </div>
                  <p className="text-xs text-candle-muted tabular-nums">
                    <span className="text-candle">{xpInLevel}</span> / {XP_PER_LEVEL} XP
                  </p>
                  <p className="text-xs text-candle-muted">{XP_PER_LEVEL - xpInLevel} XP to level {String(level + 1).padStart(2, "0")}</p>
                </div>

                <div className="pt-1">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-candle-muted">Next unlock</p>
                  <div className="mt-1.5 inline-flex items-center gap-2.5 rounded-2xl border border-border bg-surface/60 px-3 py-2">
                    <span className="grid size-8 place-items-center rounded-xl border border-petal/40 bg-petal/10">
                      <Camera className="size-4 text-petal" />
                    </span>
                    <span>
                      <span className="block text-sm">{nextUnlock.label}</span>
                      <span className="block text-[11px] text-candle-muted">Level {String(nextUnlock.level).padStart(2, "0")}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* stage + vitals */}
              <div className="order-1 sm:order-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="relative">
                  <PandaStage
                    name={name}
                    costume={costume}
                    hideActions
                    onReady={setActions}
                    onInteract={() => {
                      counter.current.interactions += 1;
                      counter.current.affection = Math.min(100, counter.current.affection + 1);
                    }}
                  />
                  <PandaAdornments look={look} />
                </div>

                <div className="w-[104px] space-y-4">
                  <Vital
                    Icon={Leaf}
                    label="Fullness"
                    value={fullness}
                    tone={fullness < 30 ? "alert" : "leaf"}
                  />
                  <Vital Icon={Heart} label="Affection" value={pet.affection ?? 0} tone="petal" />
                  <p className="text-center text-[10px] uppercase tracking-[0.18em] text-candle-muted">{mood}</p>
                </div>
              </div>
            </div>

            {/* direct touches */}
            <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Touch Icon={Hand} label={"Pat\nhead"} onClick={() => actions?.headpat()} />
              <Touch Icon={Heart} label={"Belly\nrub"} onClick={() => actions?.bellyRub()} />
              <Touch Icon={Bell} label={"Boop\nnose"} onClick={() => actions?.boop()} />
              <Touch Icon={PawPrint} label={"Pull\ntail"} onClick={() => actions?.tailPull()} />
            </div>
          </section>

          {/* ── Playroom launcher — opens over the screen ── */}
          <section className="rounded-[28px] glass-strong p-3">
            <div className="flex gap-1 rounded-full border border-border bg-velvet/60 p-1">
              {PLAY_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSheet(t.key)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors",
                    sheet === t.key ? "bg-petal text-velvet" : "text-candle-muted hover:text-candle",
                  )}
                >
                  <t.Icon className="size-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Portal2 Icon={Leaf} title="Feed" hint="Keep them full" onClick={() => setSheet("care")} />
              <Portal2 Icon={Sparkles} title="Play" hint="Have fun" onClick={() => setSheet("care")} />
              <Portal2 Icon={Shirt} title="Dress" hint="Wardrobe" onClick={() => setSheet("wardrobe")} />
              <Portal2 Icon={ShoppingBag} title="Shop" hint="Market & boutique" onClick={() => setSheet("market")} />
            </div>
          </section>

          {/* ── Goals & bond ─────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[28px] glass-strong p-5 space-y-3">
              <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-petal">
                <Sparkles className="size-3.5" /> Today&apos;s goal
              </p>
              <Goal label="Give 3 affection" value={Math.min(3, pet.interactions ?? 0)} total={3} />
              <Goal label="Feed your panda" value={fullness > 60 ? 1 : 0} total={1} />
              <Goal label="Play together" value={(pet.interactions ?? 0) > 0 ? 1 : 0} total={1} />
              <div className="flex items-center gap-2 border-t border-border pt-3 text-sm text-candle-muted">
                🎁 <span className="text-petal">+45 XP</span>
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-[28px] glass-strong p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Golden tycoon</p>
                  <Crown className={cn("size-4", tycoonReady ? "text-[#f0d78c]" : "text-candle-muted")} />
                </div>
                <p className="mt-1.5 text-xs leading-snug text-candle-muted">{tycoon.blurb}</p>
                <div className="mt-3">
                  {tycoonReady ? (
                    <Button
                      variant="petal"
                      size="block"
                      disabled={wearM.isPending || costume === "tycoon"}
                      onClick={() => wearM.mutate("tycoon")}
                    >
                      {costume === "tycoon" ? "Currently wearing" : "Wear the gold suit"}
                    </Button>
                  ) : (
                    <>
                      <Progress value={costumeProgress(tycoon, pet)} />
                      <p className="mt-1.5 text-[10px] uppercase tracking-widest text-candle-muted">
                        {costumeRequirementText(tycoon)}
                      </p>
                    </>
                  )}
                </div>
              </section>

              <section className="rounded-[28px] glass-strong p-5">
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-petal">
                  <Heart className="size-3.5" /> Our bond
                </p>
                <p className="mt-2 text-sm">
                  {profileData?.partner
                    ? `${name} is shared with ${profileData.partner.display_name}`
                    : "Pair with your partner to raise this panda together"}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Stat label="Playtime" value={String(pet.interactions ?? 0)} Icon={Sparkles} />
                  <Stat label="Streak" value={`${pet.streak ?? 0}d`} Icon={Flame} />
                  <Stat
                    label="Outfits"
                    value={String(PET_COSTUMES.filter((c) => costumeUnlocked(c, pet)).length)}
                    Icon={Shirt}
                  />
                </div>
              </section>
            </div>
          </div>

          <PandaLifePanel
            pet={pet}
            balance={coins}
            partnerName={profileData?.partner?.display_name}
            hasPartner={!!profileData?.partner}
          />

          {/* ── Overlay sheets ───────────────────────────── */}
          <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
            <SheetContent
              side="bottom"
              className="max-h-[85vh] overflow-y-auto rounded-t-[28px] border-border bg-velvet/95 backdrop-blur-xl p-5"
            >
              <SheetHeader className="text-left">
                <SheetTitle className="font-serif text-2xl italic">
                  {PLAY_TABS.find((t) => t.key === sheet)?.label ?? ""}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-5 pb-6">
                {sheet === "care" && (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Act onClick={() => actions?.bamboo()} Icon={Leaf} label="Hold bamboo" />
                      <Act onClick={() => actions?.bell()} Icon={Bell} label="Ring bell" />
                      <Act onClick={() => actions?.popcorn()} Icon={Popcorn} label="Popcorn" />
                      <Act onClick={() => actions?.cookie()} Icon={Cookie} label="Cookie" />
                      <Act onClick={() => actions?.paw()} Icon={Hand} label="Paw shake" />
                      <Act onClick={() => actions?.photo()} Icon={Camera} label="Photo" />
                      <Act onClick={() => actions?.dance()} Icon={Sparkles} label="Dance" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-candle-muted">Pantry</p>
                      {pantryList.length === 0 ? (
                        <p className="text-[11px] text-candle-muted">
                          The pantry is empty — buy something from the market.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {pantryList.map(([key, n]) => (
                            <button
                              key={key}
                              disabled={feedM.isPending}
                              onClick={() => feedM.mutate(key)}
                              className="flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs transition-colors hover:border-petal/60 hover:text-petal"
                            >
                              <span>{FOOD_BY_KEY[key]?.emoji}</span>
                              <span>{FOOD_BY_KEY[key]?.name}</span>
                              <span className="tabular-nums text-candle-muted">×{n}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {sheet === "wardrobe" && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PET_COSTUMES.map((c) => {
                      const unlocked = costumeUnlocked(c, pet);
                      const worn = costume === c.key;
                      return (
                        <button
                          key={c.key}
                          disabled={!unlocked || worn || wearM.isPending}
                          onClick={() => wearM.mutate(c.key)}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition-all",
                            worn
                              ? "border-petal/60 bg-petal/10"
                              : unlocked
                                ? "border-border bg-surface/60 hover:border-petal/50"
                                : "border-border bg-surface/40 opacity-70",
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xl">{c.emoji}</span>
                            {!unlocked && <Lock className="size-3.5 text-candle-muted" />}
                          </div>
                          <p className="mt-1 font-serif text-sm italic leading-tight">{c.name}</p>
                          {unlocked ? (
                            <p className="text-[10px] uppercase tracking-widest text-petal">
                              {worn ? "Wearing" : "Wear"}
                            </p>
                          ) : (
                            <>
                              <Progress value={costumeProgress(c, pet)} />
                              <p className="mt-1 text-[10px] leading-tight text-candle-muted">
                                {costumeRequirementText(c)}
                              </p>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {sheet === "market" && (
                  <div className="space-y-3">
                    <Link
                      to="/app/mart"
                      className="flex items-center justify-between rounded-2xl border border-petal/40 bg-petal/10 px-4 py-3 transition hover:bg-petal/15"
                    >
                      <span>
                        <span className="block font-serif text-sm italic">Visit PandaMart 🛒</span>
                        <span className="block text-[10px] text-candle-muted">
                          Full aisles, boutique looks, card checkout & split bills
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-petal" />
                    </Link>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PET_FOODS.map((f) => (
                        <button
                          key={f.key}
                          disabled={buyM.isPending || coins < f.price}
                          onClick={() => buyM.mutate(f.key)}
                          className="rounded-2xl border border-border bg-surface/60 p-3 text-left transition-all hover:border-petal/50 disabled:opacity-50"
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xl">{f.emoji}</span>
                            <span className="flex items-center gap-1 text-[11px] text-petal tabular-nums">
                              <LuvieCoin className="size-3.5" />
                              {f.price}
                            </span>
                          </div>
                          <p className="mt-1 font-serif text-sm italic leading-tight">{f.name}</p>
                          <p className="text-[10px] text-candle-muted">
                            +{f.fullness} fullness · +{f.affection} affection
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sheet === "closet" && (
                  <div className="space-y-3">
                    <Link
                      to="/app/panda-shop"
                      className="inline-flex items-center gap-1 text-[11px] text-petal hover:underline"
                    >
                      <ShoppingBag className="size-3.5" /> Panda Shop <ChevronRight className="size-3" />
                    </Link>
                    {ownedShopItems.length === 0 ? (
                      <p className="text-[11px] text-candle-muted">
                        Nothing from the boutique yet — outfits, props and effects you buy with Luvies appear on your
                        panda here.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {PANDA_CATEGORIES.map((c) => {
                          const rows = ownedShopItems.filter((r) => r.item.category === c.key);
                          if (!rows.length) return null;
                          return (
                            <div key={c.key} className="space-y-1.5">
                              <p className="text-[10px] uppercase tracking-widest text-candle-muted">
                                {c.icon} {c.label}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {rows.map(({ inv, item }) => (
                                  <button
                                    key={item.item_key}
                                    disabled={equipShopItem.isPending}
                                    onClick={() =>
                                      equipShopItem.mutate(
                                        { itemKey: item.item_key, equip: !inv.equipped },
                                        {
                                          onSuccess: () =>
                                            toast.success(inv.equipped ? `${item.name} put away` : `${item.name} on`),
                                          onError: (e: any) => toast.error(e?.message ?? "Couldn't change that"),
                                        },
                                      )
                                    }
                                    className={cn(
                                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                                      inv.equipped
                                        ? "border-petal/60 bg-petal/10 text-petal"
                                        : "border-border bg-surface/70 hover:border-petal/50",
                                    )}
                                  >
                                    <span>{item.emoji}</span>
                                    <span>{item.name}</span>
                                    {inv.equipped && <Check className="size-3.5" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full border border-border bg-surface">
      <div className="h-full bg-petal/70" style={{ width: `${Math.max(3, Math.round(value * 100))}%` }} />
    </div>
  );
}

function Meter({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "petal" | "alert" | "rose";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-candle-muted">
        <span>{label}</span>
        <span className={tone === "alert" ? "text-coral" : "text-petal"}>
          {Math.round(value)}% · {hint}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full border border-border bg-surface">
        <div
          className={cn(
            "h-full transition-all",
            tone === "alert" ? "bg-coral" : tone === "rose" ? "bg-petal/70" : "bg-petal petal-glow",
          )}
          style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
        />
      </div>
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
    <div className="rounded-2xl border border-border bg-surface/60 p-3 text-center">
      <Icon className="mx-auto size-4 text-petal" />
      <p className="mt-1 font-serif text-lg italic">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-candle-muted">{label}</p>
    </div>
  );
}

function Act({ onClick, Icon, label }: { onClick: () => void; Icon: typeof Leaf; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[11px] uppercase tracking-widest text-candle-muted transition-all hover:border-petal/50 hover:text-petal active:scale-95"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}


function Vital({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: typeof Leaf;
  label: string;
  value: number;
  tone: "leaf" | "petal" | "alert";
}) {
  return (
    <div className="space-y-1.5 text-right">
      <div className="flex items-center justify-end gap-2">
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full border",
            tone === "alert" ? "border-coral/50 bg-coral/10" : "border-petal/40 bg-petal/10",
          )}
        >
          <Icon className={cn("size-4", tone === "alert" ? "text-coral" : "text-petal")} />
        </span>
        <span>
          <span className="block text-[9px] uppercase tracking-[0.18em] text-candle-muted">{label}</span>
          <span className="block text-sm tabular-nums">{Math.round(value)}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className={cn("h-full rounded-full", tone === "alert" ? "bg-coral" : "bg-petal")}
          style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function Touch({ Icon, label, onClick }: { Icon: typeof Leaf; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-2xl border border-border bg-surface/60 px-3 py-2.5 text-left transition-all hover:border-petal/50 active:scale-[0.97]"
    >
      <Icon className="size-4 shrink-0 text-petal" />
      <span className="whitespace-pre-line text-[11px] uppercase leading-tight tracking-[0.14em] text-candle">
        {label}
      </span>
    </button>
  );
}

function Portal2({
  Icon,
  title,
  hint,
  onClick,
}: {
  Icon: typeof Leaf;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-border bg-surface/50 p-4 text-center transition-all hover:border-petal/50 active:scale-[0.97]"
    >
      <Icon className="mx-auto size-5 text-petal" />
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em]">{title}</p>
      <p className="text-[10px] text-candle-muted">{hint}</p>
    </button>
  );
}

function Goal({ label, value, total }: { label: string; value: number; total: number }) {
  const done = value >= total;
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full border",
          done ? "border-petal/60 bg-petal/15" : "border-border bg-surface/60",
        )}
      >
        {done ? <Check className="size-4 text-petal" /> : <Heart className="size-4 text-candle-muted" />}
      </span>
      <div className="flex-1">
        <div className="flex items-baseline justify-between text-sm">
          <span>{label}</span>
          <span className="text-[11px] tabular-nums text-candle-muted">
            {Math.min(value, total)} / {total}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-petal" style={{ width: `${(Math.min(value, total) / total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
