import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Hand,
  Heart,
  Leaf,
  Lock,
  Pencil,
  Shirt,
  ShoppingBag,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PandaStage, type PandaActions } from "@/components/panda/PandaStage";
import { PandaAdornments } from "@/components/panda/PandaAdornments";
import { PandaLifePanel } from "@/components/panda/PandaLifePanel";
import { LuvieCoin, LuviesAmount } from "@/components/luvies/LuviesAmount";
import { Button } from "@/components/ui/button";
import { useEquippedLook, useLuviesWallet, usePandaEquip, usePandaInventory, usePandaShop } from "@/hooks/useLuvies";
import { useProfile } from "@/hooks/useProfile";
import { usePetLifeActions } from "@/hooks/usePandaLife";
import type { Costume } from "@/components/panda/usePandaBrain";
import {
  buyPetFood,
  feedPet,
  getPet,
  renamePet,
  savePetProgress,
  setPetCostume,
  unlockPet,
} from "@/lib/pet.functions";
import { FOOD_BY_KEY, PET_AISLES, PET_FOODS, STARVE_HOURS, fullnessNow, hoursSinceFed } from "@/lib/pet-foods";
import {
  COSTUME_BY_KEY,
  PET_COSTUMES,
  costumeProgress,
  costumeRequirementText,
  costumeUnlocked,
} from "@/lib/pet-wardrobe";
import { PANDA_CATEGORIES } from "@/lib/luvies";
import { pandaLifecycle } from "@/lib/panda-lifecycle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/pet")({
  head: () => ({
    meta: [
      { title: "Your Panda — PANDACINE" },
      { name: "description", content: "Adopt, feed, dress and play with the panda you and your partner share." },
      { property: "og:title", content: "Your Panda — PANDACINE" },
      { property: "og:description", content: "Adopt, feed, dress and play with the panda you and your partner share." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PetRoute,
});

const XP_PER_LEVEL = 1000;
const UNLOCKS = [
  { level: 3, label: "Dance floor" },
  { level: 5, label: "Photo mode" },
  { level: 8, label: "Golden grove" },
  { level: 12, label: "Legacy album" },
];

type Dock = "care" | "wardrobe" | "market" | "boutique" | "legacy";

const DOCK: { key: Dock; label: string; Icon: typeof Heart }[] = [
  { key: "care", label: "Care", Icon: Heart },
  { key: "wardrobe", label: "Wardrobe", Icon: Shirt },
  { key: "market", label: "Market", Icon: ShoppingBag },
  { key: "boutique", label: "Boutique", Icon: Crown },
  { key: "legacy", label: "Legacy", Icon: Sparkles },
];

/* ────────────────────────── small pieces ────────────────────────── */

function Ring({ value, label, tone }: { value: number; label: string; tone: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative grid size-14 place-items-center rounded-full"
        style={{ background: `conic-gradient(${tone} ${v * 3.6}deg, hsl(var(--border)/0.5) 0deg)` }}
      >
        <div className="grid size-11 place-items-center rounded-full bg-ink/90 text-xs font-semibold tabular-nums">
          {v}%
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">{label}</p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        {hint && <span className="text-[11px] text-candle-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function PetDockOverlay({
  dock,
  title,
  onClose,
  children,
}: {
  dock: Dock | null;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!dock) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dock, onClose]);

  return (
    <AnimatePresence>
      {dock && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 px-3 pb-3 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-ink/95 shadow-2xl"
            initial={{ y: 36, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 28, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-ink/95 px-5 py-4 backdrop-blur-xl">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">Panda care</p>
                <h2 className="font-display text-xl capitalize">{title}</h2>
              </div>
              <Button size="icon" variant="quiet" aria-label="Close pet panel" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="max-h-[76dvh] overflow-y-auto px-5 py-4 overscroll-contain">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ────────────────────────── route ────────────────────────── */

function PetRoute() {
  const qc = useQueryClient();
  const fetchPet = useServerFn(getPet);
  const adopt = useServerFn(unlockPet);
  const rename = useServerFn(renamePet);
  const save = useServerFn(savePetProgress);
  const feed = useServerFn(feedPet);
  const buy = useServerFn(buyPetFood);
  const wear = useServerFn(setPetCostume);

  const { data, isLoading } = useQuery({ queryKey: ["pet"], queryFn: () => fetchPet({ data: undefined as never }) });
  const pet = (data as any)?.pet as any;
  const { data: wallet } = useLuviesWallet();
  const coins = wallet?.balance ?? (data as any)?.coins ?? 0;
  const { data: profileData } = useProfile();
  const partner = profileData?.partner ?? null;

  const look = useEquippedLook();
  const { data: shopItems = [] } = usePandaShop();
  const { data: shopInventory = [] } = usePandaInventory();
  const equipShopItem = usePandaEquip();
  const { birth } = usePetLifeActions();

  const [dock, setDock] = useState<Dock | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const actionsRef = useRef<PandaActions | null>(null);
  const [, forceReady] = useState(0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pet"] });
    qc.invalidateQueries({ queryKey: ["luvies"] });
  };

  const lifecycle = pandaLifecycle(pet);
  const name = pet?.name ?? "Pan";
  const fullness = fullnessNow(pet?.fullness ?? 100, pet?.last_fed_at);
  const affection = pet?.affection ?? 0;
  const hungry = fullness < 35;
  const hoursLeft = Math.max(0, STARVE_HOURS - hoursSinceFed(pet?.last_fed_at));

  const xp = (pet?.interactions ?? 0) * 12 + affection * 6 + (pet?.streak ?? 0) * 30;
  const level = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
  const levelPct = ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
  const nextUnlock = UNLOCKS.find((u) => u.level > level) ?? null;

  const pantry = (pet?.pantry ?? {}) as Record<string, number>;
  const pantryList = Object.entries(pantry)
    .map(([key, qty]) => ({ food: FOOD_BY_KEY[key], qty }))
    .filter((r) => !!r.food);

  const ownedShopItems = useMemo(() => {
    const byKey = new Map(shopItems.map((i) => [i.item_key, i]));
    return shopInventory
      .map((inv) => ({ inv, item: byKey.get(inv.item_key) }))
      .filter((r): r is { inv: (typeof shopInventory)[number]; item: (typeof shopItems)[number] } => !!r.item);
  }, [shopItems, shopInventory]);

  // Persist play progress every few interactions.
  const pending = useRef({ interactions: 0, affection: 0 });
  useEffect(() => {
    pending.current = { interactions: pet?.interactions ?? 0, affection: affection };
  }, [pet?.interactions, affection]);

  async function run(label: string, fn: () => Promise<any>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      refresh();
    } catch (e: any) {
      toast.error(String(e?.message ?? e).replace(/^.*ERROR:\s*/i, "") || `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  function touch(kind: keyof PandaActions) {
    const a = actionsRef.current;
    if (!a) return;
    a[kind]();
    const next = {
      interactions: pending.current.interactions + 1,
      affection: Math.min(100, pending.current.affection + 1),
    };
    pending.current = next;
    save({ data: next }).then(() => qc.invalidateQueries({ queryKey: ["pet"] })).catch(() => {});
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center text-sm text-candle-muted">
        Waking the grove…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-4 space-y-6">
      {/* header */}
      <header className="flex items-center justify-between gap-3">
        <Link to="/app" className="inline-flex items-center gap-2 text-sm text-candle-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Home
        </Link>
        <Link
          to="/app/wallet"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1.5"
        >
          <LuvieCoin className="size-4" />
          <span className="text-sm font-semibold tabular-nums">{coins.toLocaleString()}</span>
          <Wallet className="size-3.5 text-candle-muted" />
        </Link>
      </header>

      {lifecycle === "NO_PANDA_YET" && (
        <AdoptCard
          coins={coins}
          cost={(data as any)?.cost ?? 250}
          onAdopt={(n) => run("Adoption", async () => {
            await adopt({ data: { name: n } });
            toast.success("Your panda is home 🐼");
          })}
          busy={busy}
        />
      )}

      {lifecycle === "DEAD_PANDA" && (
        <div className="rounded-3xl glass p-6 text-center space-y-3">
          <p className="text-4xl">🕯️</p>
          <h1 className="font-display text-2xl">{name} is at rest</h1>
          <p className="text-sm text-candle-muted">
            Their story stays with you in the legacy album. When you're ready, a new panda can open their eyes.
          </p>
          <Button onClick={() => birth.mutate(undefined)} disabled={birth.isPending}>
            <Sparkles className="size-4" /> Welcome a new panda
          </Button>
        </div>
      )}

      {lifecycle === "ACTIVE_PANDA" && (
        <>
          {/* hero */}
          <section className="overflow-visible rounded-[2rem] border border-border/70 bg-surface/45 shadow-2xl shadow-ink/30 backdrop-blur-xl">
            <div className="relative">
              <PandaStage
                name={name}
                className="h-[min(64vh,520px)] min-h-[430px] w-full sm:min-h-[500px]"
                costume={(pet?.costume ?? "classic") as Costume}
                hideActions
                onReady={(a) => {
                  actionsRef.current = a;
                  forceReady((n) => (n === 0 ? 1 : n));
                }}
              />
              <PandaAdornments look={look} />
              {hungry && (
                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[11px] text-amber-200">
                  {name} is hungry — {Math.round(hoursLeft)}h of food left
                </div>
              )}
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-3">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={draft}
                      maxLength={20}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-40 rounded-xl border border-border bg-ink/50 px-3 py-1.5 text-lg"
                    />
                    <Button
                      size="icon"
                      onClick={() =>
                        run("Rename", async () => {
                          await rename({ data: { name: draft } });
                          setEditing(false);
                        })
                      }
                    >
                      <Check className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="group inline-flex items-center gap-2"
                    onClick={() => {
                      setDraft(name);
                      setEditing(true);
                    }}
                  >
                    <h1 className="font-display text-3xl leading-none">{name}</h1>
                    <Pencil className="size-3.5 text-candle-muted opacity-0 transition group-hover:opacity-100" />
                  </button>
                )}
                <span className="rounded-full border border-petal/40 bg-petal/10 px-2.5 py-1 text-[11px] text-petal">
                  Level {String(level).padStart(2, "0")}
                </span>
                {partner && (
                  <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-candle-muted">
                    Shared with {partner.display_name}
                  </span>
                )}
              </div>

              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                  <div className="h-full rounded-full bg-petal transition-all" style={{ width: `${levelPct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-candle-muted">
                  {nextUnlock ? `Next unlock · ${nextUnlock.label} at level ${nextUnlock.level}` : "Everything unlocked"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_.8fr]">
                <Ring value={fullness} label="Fullness" tone="hsl(45 90% 62%)" />
                <Ring value={affection} label="Affection" tone="hsl(340 80% 66%)" />
                <div className="rounded-2xl border border-border bg-surface/55 p-3 text-sm">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">Streak</p>
                  <p className="text-lg font-semibold">{pet?.streak ?? 0} days</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ["headpat", "Pat head", "🖐️"],
                  ["bellyRub", "Belly rub", "🫧"],
                  ["boop", "Boop nose", "👉"],
                  ["tailPull", "Pull tail", "🌀"],
                ] as const).map(([k, label, emoji]) => (
                  <button
                    key={k}
                    onClick={() => touch(k)}
                    className="rounded-2xl border border-border bg-surface/60 px-3 py-3 text-xs transition hover:border-petal/50 hover:bg-petal/10"
                  >
                    <span className="mr-1.5">{emoji}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* today */}
          <Section title="Companion rhythm" hint={`${pantryList.reduce((s, r) => s + r.qty, 0)} pantry items`}>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-[1.75rem] border border-petal/25 bg-petal/10 p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">Today’s priority</p>
                <p className="mt-2 font-display text-2xl leading-tight">
                  {hungry ? `Feed ${name} before the grove goes quiet.` : `Keep ${name} playful with three gentle touches.`}
                </p>
                <p className="mt-3 text-xs text-candle-muted">
                  {hungry ? `${Math.round(hoursLeft)} hours of safety left` : `${pet?.interactions ?? 0} lifetime interactions recorded`}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">Wearing</p>
                  <p className="mt-1 text-sm">{COSTUME_BY_KEY[pet?.costume ?? "classic"]?.name ?? "Classic coat"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">Bond</p>
                  <p className="mt-1 text-sm">{partner ? `Shared with ${partner.display_name}` : "Waiting for a partner bond"}</p>
                </div>
              </div>
            </div>
          </Section>
        </>
      )}

      {/* dock */}
      {lifecycle !== "NO_PANDA_YET" && (
        <nav className="fixed inset-x-0 bottom-20 z-30 mx-auto w-full max-w-3xl px-4">
          <div className="flex items-center justify-between gap-1 rounded-full border border-border bg-ink/85 p-1.5 backdrop-blur-xl">
            {DOCK.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setDock(key)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[10px] transition",
                  dock === key ? "bg-petal/20 text-petal" : "text-candle-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* panels over the screen — custom, no body scroll-lock side effects */}
      <PetDockOverlay
        dock={dock}
        title={dock === "boutique" ? "Boutique" : (dock ?? "Panda")}
        onClose={() => setDock(null)}
      >
          <div className="space-y-4 pb-6">
            {dock === "care" && (
              <>
                {pantryList.length === 0 ? (
                  <p className="text-sm text-candle-muted">
                    Your pantry is empty. Visit the Market to stock up on bamboo and treats.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {pantryList.map(({ food, qty }) => (
                      <button
                        key={food.key}
                        disabled={busy}
                        onClick={() =>
                          run("Feeding", async () => {
                            const res = await feed({ data: { key: food.key } });
                            toast.success(res.unlocked ? `Unlocked ${res.unlocked}!` : `${name} loved the ${food.name}`);
                          })
                        }
                        className="flex items-center gap-3 rounded-2xl border border-border bg-surface/60 p-3 text-left transition hover:border-petal/50"
                      >
                        <span className="text-2xl">{food.emoji}</span>
                        <span className="flex-1">
                          <span className="block text-sm">{food.name}</span>
                          <span className="block text-[11px] text-candle-muted">+{food.fullness} fullness</span>
                        </span>
                        <span className="text-xs text-candle-muted">×{qty}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["bamboo", "Bamboo", <Leaf key="l" className="size-4" />],
                    ["paw", "High five", <Hand key="h" className="size-4" />],
                    ["dance", "Dance", <Sparkles key="s" className="size-4" />],
                  ] as const).map(([k, label, icon]) => (
                    <button
                      key={k}
                      onClick={() => touch(k as keyof PandaActions)}
                      className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface/60 py-3 text-[11px] hover:border-petal/50"
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {dock === "wardrobe" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {PET_COSTUMES.map((def) => {
                  const unlocked = costumeUnlocked(def, pet);
                  const worn = (pet?.costume ?? "classic") === def.key;
                  return (
                    <button
                      key={def.key}
                      disabled={!unlocked || busy}
                      onClick={() =>
                        run("Outfit", async () => {
                          await wear({ data: { costume: def.key } });
                          toast.success(`${name} is wearing ${def.name}`);
                        })
                      }
                      className={cn(
                        "rounded-2xl border p-3 text-left transition",
                        worn ? "border-petal bg-petal/10" : "border-border bg-surface/60",
                        !unlocked && "opacity-60",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{def.emoji}</span>
                        <span className="flex-1 text-sm">{def.name}</span>
                        {!unlocked && <Lock className="size-3.5 text-candle-muted" />}
                        {worn && <Check className="size-4 text-petal" />}
                      </div>
                      <p className="mt-1 text-[11px] text-candle-muted">
                        {unlocked ? def.blurb : costumeRequirementText(def)}
                      </p>
                      {!unlocked && (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60">
                          <div className="h-full bg-petal/70" style={{ width: `${costumeProgress(def, pet)}%` }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {dock === "market" && (
              <>
                <Link
                  to="/app/mart"
                  onClick={() => setDock(null)}
                  className="flex items-center justify-between rounded-2xl border border-petal/40 bg-petal/10 p-3 text-sm"
                >
                  <span>Open PandaMart — departments, cart & split bills</span>
                  <ChevronRight className="size-4" />
                </Link>
                {PET_AISLES.map((aisle) => (
                  <div key={aisle} className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">{aisle}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PET_FOODS.filter((f) => f.aisle === aisle).map((f) => (
                        <div
                          key={f.key}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-surface/60 p-3"
                        >
                          <span className="text-2xl">{f.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{f.name}</p>
                            <p className="truncate text-[11px] text-candle-muted">{f.note}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy || coins < f.price}
                            onClick={() =>
                              run("Purchase", async () => {
                                await buy({ data: { key: f.key, qty: 1 } });
                                toast.success(`${f.name} added to the pantry`);
                              })
                            }
                          >
                            <LuviesAmount value={f.price} size="sm" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {dock === "boutique" && (
              <>
                <Link
                  to="/app/panda-shop"
                  onClick={() => setDock(null)}
                  className="flex items-center justify-between rounded-2xl border border-petal/40 bg-petal/10 p-3 text-sm"
                >
                  <span>Browse the Panda Shop</span>
                  <ChevronRight className="size-4" />
                </Link>
                {ownedShopItems.length === 0 ? (
                  <p className="text-sm text-candle-muted">Nothing bought yet — outfits and effects show up here.</p>
                ) : (
                  PANDA_CATEGORIES.map((cat) => {
                    const rows = ownedShopItems.filter((r) => r.item.category === cat.key);
                    if (!rows.length) return null;
                    return (
                      <div key={cat.key} className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-candle-muted">{cat.label}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {rows.map(({ inv, item }) => (
                            <button
                              key={item.item_key}
                              onClick={() =>
                                equipShopItem.mutate({ itemKey: item.item_key, equip: !inv.equipped })
                              }
                              className={cn(
                                "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
                                inv.equipped ? "border-petal bg-petal/10" : "border-border bg-surface/60",
                              )}
                            >
                              <span className="text-xl">{item.emoji}</span>
                              <span className="flex-1 text-sm">{item.name}</span>
                              {inv.equipped && <Check className="size-4 text-petal" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {dock === "legacy" && (
              <PandaLifePanel
                pet={pet}
                balance={coins}
                partnerName={partner?.display_name}
                hasPartner={!!partner}
              />
            )}
          </div>
      </PetDockOverlay>
    </div>
  );
}

/* ────────────────────────── adoption ────────────────────────── */

function AdoptCard({
  coins,
  cost,
  onAdopt,
  busy,
}: {
  coins: number;
  cost: number;
  onAdopt: (name: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const short = coins < cost;
  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] glass p-6 text-center space-y-4"
      >
        <p className="text-5xl">🐼</p>
        <h1 className="font-display text-3xl">Adopt your panda</h1>
        <p className="mx-auto max-w-sm text-sm text-candle-muted">
          One panda, shared by the two of you. Feed them, dress them, and they'll grow with your streak.
        </p>
        <input
          value={name}
          maxLength={20}
          placeholder="Name your panda"
          onChange={(e) => setName(e.target.value)}
          className="mx-auto block w-56 rounded-xl border border-border bg-ink/50 px-3 py-2 text-center"
        />
        <div className="flex items-center justify-center gap-2 text-sm text-candle-muted">
          Adoption fee <LuviesAmount value={cost} size="sm" />
        </div>
        <Button disabled={busy || short} onClick={() => onAdopt(name)}>
          {short ? "Not enough Luvies" : "Bring them home"}
        </Button>
      </motion.section>
    </AnimatePresence>
  );
}
