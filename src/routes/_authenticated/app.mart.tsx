import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  Receipt,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuvieCoin } from "@/components/luvies/LuviesAmount";
import { PandaCineCard } from "@/components/mart/PandaCineCard";
import { PandaStage } from "@/components/panda/PandaStage";
import { useLuviesWallet, usePandaInventory, usePandaShop } from "@/hooks/useLuvies";
import { useProfile } from "@/hooks/useProfile";
import { useCart, useMartCheckout, useMartOrders, useSplitResponse } from "@/hooks/useMart";
import { MART_DEPARTMENTS, cartCount, cartTotal, foodsByAisle, type CartLine, type MartOrder } from "@/lib/mart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/mart")({
  head: () => ({
    meta: [
      { title: "PandaMart — PANDACINE" },
      { name: "description", content: "Shop bamboo, treats and boutique looks with your PandaCine Card and split the bill with your partner." },
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

  const [dept, setDept] = useState(MART_DEPARTMENTS[0]!.key);
  const [cartOpen, setCartOpen] = useState(false);
  const [split, setSplit] = useState(false);
  const [receipt, setReceipt] = useState<MartOrder | null>(null);
  const [tab, setTab] = useState<"shop" | "receipts">("shop");

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
          setCartOpen(false);
          setReceipt(r.order as MartOrder);
          toast.success(split && partner ? "Paid — split request sent" : "Paid with your PandaCine Card 💳");
        },
      },
    );
  };

  return (
    <div className="relative px-5 pt-8 pb-32">
      <header className="mx-auto flex max-w-5xl items-center gap-3">
        <Link to="/app" aria-label="Back" className="grid size-10 place-items-center rounded-full glass">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Open 24 hours</p>
          <h1 className="font-serif text-2xl italic leading-tight">PandaMart</h1>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm hover:text-petal"
          aria-label="Open cart"
        >
          <ShoppingCart className="size-4" />
          <span className="tabular-nums">{count}</span>
          {count > 0 && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-petal" />}
        </button>
      </header>

      <div className="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        <section className="space-y-5">
          {/* Cashier */}
          <div className="relative overflow-hidden rounded-3xl glass-strong p-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="pointer-events-none w-full max-w-[180px] shrink-0">
                <PandaStage playful={false} lite hideActions className="mx-auto" />
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Your cashier</p>
                <p className="mt-1 font-serif text-xl italic leading-snug">
                  “Welcome to PandaMart, {me_profile?.display_name?.split(" ")[0] ?? "keeper"}. Aisles are stocked.”
                </p>
                <p className="mt-1 text-xs text-candle-muted">
                  Everything is paid with your PandaCine Card. Bills can be split with {partner?.display_name ?? "your partner"}.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 rounded-full border border-border bg-velvet/60 p-1">
            {(["shop", "receipts"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors",
                  tab === t ? "bg-petal text-velvet" : "text-candle-muted hover:text-candle",
                )}
              >
                {t === "shop" ? "Departments" : `Receipts${pending.length ? ` · ${pending.length}` : ""}`}
              </button>
            ))}
          </div>

          {tab === "shop" && (
            <>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {MART_DEPARTMENTS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDept(d.key)}
                    className={cn(
                      "shrink-0 rounded-2xl border px-3.5 py-2 text-left transition-all",
                      dept === d.key ? "border-petal/60 bg-petal/10" : "border-border bg-surface/60 hover:border-petal/40",
                    )}
                  >
                    <span className="text-base">{d.emoji}</span>
                    <p className="font-serif text-sm italic leading-tight">{d.label}</p>
                    <p className="text-[9px] uppercase tracking-widest text-candle-muted">{d.tagline}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {dept !== "Boutique" &&
                  foodsByAisle(dept).map((f) => (
                    <Tile
                      key={f.key}
                      emoji={f.emoji}
                      name={f.name}
                      note={`+${f.fullness} fullness · +${f.affection} affection`}
                      price={f.price}
                      onAdd={() =>
                        cart.add({ kind: "food", key: f.key, name: f.name, emoji: f.emoji, price: f.price })
                      }
                    />
                  ))}

                {dept === "Boutique" &&
                  shopItems.map((s) => (
                    <Tile
                      key={s.item_key}
                      emoji={s.emoji}
                      name={s.name}
                      note={owned.has(s.item_key) ? "Already in your closet" : (s.description ?? s.category)}
                      price={s.price}
                      disabled={owned.has(s.item_key)}
                      onAdd={() =>
                        cart.add({ kind: "boutique", key: s.item_key, name: s.name, emoji: s.emoji, price: s.price })
                      }
                    />
                  ))}
              </div>
            </>
          )}

          {tab === "receipts" && (
            <div className="space-y-3">
              {orders.length === 0 && (
                <p className="rounded-3xl glass p-5 text-sm text-candle-muted">
                  No receipts yet. Every PandaMart purchase is filed here.
                </p>
              )}
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

        <aside className="space-y-4 lg:sticky lg:top-6">
          <PandaCineCard
            holder={me_profile?.display_name ?? me_profile?.username ?? "Keeper"}
            userId={me_profile?.id}
            balance={balance}
            partnerName={partner?.display_name}
          />

          <div className="rounded-3xl glass-strong p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Basket</p>
            {cart.lines.length === 0 ? (
              <p className="text-xs text-candle-muted">Nothing in the basket yet.</p>
            ) : (
              <>
                {cart.lines.map((l) => (
                  <CartRow key={l.key} line={l} onQty={cart.setQty} onRemove={cart.remove} />
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-candle-muted">Total</span>
                  <span className="flex items-center gap-1 font-serif text-lg italic text-petal tabular-nums">
                    <LuvieCoin className="size-4" /> {total}
                  </span>
                </div>
                <SplitToggle
                  enabled={split}
                  partnerName={partner?.display_name}
                  onToggle={() => setSplit((s) => !s)}
                  partnerShare={partnerShare}
                />
                <Button variant="petal" size="block" disabled={checkout.isPending || total > balance} onClick={pay}>
                  {total > balance ? `Need ${total - balance} more Luvies` : `Pay ${total} with card`}
                </Button>
                <button onClick={cart.clear} className="w-full text-[11px] text-candle-muted hover:text-petal">
                  Empty basket
                </button>
              </>
            )}
          </div>

          {pending.length > 0 && (
            <div className="rounded-3xl border border-petal/40 bg-petal/10 p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Split bill waiting</p>
              {pending.map((o) => (
                <div key={o.id} className="space-y-2">
                  <p className="text-sm">
                    Your half is{" "}
                    <span className="font-semibold text-petal tabular-nums">{o.partner_share} Luvies</span> · {o.receipt_no}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="petal"
                      className="flex-1"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ orderId: o.id, accept: true })}
                    >
                      Pay my half
                    </Button>
                    <Button
                      variant="outline"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ orderId: o.id, accept: false })}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setCartOpen(false)}>
          <div
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-velvet p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-serif text-xl italic">Your basket</p>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart">
                <X className="size-5" />
              </button>
            </div>
            {cart.lines.length === 0 ? (
              <p className="text-sm text-candle-muted">Nothing here yet.</p>
            ) : (
              <>
                {cart.lines.map((l) => (
                  <CartRow key={l.key} line={l} onQty={cart.setQty} onRemove={cart.remove} />
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-candle-muted">Total</span>
                  <span className="flex items-center gap-1 font-serif text-lg italic text-petal tabular-nums">
                    <LuvieCoin className="size-4" /> {total}
                  </span>
                </div>
                <SplitToggle
                  enabled={split}
                  partnerName={partner?.display_name}
                  onToggle={() => setSplit((s) => !s)}
                  partnerShare={partnerShare}
                />
                <Button variant="petal" size="block" disabled={checkout.isPending || total > balance} onClick={pay}>
                  {total > balance ? `Need ${total - balance} more Luvies` : `Pay ${total} with card`}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {receipt && <ReceiptSheet order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function Tile({
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
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-surface/60 p-3 transition-all",
        disabled ? "opacity-55" : "hover:border-petal/50",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{emoji}</span>
        <span className="flex items-center gap-1 text-[11px] text-petal tabular-nums">
          <LuvieCoin className="size-3.5" />
          {price}
        </span>
      </div>
      <p className="mt-1 font-serif text-sm italic leading-tight">{name}</p>
      <p className="line-clamp-2 text-[10px] text-candle-muted">{note}</p>
      <button
        disabled={disabled}
        onClick={onAdd}
        className="mt-2 flex items-center justify-center gap-1 rounded-full border border-border py-1.5 text-[10px] uppercase tracking-widest transition-colors hover:border-petal/60 hover:text-petal disabled:opacity-50"
      >
        <Plus className="size-3" /> {disabled ? "Owned" : "Add"}
      </button>
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
    <div className="flex items-center gap-2 text-sm">
      <span className="text-lg">{line.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate">{line.name}</p>
        <p className="text-[10px] text-candle-muted tabular-nums">{line.price} × {line.qty}</p>
      </div>
      {line.kind === "food" && (
        <div className="flex items-center gap-1">
          <button onClick={() => onQty(line.key, line.qty - 1)} aria-label="Less" className="grid size-6 place-items-center rounded-full border border-border">
            <Minus className="size-3" />
          </button>
          <span className="w-4 text-center tabular-nums">{line.qty}</span>
          <button onClick={() => onQty(line.key, line.qty + 1)} aria-label="More" className="grid size-6 place-items-center rounded-full border border-border">
            <Plus className="size-3" />
          </button>
        </div>
      )}
      <button onClick={() => onRemove(line.key)} aria-label="Remove" className="text-candle-muted hover:text-coral">
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
    return <p className="text-[11px] text-candle-muted">Pair with a partner to split bills.</p>;
  }
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-2xl border p-3 text-left transition-all",
        enabled ? "border-petal/60 bg-petal/10" : "border-border bg-surface/60",
      )}
    >
      <Users className={cn("size-4", enabled ? "text-petal" : "text-candle-muted")} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">Split with {partnerName}</p>
        <p className="text-[10px] text-candle-muted">
          {enabled ? `They're asked for ${partnerShare} Luvies` : "You pay the whole bill"}
        </p>
      </div>
      {enabled && <Check className="size-4 text-petal" />}
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
    <div className="rounded-2xl glass p-4">
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <Receipt className="size-4 text-petal" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{order.receipt_no}</p>
          <p className="text-[10px] text-candle-muted">
            {new Date(order.created_at).toLocaleString()} · {order.items?.length ?? 0} items · {status}
          </p>
        </div>
        <span className="flex items-center gap-1 text-sm text-petal tabular-nums">
          <LuvieCoin className="size-3.5" /> {order.total}
        </span>
      </button>
      {isPartner && order.split_status === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button variant="petal" className="flex-1" disabled={busy} onClick={() => onRespond(true)}>
            Pay my half · {order.partner_share}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => onRespond(false)}>
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

function ReceiptSheet({ order, onClose }: { order: MartOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-border bg-velvet p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <Sparkles className="mx-auto size-5 text-petal" />
          <p className="mt-1 font-serif text-xl italic">PandaMart receipt</p>
          <p className="text-[10px] uppercase tracking-[0.24em] text-candle-muted">{order.receipt_no}</p>
        </div>
        <div className="space-y-1.5 border-y border-dashed border-border py-3 text-sm">
          {(order.items ?? []).map((l) => (
            <div key={l.key} className="flex justify-between gap-2">
              <span className="truncate">
                {l.emoji} {l.name} ×{l.qty}
              </span>
              <span className="tabular-nums text-candle-muted">{l.price * l.qty}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-sm">
          <Row label="Total" value={`${order.total} Luvies`} strong />
          {order.split_status !== "none" && (
            <>
              <Row label="Your share" value={`${order.buyer_share}`} />
              <Row label="Partner share" value={`${order.partner_share} · ${order.split_status}`} />
            </>
          )}
        </div>
        <Button variant="petal" size="block" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-candle-muted">{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold text-petal")}>{value}</span>
    </div>
  );
}
