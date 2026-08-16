import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FOOD_BY_KEY } from "@/lib/pet-foods";

export type CheckoutInput = {
  items: { kind: "food" | "boutique"; key: string; qty: number }[];
  split: boolean;
  note?: string;
};

function receiptNo(): string {
  const n = Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, "0");
  const d = new Date();
  return `PM-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}-${n}`;
}

/**
 * Authoritative PandaMart checkout. Prices come from the server catalogue,
 * never from the client. The buyer always pays the full bill up front; a split
 * bill sends the partner a reimbursement request for their half.
 */
export const martCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: CheckoutInput) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const petOwnerId = await resolvePetOwner(supabaseAdmin, userId);

    const requested = (data.items ?? []).filter((i) => i && i.key).slice(0, 40);
    if (!requested.length) throw new Error("Your cart is empty");

    // Boutique catalogue + what the buyer already owns.
    const { data: shopRows } = await supabaseAdmin
      .from("panda_shop_items" as any)
      .select("item_key,name,emoji,price,active");
    const shop = new Map<string, any>((shopRows ?? []).map((r: any) => [r.item_key, r]));

    const { data: ownedRows } = await supabaseAdmin
      .from("panda_inventory" as any)
      .select("item_key")
      .eq("user_id", userId);
    const owned = new Set<string>((ownedRows ?? []).map((r: any) => r.item_key));

    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("pantry,unlocked,alive")
      .eq("user_id", petOwnerId)
      .maybeSingle();

    const lines: {
      kind: "food" | "boutique";
      key: string;
      name: string;
      emoji: string;
      price: number;
      qty: number;
    }[] = [];
    const skipped: string[] = [];

    for (const item of requested) {
      const qty = Math.max(1, Math.min(10, Math.round(item.qty ?? 1)));
      if (item.kind === "food") {
        const f = FOOD_BY_KEY[item.key];
        if (!f) continue;
        if (!(pet as any)?.unlocked) throw new Error("Adopt your panda before buying food");
        lines.push({ kind: "food", key: f.key, name: f.name, emoji: f.emoji, price: f.price, qty });
      } else {
        const s = shop.get(item.key);
        if (!s || s.active === false) continue;
        if (owned.has(item.key)) {
          skipped.push(s.name);
          continue;
        }
        lines.push({
          kind: "boutique",
          key: item.key,
          name: s.name,
          emoji: s.emoji ?? "✨",
          price: s.price,
          qty: 1,
        });
      }
    }

    if (!lines.length) throw new Error(skipped.length ? "You already own everything in the cart" : "Nothing to buy");

    const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("partner_id")
      .eq("id", userId)
      .maybeSingle();
    const partnerId = ((profile as any)?.partner_id as string | null) ?? null;

    const wantsSplit = !!data.split && !!partnerId;
    const partnerShare = wantsSplit ? Math.floor(total / 2) : 0;
    const buyerShare = total - partnerShare;

    // Buyer pays the whole bill now — the split is a reimbursement request.
    const { error: sErr } = await supabaseAdmin.rpc("spend_luvies" as any, {
      _user: userId,
      _amount: total,
      _reason: "pandamart",
      _ref: `mart:${lines.length}`,
    } as any);
    if (sErr) throw new Error(String(sErr.message).replace(/^.*Not enough Luvies/, "Not enough Luvies"));

    // Deliver the goods.
    try {
      const foods = lines.filter((l) => l.kind === "food");
      if (foods.length) {
        const pantry = { ...(((pet as any)?.pantry ?? {}) as Record<string, number>) };
        for (const f of foods) pantry[f.key] = (pantry[f.key] ?? 0) + f.qty;
        const { error } = await supabaseAdmin
          .from("pet_pandas" as any)
          .update({ pantry, updated_at: new Date().toISOString() })
          .eq("user_id", petOwnerId);
        if (error) throw error;
      }
      const boutique = lines.filter((l) => l.kind === "boutique");
      if (boutique.length) {
        const { error } = await supabaseAdmin
          .from("panda_inventory" as any)
          .insert(boutique.map((b) => ({ user_id: userId, item_key: b.key })));
        if (error && !String(error.message).includes("duplicate key")) throw error;
      }
    } catch (e) {
      await supabaseAdmin.rpc("credit_luvies" as any, {
        _user: userId,
        _amount: total,
        _reason: "refund",
        _ref: "mart:failed",
      } as any);
      throw e;
    }

    const { data: order, error: oErr } = await supabaseAdmin
      .from("mart_orders" as any)
      .insert({
        receipt_no: receiptNo(),
        buyer_id: userId,
        partner_id: wantsSplit ? partnerId : null,
        items: lines,
        total,
        buyer_share: buyerShare,
        partner_share: partnerShare,
        split_status: wantsSplit ? "pending" : "none",
        note: (data.note ?? "").slice(0, 120) || null,
      })
      .select("*")
      .maybeSingle();
    if (oErr) throw oErr;

    return { ok: true, order, skipped };
  });

/** Orders the caller bought, plus split bills waiting on them. */
export const listMartOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("mart_orders" as any)
      .select("*")
      .or(`buyer_id.eq.${context.userId},partner_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(40);
    return { orders: (data ?? []) as any[], userId: context.userId };
  });

/** The partner accepts (pays their half) or declines a split bill. */
export const respondToSplit = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; accept: boolean }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("mart_orders" as any)
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    const o = order as any;
    if (!o) throw new Error("Receipt not found");
    if (o.partner_id !== context.userId) throw new Error("This split isn't addressed to you");
    if (o.split_status !== "pending") throw new Error("This split was already settled");

    if (!data.accept) {
      await supabaseAdmin
        .from("mart_orders" as any)
        .update({ split_status: "declined", settled_at: new Date().toISOString() })
        .eq("id", o.id);
      return { ok: true, status: "declined" as const };
    }

    const { error: sErr } = await supabaseAdmin.rpc("spend_luvies" as any, {
      _user: context.userId,
      _amount: o.partner_share,
      _reason: "pandamart_split",
      _ref: o.receipt_no,
    } as any);
    if (sErr) throw new Error(String(sErr.message).replace(/^.*Not enough Luvies/, "Not enough Luvies"));

    const { error: cErr } = await supabaseAdmin.rpc("credit_luvies" as any, {
      _user: o.buyer_id,
      _amount: o.partner_share,
      _reason: "pandamart_split_settled",
      _ref: o.receipt_no,
    } as any);
    if (cErr) {
      await supabaseAdmin.rpc("credit_luvies" as any, {
        _user: context.userId,
        _amount: o.partner_share,
        _reason: "refund",
        _ref: o.receipt_no,
      } as any);
      throw cErr;
    }

    await supabaseAdmin
      .from("mart_orders" as any)
      .update({ split_status: "accepted", settled_at: new Date().toISOString() })
      .eq("id", o.id);

    return { ok: true, status: "accepted" as const, paid: o.partner_share };
  });
