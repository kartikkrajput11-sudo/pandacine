import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuviesAmount, LuvieCoin } from "@/components/luvies/LuviesAmount";
import { InsufficientLuviesDialog } from "@/components/luvies/InsufficientLuviesDialog";
import { PandaPreview, type PandaLook } from "@/components/panda/PandaPreview";
import {
  useLuviesWallet,
  usePandaEquip,
  usePandaInventory,
  usePandaPurchase,
  usePandaShop,
} from "@/hooks/useLuvies";
import { PANDA_CATEGORIES, RARITY_STYLE, type PandaCategory, type PandaShopItem } from "@/lib/luvies";

export const Route = createFileRoute("/_authenticated/app/panda-shop")({
  component: PandaShopRoute,
  head: () => ({
    meta: [
      { title: "Panda Shop — Dress your PandaCine mascot" },
      {
        name: "description",
        content: "Spend Luvies on outfits, accessories, props, effects and environments for your PandaCine panda.",
      },
      { property: "og:title", content: "Panda Shop — PandaCine" },
      { property: "og:description", content: "Outfits, props and effects for your panda, bought with Luvies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PandaShopRoute() {
  const { data: wallet } = useLuviesWallet();
  const { data: items = [], isLoading } = usePandaShop();
  const { data: inventory = [] } = usePandaInventory();
  const purchase = usePandaPurchase();
  const equip = usePandaEquip();

  const [cat, setCat] = useState<PandaCategory>("outfit");
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [short, setShort] = useState<{ needed: number } | null>(null);

  const owned = useMemo(() => new Map(inventory.map((i) => [i.item_key, i])), [inventory]);
  const byKey = useMemo(() => new Map(items.map((i) => [i.item_key, i])), [items]);
  const balance = wallet?.balance ?? 0;

  /** Equipped look, with the hovered/tapped item swapped in for a live try-on. */
  const look: PandaLook = useMemo(() => {
    const base: PandaLook = {};
    for (const inv of inventory) {
      if (!inv.equipped) continue;
      const item = byKey.get(inv.item_key);
      if (item) base[item.category] = item;
    }
    const preview = previewKey ? byKey.get(previewKey) : null;
    if (preview) base[preview.category] = preview;
    return base;
  }, [inventory, byKey, previewKey]);

  const list = items.filter((i) => i.category === cat);

  async function onBuy(item: PandaShopItem) {
    if (balance < item.price) {
      setShort({ needed: item.price });
      return;
    }
    try {
      const res = await purchase.mutateAsync(item.item_key);
      toast.success(res.already_owned ? `${item.name} is already yours` : `${item.name} unlocked!`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function onEquip(item: PandaShopItem, next: boolean) {
    try {
      await equip.mutateAsync({ itemKey: item.item_key, equip: next });
      toast.success(next ? `${item.name} equipped` : `${item.name} put away`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-ink/70 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/app/pet" className="size-9 rounded-full border border-border flex items-center justify-center">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-sm uppercase tracking-[0.28em] text-candle-muted flex-1">Panda Shop</h1>
          <Link
            to="/app/wallet"
            className="inline-flex items-center gap-1.5 rounded-full border border-petal/30 bg-surface px-3 py-1.5"
          >
            <LuvieCoin className="size-4" />
            <span className="text-sm font-semibold tabular-nums text-petal">
              {new Intl.NumberFormat("en-US").format(balance)}
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <PandaPreview look={look} className="h-64" />

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {PANDA_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                setCat(c.key);
                setPreviewKey(null);
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs transition ${
                cat === c.key
                  ? "border-petal/50 bg-petal/10 text-petal"
                  : "border-border bg-surface text-candle-muted hover:text-foreground"
              }`}
            >
              <span className="mr-1.5">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-candle-muted py-10 text-center">Loading the grove boutique…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {list.map((item) => {
              const inv = owned.get(item.item_key);
              const isOwned = !!inv;
              const busy = purchase.isPending || equip.isPending;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setPreviewKey(item.item_key)}
                  onMouseLeave={() => setPreviewKey(null)}
                  onClick={() => setPreviewKey(item.item_key)}
                  className={`rounded-2xl border bg-surface p-3 flex flex-col gap-2 transition hover:border-petal/40 ${
                    inv?.equipped ? "border-petal/50 ring-1 ring-petal/20" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{item.emoji}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] ${RARITY_STYLE[item.rarity]}`}
                    >
                      {item.rarity}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-[11px] text-candle-muted line-clamp-2">{item.description}</p>
                  </div>

                  {isOwned ? (
                    <Button
                      size="sm"
                      variant={inv!.equipped ? "petal" : "quiet"}
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEquip(item, !inv!.equipped);
                      }}
                    >
                      {inv!.equipped ? (
                        <>
                          <Check className="size-3.5" /> Equipped
                        </>
                      ) : (
                        "Equip"
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={balance >= item.price ? "petal" : "quiet"}
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBuy(item);
                      }}
                    >
                      {balance < item.price && <Lock className="size-3.5" />}
                      <LuviesAmount value={item.price} size="sm" className="!text-current" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <InsufficientLuviesDialog
        open={!!short}
        onClose={() => setShort(null)}
        needed={short?.needed ?? 0}
        balance={balance}
      />
    </div>
  );
}
