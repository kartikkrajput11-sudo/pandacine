import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FOOD_BY_KEY, STARVE_HOURS, fullnessNow, hoursSinceFed } from "@/lib/pet-foods";
import { COSTUME_BY_KEY, costumeUnlocked } from "@/lib/pet-wardrobe";
import { REBIRTH_COST, pandaLifecycle } from "@/lib/panda-lifecycle";
import { PET_COST, todayUtc, uniqueLedgerRef } from "@/lib/pet-purchases.server";

export type Pet = {
  user_id: string;
  name: string;
  unlocked: boolean;
  affection: number;
  interactions: number;
  streak: number;
  last_visit: string | null;
  costume: string;
  fullness: number;
  last_fed_at: string | null;
  alive: boolean;
  died_at: string | null;
  pantry: Record<string, number>;
  unlocked_expressions: string[];
  unlocked_costumes: string[];
};

/** Reads (and lazily creates) the caller's pet row, updating the daily streak. */
export const getPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const ownerId = await resolvePetOwner(supabaseAdmin, userId);

    let { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("*")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (!pet) {
      const { data: created } = await supabaseAdmin
        .from("pet_pandas" as any)
        .insert({ user_id: ownerId, last_visit: todayUtc() })
        .select("*")
        .maybeSingle();
      pet = created;
    } else {
      const p = pet as any;
      const last = p.last_visit as string | null;
      if (last !== todayUtc()) {
        const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        const streak = last === yesterday ? (p.streak ?? 0) + 1 : 1;
        const { data: updated } = await supabaseAdmin
          .from("pet_pandas" as any)
          .update({
            last_visit: todayUtc(),
            streak,
            costume: streak >= 7 ? "golden" : p.costume,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", ownerId)
          .select("*")
          .maybeSingle();
        pet = updated ?? pet;
      }
    }

    // Starvation: no food for STARVE_HOURS → the panda is gone for good.
    const p2 = pet as any;
    if (p2?.unlocked && p2.alive !== false && hoursSinceFed(p2.last_fed_at) >= STARVE_HOURS) {
      const { data: dead } = await supabaseAdmin
        .from("pet_pandas" as any)
        .update({ alive: false, died_at: new Date().toISOString(), fullness: 0 })
        .eq("user_id", ownerId)
        .select("*")
        .maybeSingle();
      pet = dead ?? pet;
    }
    if (pet) {
      (pet as any).fullness = (pet as any).alive === false ? 0 : fullnessNow((pet as any).fullness ?? 100, (pet as any).last_fed_at);
    }

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("coins,panda_coins")
      .eq("id", userId)
      .maybeSingle();
    const balance = Math.max((prof as any)?.panda_coins ?? 0, (prof as any)?.coins ?? 0);
    return {
      pet: pet as unknown as Pet,
      lifecycle: pandaLifecycle(pet as any),
      coins: balance,
      cost: PET_COST,
      rebirthCost: REBIRTH_COST,
    };

  });

/** Spends Luvies to adopt the mascot. */
export const unlockPet = createServerFn({ method: "POST" })
  .inputValidator((input: { name?: string }) => input ?? {})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const ownerId = await resolvePetOwner(supabaseAdmin, userId);

    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("unlocked")
      .eq("user_id", ownerId)
      .maybeSingle();
    if ((pet as any)?.unlocked) throw new Error("You already adopted your panda");

    const adoptionRef = uniqueLedgerRef("pet-adopt", ownerId);

    const { data: remaining, error: dErr } = await supabaseAdmin.rpc("spend_luvies" as any, {
      _user: userId,
      _amount: PET_COST,
      _reason: "panda_adoption",
      _ref: adoptionRef,
    } as any);
    if (dErr) throw new Error(dErr.message.replace(/^.*Not enough Luvies/, "Not enough Luvies"));

    const name = (data.name ?? "").trim().slice(0, 20) || "Pan";
    const { error: uErr } = await supabaseAdmin
      .from("pet_pandas" as any)
      .upsert(
        { user_id: ownerId, unlocked: true, name, last_visit: todayUtc(), streak: 1, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (uErr) {
      await supabaseAdmin.rpc("credit_luvies" as any, {
        _user: userId,
        _amount: PET_COST,
        _reason: "refund",
        _ref: adoptionRef,
      } as any);
      throw uErr;
    }
    return { ok: true, remaining: (remaining as number) ?? 0, name };
  });

/** Renames the pet. */
export const renamePet = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const name = data.name.trim().slice(0, 20);
    if (name.length < 2) throw new Error("Name needs at least 2 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const ownerId = await resolvePetOwner(supabaseAdmin, context.userId);
    const { error } = await supabaseAdmin
      .from("pet_pandas" as any)
      .update({ name, updated_at: new Date().toISOString() })
      .eq("user_id", ownerId);
    if (error) throw error;
    return { ok: true, name };
  });

