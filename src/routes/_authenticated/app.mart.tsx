import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Minus, Plus, Receipt, Sparkles, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuvieCoin } from "@/components/luvies/LuviesAmount";
import { PandaCineCard } from "@/components/mart/PandaCineCard";
import { useLuviesWallet, usePandaInventory, usePandaShop } from "@/hooks/useLuvies";
import { useProfile } from "@/hooks/useProfile";
import { useCart, useMartCheckout, useMartOrders, useSplitResponse } from "@/hooks/useMart";
import { MART_DEPARTMENTS, cartCount, cartTotal, foodsByAisle, type CartLine, type MartOrder } from "@/lib/mart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/mart")({
  head: () => ({
    meta: [
      { title: "PandaMart — PANDACINE" },
      {
        name: "description",
        content:
          "Shop bamboo, treats and boutique looks with your PandaCine Card and split the bill with your partner.",
      },
      { property: "og:title", content: "PandaMart — PANDACINE" },
      { property: "og:description", content: "Shop bamboo, treats and boutique looks and split the bill with your partner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MartRoute,
});

function MartRoute() {
  const { data: wallet } = useLuviesWallet();
  const balance = wallet?.balance ?? 0;
  const { data: profile } = useProfile();
  const { data: shopItems = [] } = usePandaShop();
  const { data: inventory = [] } = usePandaInventory();
  const owned = useMemo(() => new Set(inventory.map((i) => i.item_key)), [inventory]);

  const cart = useCart();
  const checkout = useMartCheckout();
  const { data: ordersData } = useMartOrders();
  const respond = useSplitResponse();

  const [view, setView] = useState<"shop" | "checkout" | "receipts">("shop");
  const [split, setSplit] = useState(false);
  const [receipt, setReceipt] = useState<MartOrder | null>(null);

  const me_profile = (profile as any)?.profile ?? null;
  const partner = (profile as any)?.partner ?? null;
  const total = cartTotal(cart.lines);
  const count = cartCount(cart.lines);
  const partnerShare = split && partner ? Math.floor(total / 2) : 0;

  const orders = ordersData?.orders ?? [];
  const me = ordersData?.userId;
  const pending = orders.filter((o) => o.split_status === "pending" && o.partner_id === me);

  const pay = () => {
    checkout.mutate(
      { items: cart.lines.map((l) => ({ kind: l.kind, key: l.key, qty: l.qty })), split: split && !!partner },
      {
        onSuccess: (r: any) => {
          cart.clear();
          setView("shop");
          setReceipt(r.order as MartOrder);
          toast.success(split && partner ? "Paid — split request sent" : "Paid with your PandaCine Card 💳");
        },
      },
    );
  };

  return (
    <div className="relative mx-auto w-full max-w-4xl px-5 pb-40 pt-4">
      {/* masthead */}
      <header className="flex items-center justify-between">
        <Link
          to="/app"
          aria-label="Back"
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-5">
          <button
            onClick={() => setView(view === "receipts" ? "shop" : "receipts")}
            className={cn(
              "text-[10px] uppercase tracking-[0.28em] transition",
              view === "receipts" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Receipts{pending.length ? ` · ${pending.length}` : ""}
          </button>
          <span className="flex items-center gap-2 text-sm tabular-nums">
            <LuvieCoin className="size-4" />
            {balance.toLocaleString()}
          </span>
        </div>
      </header>

      <div className="mt-10 text-center">
        <p className="text-[10px] uppercase tracking-[0.34em] text-muted-foreground">Open 24 hours</p>
        <h1 className="mt-2 font-display text-[2.9rem] italic leading-none">PandaMart</h1>
        <p className="mx-auto mt-3 max-w-sm text-[13px] text-muted-foreground">
          Everything settles on your PandaCine Card
          {partner ? `, and any bill can be halved with ${partner.display_name}.` : "."}
        </p>
      </div>

      {view === "receipts" ? (
        <section className="mx-auto mt-12 max-w-xl">
          {orders.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No receipts yet. Every PandaMart purchase is filed here.
            </p>
          ) : (
            <div className="divide-y divide-foreground/[0.06]">
              {orders.map((o) => (
                <ReceiptRow
                  key={o.id}
                  order={o}
                  isPartner={o.partner_id === me}
                  onOpen={() => setReceipt(o)}
                  onRespond={(accept) => respond.mutate({ orderId: o.id, accept })}
                  busy={respond.isPending}
                />
              ))}
            </div>
          )}
        </section>
      ) : view === "checkout" ? (
        <section className="mx-auto mt-10 max-w-md space-y-6">
          <PandaCineCard
            holder={me_profile?.display_name ?? me_profile?.username ?? "Keeper"}
            userId={me_profile?.id}
            balance={balance}
            partnerName={partner?.display_name}
          />

          <div className="space-y-1">
            {cart.lines.map((l) => (
              <CartRow key={l.key} line={l} onQty={cart.setQty} onRemove={cart.remove} />
            ))}
          </div>

          <div className="flex items-baseline justify-between border-t border-dashed border-foreground/[0.12] pt-4">
            <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Total</span>
            <span className="flex items-center gap-1.5 font-display text-2xl italic tabular-nums text-primary">
              <LuvieCoin className="size-4" />
              {total}
            </span>
          </div>

          <SplitToggle
            enabled={split}
            partnerName={partner?.display_name}
            onToggle={() => setSplit((s) => !s)}
            partnerShare={partnerShare}
          />

          <Button variant="petal" size="block" disabled={checkout.isPending || total > balance || !total} onClick={pay}>
            {total > balance ? `Need ${total - balance} more Luvies` : `Pay ${total} with card`}
          </Button>
          <button
            onClick={() => setView("shop")}
            className="mx-auto block text-[11px] uppercase tracking-[0.26em] text-muted-foreground transition hover:text-foreground"
          >
            Keep shopping
          </button>
        </section>
      ) : (
        <div className="mt-14 space-y-16">
          {MART_DEPARTMENTS.map((d) => {
            const products =
              d.key === "Boutique"
                ? shopItems.map((s) => ({
                    key: s.item_key,
                    emoji: s.emoji,
                    name: s.name,
                    note: owned.has(s.item_key) ? "In your closet" : (s.description ?? s.category),
                    price: s.price,
                    disabled: owned.has(s.item_key),
                    add: () =>
                      cart.add({ kind: "boutique" as const, key: s.item_key, name: s.name, emoji: s.emoji, price: s.price }),
                  }))
                : foodsByAisle(d.key).map((f) => ({
                    key: f.key,
                    emoji: f.emoji,
                    name: f.name,
                    note: `+${f.fullness} fullness · +${f.affection} affection`,
                    price: f.price,
                    disabled: false,
                    add: () => cart.add({ kind: "food" as const, key: f.key, name: f.name, emoji: f.emoji, price: f.price }),
                  }));
            if (!products.length) return null;
            return (
              <section key={d.key}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-2xl italic leading-none">{d.label}</h2>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">{d.tagline}</p>
                </div>
                <div className="mt-5 -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {products.map((p) => (
                    <Product key={p.key} {...p} onAdd={p.add} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* persistent basket bar */}
      <AnimatePresence>
        {count > 0 && view !== "checkout" && (
          <motion.button
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={() => setView("checkout")}
            className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-[min(92%,26rem)] items-center gap-3 rounded-full bg-card/95 px-5 py-3 text-left shadow-[0_14px_44px_-14px_hsl(var(--foreground)/0.45),0_0_0_1px_hsl(var(--foreground)/0.06)] backdrop-blur-xl"
          >
            <span className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
              {count} {count === 1 ? "item" : "items"}
            </span>
            <span className="ml-auto flex items-center gap-1.5 tabular-nums">
              <LuvieCoin className="size-4" />
              {total}
            </span>
            <span className="rounded-full bg-primary px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-primary-foreground">
              Checkout
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {receipt && <ReceiptSheet order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

/** Lookbook card — image plate, name, price, one quiet plus. */
function Product({
  emoji,
  name,
  note,
  price,
  onAdd,
  disabled,
}: {
  emoji: string;
  name: string;
  note: string;
  price: number;
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("w-[9.5rem] shrink-0 snap-start", disabled && "opacity-45")}>
      <div className="grid aspect-[4/5] place-items-center rounded-[22px] bg-foreground/[0.04] text-[3rem]">
        {emoji}
      </div>
      <div className="mt-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-tight">{name}</p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{note}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] tabular-nums text-primary">
            <LuvieCoin className="size-3" />
            {price}
          </p>
        </div>
        <button
          disabled={disabled}
          onClick={onAdd}
          aria-label={`Add ${name}`}
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-foreground transition hover:bg-primary hover:text-primary-foreground disabled:opacity-0"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function CartRow({
  line,
  onQty,
  onRemove,
}: {
  line: CartLine;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-2 py-2.5 text-sm transition hover:bg-foreground/[0.03]">
      <span className="text-lg">{line.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate">{line.name}</p>
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {line.price} × {line.qty}
        </p>
      </div>
      {line.kind === "food" && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <button onClick={() => onQty(line.key, line.qty - 1)} aria-label="Less" className="grid size-6 place-items-center rounded-full hover:text-foreground">
            <Minus className="size-3" />
          </button>
          <span className="w-4 text-center tabular-nums text-foreground">{line.qty}</span>
          <button onClick={() => onQty(line.key, line.qty + 1)} aria-label="More" className="grid size-6 place-items-center rounded-full hover:text-foreground">
            <Plus className="size-3" />
          </button>
        </div>
      )}
      <button onClick={() => onRemove(line.key)} aria-label="Remove" className="text-muted-foreground transition hover:text-destructive">
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function SplitToggle({
  enabled,
  partnerName,
  onToggle,
  partnerShare,
}: {
  enabled: boolean;
  partnerName?: string | null;
  onToggle: () => void;
  partnerShare: number;
}) {
  if (!partnerName) {
    return <p className="text-[11px] text-muted-foreground">Pair with a partner to split bills.</p>;
  }
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition",
        enabled ? "bg-primary/10" : "bg-foreground/[0.04] hover:bg-foreground/[0.06]",
      )}
    >
      <Users className={cn("size-4", enabled ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">Split with {partnerName}</p>
        <p className="text-[10px] text-muted-foreground">
          {enabled ? `They're asked for ${partnerShare} Luvies` : "You pay the whole bill"}
        </p>
      </div>
      {enabled && <Check className="size-4 text-primary" />}
    </button>
  );
}

function ReceiptRow({
  order,
  isPartner,
  onOpen,
  onRespond,
  busy,
}: {
  order: MartOrder;
  isPartner: boolean;
  onOpen: () => void;
  onRespond: (accept: boolean) => void;
  busy: boolean;
}) {
  const status =
    order.split_status === "none"
      ? "Paid in full"
      : order.split_status === "pending"
        ? "Split pending"
        : order.split_status === "accepted"
          ? "Split settled"
          : "Split declined";
  return (
    <div className="py-3">
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <Receipt className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px]">{order.receipt_no}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(order.created_at).toLocaleString()} · {order.items?.length ?? 0} items · {status}
          </p>
        </div>
        <span className="flex items-center gap-1 text-sm tabular-nums text-primary">
          <LuvieCoin className="size-3.5" /> {order.total}
        </span>
      </button>
      {isPartner && order.split_status === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button variant="petal" className="flex-1" disabled={busy} onClick={() => onRespond(true)}>
            Pay my half · {order.partner_share}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => onRespond(false)}>
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

function ReceiptSheet({ order, onClose }: { order: MartOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/60 p-5 backdrop-blur-xl" onClick={onClose}>
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-sm space-y-5 rounded-[28px] bg-card p-7 shadow-[0_24px_70px_-20px_hsl(var(--foreground)/0.5),0_0_0_1px_hsl(var(--foreground)/0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <Sparkles className="mx-auto size-4 text-primary" />
          <p className="mt-2 font-display text-2xl italic">PandaMart</p>
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{order.receipt_no}</p>
        </div>
        <div className="space-y-1.5 border-y border-dashed border-foreground/[0.12] py-4 text-[13px]">
          {(order.items ?? []).map((l) => (
            <div key={l.key} className="flex justify-between gap-2">
              <span className="truncate">
                {l.emoji} {l.name} ×{l.qty}
              </span>
              <span className="tabular-nums text-muted-foreground">{l.price * l.qty}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-[13px]">
          <Row label="Total" value={`${order.total} Luvies`} strong />
          {order.split_status !== "none" && (
            <>
              <Row label="Your share" value={`${order.buyer_share}`} />
              <Row label="Partner share" value={`${order.partner_share} · ${order.split_status}`} />
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="mx-auto flex items-center gap-1.5 text-[11px] uppercase tracking-[0.26em] text-muted-foreground transition hover:text-foreground"
        >
          <X className="size-3" /> Close
        </button>
      </motion.div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold text-primary")}>{value}</span>
    </div>
  );
}
