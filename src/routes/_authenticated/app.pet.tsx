import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Heart,
  Lock,
  Pencil,
  Shirt,
  ShoppingBag,
  Sparkles,
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
import { FOOD_BY_KEY, STARVE_HOURS, fullnessNow, hoursSinceFed } from "@/lib/pet-foods";
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

type Dock = "care" | "wardrobe" | "legacy";

const DOCK: { key: Dock; label: string; Icon: typeof Heart }[] = [
  { key: "care", label: "Care", Icon: Heart },
  { key: "wardrobe", label: "Wardrobe", Icon: Shirt },
  { key: "legacy", label: "Legacy", Icon: Sparkles },
];

/* ────────────────────────── daily care quests ────────────────────────── */

type Quests = { fed: boolean; plays: number; dressed: boolean };
const QUEST_GOAL = 5;

function questKey() {
  return `pet-quests:${new Date().toISOString().slice(0, 10)}`;
}
function loadQuests(): Quests {
  try {
    const raw = localStorage.getItem(questKey());
    if (raw) return { fed: false, plays: 0, dressed: false, ...JSON.parse(raw) };
  } catch {}
  return { fed: false, plays: 0, dressed: false };
}
function saveQuests(q: Quests) {
  try {
    localStorage.setItem(questKey(), JSON.stringify(q));
  } catch {}
}

/* ────────────────────────── quiet primitives ────────────────────────── */