/** Persists play progress (affection + interaction count). */
export const savePetProgress = createServerFn({ method: "POST" })
  .inputValidator((input: { interactions: number; affection: number }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const ownerId = await resolvePetOwner(supabaseAdmin, context.userId);
    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("interactions,affection")
      .eq("user_id", ownerId)
      .maybeSingle();
    const p = (pet ?? {}) as any;
    const interactions = Math.max(p.interactions ?? 0, data.interactions);
    const affection = Math.min(100, Math.max(p.affection ?? 0, data.affection));
    await supabaseAdmin
      .from("pet_pandas" as any)
      .update({ interactions, affection, updated_at: new Date().toISOString() })
      .eq("user_id", ownerId);
    return { interactions, affection };
  });

/** Buys food from the panda supermarket and stores it in the pantry. */
export const buyPetFood = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string; qty?: number }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const food = FOOD_BY_KEY[data.key];
    if (!food) throw new Error("Unknown item");
    const qty = Math.max(1, Math.min(10, Math.round(data.qty ?? 1)));
    const cost = food.price * qty;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const ownerId = await resolvePetOwner(supabaseAdmin, context.userId);

    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("pantry,alive,unlocked")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (!(pet as any)?.unlocked) throw new Error("Adopt your panda first");

    const purchaseRef = uniqueLedgerRef("food", food.key);

    const { data: remaining, error: sErr } = await supabaseAdmin.rpc("spend_luvies" as any, {
      _user: context.userId,
      _amount: cost,
      _reason: "panda_food",
      _ref: purchaseRef,
    } as any);
    if (sErr) throw new Error(sErr.message.replace(/^.*Not enough Luvies/, "Not enough Luvies"));

    const pantry = { ...(((pet as any)?.pantry ?? {}) as Record<string, number>) };
    pantry[food.key] = (pantry[food.key] ?? 0) + qty;

    const { error } = await supabaseAdmin
      .from("pet_pandas" as any)
      .update({ pantry, updated_at: new Date().toISOString() })
      .eq("user_id", ownerId);
    if (error) {
      await supabaseAdmin.rpc("credit_luvies" as any, {
        _user: context.userId,
        _amount: cost,
        _reason: "refund",
        _ref: purchaseRef,
      } as any);
      throw error;
    }

    return { ok: true, coins: (remaining as number) ?? 0, pantry };
  });

/** Feeds one pantry item to the panda — restores fullness, affection and unlocks. */
export const feedPet = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const food = FOOD_BY_KEY[data.key];
    if (!food) throw new Error("Unknown item");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const ownerId = await resolvePetOwner(supabaseAdmin, context.userId);
    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("*")
      .eq("user_id", ownerId)
      .maybeSingle();
    const p = pet as any;
    if (!p?.unlocked) throw new Error("Adopt your panda first");
    if (p.alive === false) throw new Error("Your panda is gone. Feeding can't bring them back.");

    const pantry = { ...((p.pantry ?? {}) as Record<string, number>) };
    const currentQty = pantry[food.key] ?? 0;
    if (currentQty < 1) throw new Error("You don't have that in the pantry");
    pantry[food.key] = currentQty - 1;
    if (pantry[food.key] === 0) delete pantry[food.key];

    const current = fullnessNow(p.fullness ?? 100, p.last_fed_at);
    const fullness = Math.min(100, current + food.fullness);
    const affection = Math.min(100, (p.affection ?? 0) + food.affection);

    const expressions: string[] = Array.from(new Set([...(p.unlocked_expressions ?? [])]));
    const costumes: string[] = Array.from(new Set([...(p.unlocked_costumes ?? [])]));
    let unlocked: string | null = null;
    if (food.unlocksExpression && !expressions.includes(food.unlocksExpression)) {
      expressions.push(food.unlocksExpression);
      unlocked = `expression: ${food.unlocksExpression}`;
    }
    if (food.unlocksCostume && !costumes.includes(food.unlocksCostume)) {
      costumes.push(food.unlocksCostume);
      unlocked = `outfit: ${food.unlocksCostume}`;
    }

    const { error } = await supabaseAdmin
      .from("pet_pandas" as any)
      .update({
        pantry,
        fullness,
        affection,
        last_fed_at: new Date().toISOString(),
        interactions: (p.interactions ?? 0) + 1,
        unlocked_expressions: expressions,
        unlocked_costumes: costumes,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", ownerId);
    if (error) throw error;

    return { ok: true, fullness, affection, pantry, unlocked };
  });

/** Chooses which outfit the panda wears — validated against wardrobe unlocks. */
export const setPetCostume = createServerFn({ method: "POST" })
  .inputValidator((input: { costume: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const def = COSTUME_BY_KEY[data.costume];
    if (!def) throw new Error("Unknown outfit");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const ownerId = await resolvePetOwner(supabaseAdmin, context.userId);
    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("affection,streak,interactions,unlocked_costumes,unlocked,alive")
      .eq("user_id", ownerId)
      .maybeSingle();
    const p = pet as any;
    if (!p?.unlocked) throw new Error("Adopt your panda first");
    if (p.alive === false) throw new Error("Your panda is gone.");
    if (!costumeUnlocked(def, p)) throw new Error(`${def.name} is still locked`);

    const costumes: string[] = Array.from(new Set([...(p.unlocked_costumes ?? []), def.key]));
    const { error } = await supabaseAdmin
      .from("pet_pandas" as any)
      .update({ costume: def.key, unlocked_costumes: costumes, updated_at: new Date().toISOString() })
      .eq("user_id", ownerId);
    if (error) throw error;
    return { ok: true, costume: def.key };
  });

/**
 * Explicit new-panda purchase after a loss — NOT a revive.
 * The fallen panda is preserved forever in the memorial; a brand-new panda
 * (new birthday, fresh stats) is born for REBIRTH_COST Luvies.
 */
export const birthNewPanda = createServerFn({ method: "POST" })
  .inputValidator((input: { name?: string }) => input ?? {})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePetOwner } = await import("@/lib/pet-owner.server");
    const ownerId = await resolvePetOwner(supabaseAdmin, userId);

    const { data: pet } = await supabaseAdmin
      .from("pet_pandas" as any)
      .select("*")
      .eq("user_id", ownerId)
      .maybeSingle();
    const p = pet as any;
    if (pandaLifecycle(p) !== "DEAD_PANDA") {
      throw new Error("This is only for a panda that has passed away");
    }

    const birthRef = uniqueLedgerRef("pet-birth", ownerId);

    const { data: remaining, error: sErr } = await supabaseAdmin.rpc("spend_luvies" as any, {
      _user: userId,
      _amount: REBIRTH_COST,
      _reason: "panda_birth",
      _ref: birthRef,
    } as any);
    if (sErr) throw new Error(sErr.message.replace(/^.*Not enough Luvies/, "Not enough Luvies"));

    const diedAt = p.died_at ?? new Date().toISOString();
    const daysLived = Math.max(
      0,
      Math.round((new Date(diedAt).getTime() - new Date(p.born_at).getTime()) / 864e5),
    );

    // Keep the fallen panda's story before the row is reused.
    const { data: existingMemorial } = await supabaseAdmin
      .from("pet_memorials" as any)
      .select("id")
      .eq("user_id", ownerId)
      .eq("died_at", diedAt)
      .maybeSingle();
    if (!existingMemorial) {
      await supabaseAdmin.from("pet_memorials" as any).insert({
        user_id: ownerId,
        name: p.name ?? "Pan",
        costume: p.costume ?? null,
        born_at: p.born_at,
        died_at: diedAt,
        death_reason: p.death_reason ?? "starvation",
        affection: p.affection ?? 0,
        interactions: p.interactions ?? 0,
        streak: p.streak ?? 0,
        days_lived: daysLived,
      });
    }

    const name = (data.name ?? "").trim().slice(0, 20) || "Pan";
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("pet_pandas" as any)
      .update({
        name,
        unlocked: true,
        alive: true,
        died_at: null,
        death_reason: null,
        born_at: now,
        last_fed_at: now,
        last_visit: todayUtc(),
        fullness: 100,
        affection: 0,
        interactions: 0,
        streak: 1,
        costume: "classic",
        pantry: {},
        unlocked_expressions: [],
        unlocked_costumes: [],
        updated_at: now,
      })
      .eq("user_id", ownerId);
    if (error) {
      await supabaseAdmin.rpc("credit_luvies" as any, {
        _user: userId,
        _amount: REBIRTH_COST,
        _reason: "refund",
        _ref: birthRef,
      } as any);
      throw error;
    }

    return { ok: true, name, coins: (remaining as number) ?? 0 };
  });