/** A hairline arc. No labels until the value matters. */
function Arc({ value, label, tone }: { value: number; label: string; tone: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative grid size-12 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${tone} ${v * 3.6}deg, color-mix(in oklab, var(--foreground) 9%, transparent) 0deg)`,
        }}
      >
        <div className="grid size-[2.35rem] place-items-center rounded-full bg-background text-[11px] font-medium tabular-nums">
          {v}
        </div>
      </div>
      <p className="text-[9px] uppercase tracking-[0.26em] text-muted-foreground">{label}</p>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{children}</p>;
}

/** Single-column sheet — one focus at a time, no nested grids. */
function PetSheet({
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/55 px-3 pb-3 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            data-state="open"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-xl overflow-hidden rounded-[28px] bg-card shadow-[0_-2px_60px_-12px_hsl(var(--foreground)/0.35),0_0_0_1px_hsl(var(--foreground)/0.06)]"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between gap-3 px-6 pt-5">
              <h2 className="font-display text-2xl capitalize leading-none">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto overscroll-contain px-6 pb-7 pt-5">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One quiet row — the only list primitive on the page. */
function Row({
  leading,
  title,
  note,
  trailing,
  onClick,
  active,
  disabled,
}: {
  leading?: ReactNode;
  title: string;
  note?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition",
        onClick && "hover:bg-foreground/[0.04] active:scale-[0.995]",
        active && "bg-primary/10",
        disabled && "opacity-45",
      )}
    >
      {leading && <span className="grid size-9 shrink-0 place-items-center text-xl">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-tight">{title}</span>
        {note && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{note}</span>}
      </span>
      {trailing}
    </Tag>
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
  const pantryCount = pantryList.reduce((s, r) => s + r.qty, 0);

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

  // Daily care quests — reset every midnight, kept on the device.
  const [quests, setQuests] = useState<Quests>(() => loadQuests());
  function markQuest(patch: Partial<Quests>) {
    setQuests((q) => {
      const next = { ...q, ...patch };
      saveQuests(next);
      const doneNow =
        (next.fed ? 1 : 0) + (next.plays >= QUEST_GOAL ? 1 : 0) + (next.dressed ? 1 : 0);
      const doneBefore =
        (q.fed ? 1 : 0) + (q.plays >= QUEST_GOAL ? 1 : 0) + (q.dressed ? 1 : 0);
      if (doneNow === 3 && doneBefore < 3) toast.success(`All of today's care done — ${name} is glowing ✨`);
      return next;
    });
  }

  function touch(kind: keyof PandaActions) {
    const a = actionsRef.current;
    if (!a) return;
    a[kind]();
    markQuest({ plays: quests.plays + 1 });
    const next = {
      interactions: pending.current.interactions + 1,
      affection: Math.min(100, pending.current.affection + 1),
    };
    pending.current = next;
    save({ data: next }).then(() => qc.invalidateQueries({ queryKey: ["pet"] })).catch(() => {});
  }

  const firstPantry = pantryList.find((r) => r.qty > 0) ?? null;
  const questsDone = (quests.fed ? 1 : 0) + (quests.plays >= QUEST_GOAL ? 1 : 0) + (quests.dressed ? 1 : 0);

  const stateLine = hungry
    ? `hungry · ${Math.round(hoursLeft)}h of food left`
    : fullness > 80
      ? `content · fed recently`
      : `settled · ${Math.round(fullness)}% full`;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-24 text-center text-sm text-muted-foreground">
        Waking the grove…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-40 pt-4">
      {/* header — two anchors, nothing else */}
      <header className="flex items-center justify-between">
        <Link
          to="/app"
          aria-label="Home"
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link to="/app/wallet" className="flex items-center gap-2 rounded-full px-2 py-1.5 transition hover:opacity-80">
          <LuvieCoin className="size-4" />
          <span className="text-sm tabular-nums">{coins.toLocaleString()}</span>
        </Link>
      </header>

      {lifecycle === "NO_PANDA_YET" && (
        <AdoptCard
          coins={coins}
          cost={(data as any)?.cost ?? 250}
          onAdopt={(n) =>
            run("Adoption", async () => {
              await adopt({ data: { name: n } });
              toast.success("Your panda is home 🐼");
            })
          }
          busy={busy}
        />
      )}

      {lifecycle === "DEAD_PANDA" && (
        <div className="mt-16 space-y-4 text-center">
          <p className="text-4xl">🕯️</p>
          <h1 className="font-display text-3xl">{name} is at rest</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Their story stays with you in the legacy album. When you're ready, a new panda can open their eyes.
          </p>
          <Button onClick={() => birth.mutate(undefined)} disabled={birth.isPending}>
            <Sparkles className="size-4" /> Welcome a new panda
          </Button>
        </div>
      )}

      {lifecycle === "ACTIVE_PANDA" && (
        <>
          {/* stage — the only hero. no border, no card. */}
          <section className="relative -mx-2 mt-2">
            <PandaStage
              name={name}
              className="h-[min(58vh,480px)] min-h-[380px] w-full"
              costume={(pet?.costume ?? "classic") as Costume}
              hideActions
              playful={false}
              wear={{
                outfit: look.outfit?.item_key ?? null,
                accessory: look.accessory?.item_key ?? null,
                prop: look.prop?.item_key ?? null,
              }}
              onReady={(a) => {
                actionsRef.current = a;
                forceReady((n) => (n === 0 ? 1 : n));
              }}
            />
            <PandaAdornments look={look} />
          </section>

          {/* identity */}
          <div className="mt-6 text-center">
            {editing ? (
              <div className="flex items-center justify-center gap-2">
                <input
                  autoFocus
                  value={draft}
                  maxLength={20}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-48 rounded-xl bg-foreground/[0.05] px-3 py-1.5 text-center font-display text-2xl outline-none"
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
                <h1 className="font-display text-[2.6rem] italic leading-none">{name}</h1>
                <Pencil className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </button>
            )}
            <p className={cn("mt-2 text-[11px] tracking-wide", hungry ? "text-primary" : "text-muted-foreground")}>
              {stateLine}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Level {String(level).padStart(2, "0")}
              {partner ? ` · shared with ${partner.display_name}` : ""}
            </p>
          </div>

          {/* vitals — three arcs, nothing framed */}
          <div className="mt-7 flex items-start justify-center gap-10">
            <Arc value={fullness} label="Fullness" tone="hsl(45 90% 62%)" />
            <Arc value={affection} label="Affection" tone="hsl(340 80% 66%)" />
            <Arc value={levelPct} label="Level" tone="hsl(var(--primary))" />
          </div>

          {/* touch — four verbs, text only */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {([
              ["headpat", "Pat"],
              ["bellyRub", "Belly rub"],
              ["boop", "Boop"],
              ["tailPull", "Tail"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => touch(k)}
                className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground transition hover:text-primary"
              >
                {label}
              </button>
            ))}
          </div>

          {/* quick feed — one tap when the pantry has something */}
          {firstPantry && (
            <div className="mt-6 flex justify-center">
              <button
                disabled={busy}
                onClick={() =>
                  run("Feeding", async () => {
                    const res = await feed({ data: { key: firstPantry.food.key } });
                    markQuest({ fed: true });
                    toast.success(res.unlocked ? `Unlocked ${res.unlocked}!` : `${name} loved the ${firstPantry.food.name}`);
                  })
                }
                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2 text-[11px] uppercase tracking-[0.26em] text-primary transition hover:bg-primary/15 active:scale-95 disabled:opacity-50"
              >
                Feed {firstPantry.food.emoji}
              </button>
            </div>
          )}

          {/* today's care — three quiet ticks */}
          <div className="mx-auto mt-8 w-full max-w-xs">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <span>Today's care</span>
              <span className="tabular-nums">{questsDone}/3</span>
            </div>
            <div className="mt-3 space-y-1">
              <Row
                leading={quests.fed ? "✅" : "🍎"}
                title="Fed something"
                note={quests.fed ? "done" : "from the pantry or quick feed"}
                active={quests.fed}
              />
              <Row
                leading={quests.plays >= QUEST_GOAL ? "✅" : "🐾"}
                title={`Play ${QUEST_GOAL} times`}
                note={`${Math.min(quests.plays, QUEST_GOAL)}/${QUEST_GOAL} pats, boops and dances`}
                active={quests.plays >= QUEST_GOAL}
              />
              <Row
                leading={quests.dressed ? "✅" : "👕"}
                title="Dress up"
                note={quests.dressed ? "done" : "try a look from the wardrobe"}
                active={quests.dressed}
                onClick={() => setDock("wardrobe")}
              />
            </div>
          </div>

          {/* one quiet line of context */}
          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            {nextUnlock ? `Next unlock · ${nextUnlock.label} at level ${nextUnlock.level}` : "Everything unlocked"}
            {" · "}
            {pantryCount} pantry {pantryCount === 1 ? "item" : "items"}
            {" · "}
            {pet?.streak ?? 0}-day streak
          </p>
        </>
      )}

      {/* rail — three glyphs plus the mart */}
      {lifecycle !== "NO_PANDA_YET" && (
        <nav className="fixed inset-x-0 bottom-20 z-30 mx-auto w-full max-w-md px-6">
          <div className="flex items-center justify-around rounded-full bg-card/90 px-2 py-2 shadow-[0_10px_40px_-12px_hsl(var(--foreground)/0.4),0_0_0_1px_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
            {DOCK.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setDock(key)}
                aria-label={label}
                className={cn(
                  "grid size-10 place-items-center rounded-full transition",
                  dock === key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-[1.1rem]" />
              </button>
            ))}
            <Link
              to="/app/mart"
              aria-label="PandaMart"
              className="grid size-10 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
            >
              <ShoppingBag className="size-[1.1rem]" />
            </Link>
          </div>
        </nav>
      )}

      <PetSheet dock={dock} title={dock ?? "Panda"} onClose={() => setDock(null)}>
        {dock === "care" && (
          <div className="space-y-6">
            <div className="space-y-1">
              <Eyebrow>Pantry</Eyebrow>
              {pantryList.length === 0 ? (
                <Link
                  to="/app/mart"
                  onClick={() => setDock(null)}
                  className="flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm transition hover:bg-foreground/[0.04]"
                >
                  <span className="text-muted-foreground">Empty — stock up at PandaMart</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <div className="-mx-1">
                  {pantryList.map(({ food, qty }) => (
                    <Row
                      key={food.key}
                      leading={food.emoji}
                      title={food.name}
                      note={`+${food.fullness} fullness`}
                      trailing={<span className="text-xs tabular-nums text-muted-foreground">×{qty}</span>}
                      disabled={busy}
                      onClick={() =>
                        run("Feeding", async () => {
                          const res = await feed({ data: { key: food.key } });
                          markQuest({ fed: true });
                          toast.success(res.unlocked ? `Unlocked ${res.unlocked}!` : `${name} loved the ${food.name}`);
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Eyebrow>Play</Eyebrow>
              <div className="flex flex-wrap gap-x-7 gap-y-3 px-3.5 pt-2">
                {([
                  ["bamboo", "Bamboo"],
                  ["paw", "High five"],
                  ["dance", "Dance"],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => touch(k as keyof PandaActions)}
                    className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground transition hover:text-primary"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Eyebrow>Quick restock</Eyebrow>
              <div className="-mx-1">
                {["bamboo-shoot", "apple", "cookie"]
                  .map((k) => FOOD_BY_KEY[k])
                  .filter(Boolean)
                  .map((f) => (
                    <Row
                      key={f.key}
                      leading={f.emoji}
                      title={f.name}
                      note={f.note}
                      disabled={busy || coins < f.price}
                      trailing={<LuviesAmount value={f.price} size="sm" />}
                      onClick={() =>
                        run("Purchase", async () => {
                          await buy({ data: { key: f.key, qty: 1 } });
                          toast.success(`${f.name} added to the pantry`);
                        })
                      }
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {dock === "wardrobe" && (
          <div className="space-y-6">
            <div className="space-y-1">
              <Eyebrow>Wearing · {COSTUME_BY_KEY[pet?.costume ?? "classic"]?.name ?? "Classic coat"}</Eyebrow>
              <div className="-mx-1">
                {PET_COSTUMES.map((def) => {
                  const unlocked = costumeUnlocked(def, pet);
                  const worn = (pet?.costume ?? "classic") === def.key;
                  return (
                    <Row
                      key={def.key}
                      leading={def.emoji}
                      title={def.name}
                      note={
                        unlocked ? (
                          def.blurb
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            {costumeRequirementText(def)}
                            <span className="inline-block h-[2px] w-14 overflow-hidden rounded-full bg-foreground/10 align-middle">
                              <span
                                className="block h-full bg-primary/70"
                                style={{ width: `${costumeProgress(def, pet)}%` }}
                              />
                            </span>
                          </span>
                        )
                      }
                      active={worn}
                      disabled={!unlocked || busy}
                      trailing={
                        worn ? (
                          <Check className="size-4 text-primary" />
                        ) : !unlocked ? (
                          <Lock className="size-3.5 text-muted-foreground" />
                        ) : undefined
                      }
                      onClick={() =>
                        run("Outfit", async () => {
                          await wear({ data: { costume: def.key } });
                          markQuest({ dressed: true });
                          toast.success(`${name} is wearing ${def.name}`);
                        })
                      }
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Eyebrow>Boutique closet</Eyebrow>
              {ownedShopItems.length === 0 ? (
                <Link
                  to="/app/mart"
                  onClick={() => setDock(null)}
                  className="flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm transition hover:bg-foreground/[0.04]"
                >
                  <span className="text-muted-foreground">Nothing bought yet — browse the boutique</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                PANDA_CATEGORIES.map((cat) => {
                  const rows = ownedShopItems.filter((r) => r.item.category === cat.key);
                  if (!rows.length) return null;
                  return (
                    <div key={cat.key} className="-mx-1 pt-2">
                      <p className="px-4 pb-1 text-[10px] uppercase tracking-[0.26em] text-muted-foreground/70">
                        {cat.label}
                      </p>
                      {rows.map(({ inv, item }) => (
                        <Row
                          key={item.item_key}
                          leading={item.emoji}
                          title={item.name}
                          active={inv.equipped}
                          trailing={inv.equipped ? <Check className="size-4 text-primary" /> : undefined}
                          onClick={() => equipShopItem.mutate({ itemKey: item.item_key, equip: !inv.equipped })}
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {dock === "legacy" && (
          <PandaLifePanel pet={pet} balance={coins} partnerName={partner?.display_name} hasPartner={!!partner} />
        )}
      </PetSheet>
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
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="mt-16 space-y-5 text-center"
    >
      <p className="text-5xl">🐼</p>
      <h1 className="font-display text-4xl italic leading-none">Adopt your panda</h1>
      <p className="mx-auto max-w-xs text-sm text-muted-foreground">
        One panda, shared by the two of you. Feed them, dress them, and they'll grow with your streak.
      </p>
      <input
        value={name}
        maxLength={20}
        placeholder="Name your panda"
        onChange={(e) => setName(e.target.value)}
        className="mx-auto block w-56 rounded-xl bg-foreground/[0.05] px-3 py-2 text-center outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        Adoption fee <LuviesAmount value={cost} size="sm" />
      </div>
      <Button disabled={busy || short} onClick={() => onAdopt(name)}>
        {short ? "Not enough Luvies" : "Bring them home"}
      </Button>
    </motion.section>
  );
}
