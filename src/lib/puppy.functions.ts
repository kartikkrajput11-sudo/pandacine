import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PUPPY_FOOD_BY_KEY } from "@/lib/puppy-foods";
import { fullnessNow, hoursSinceFed, STARVE_HOURS } from "@/lib/pet-foods";
import { uniqueLedgerRef, todayUtc } from "@/lib/pet-purchases.server";

export const PUPPY_COST = 250;
export type Puppy = {
  user_id: string; name: string; unlocked: boolean; alive: boolean; fullness: number;
  affection: number; interactions: number; streak: number; last_fed_at: string;
  last_visit: string | null; pantry: Record<string, number>; died_at: string | null;
};

export const getPuppy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("pet_puppies").select("*").eq("user_id", context.userId).maybeSingle();
    if (error) throw error;
    let puppy = data;
    if (puppy?.unlocked && puppy.alive && hoursSinceFed(puppy.last_fed_at) >= STARVE_HOURS) {
      const { data: updated, error: updateError } = await supabaseAdmin.from("pet_puppies")
        .update({ alive: false, died_at: new Date().toISOString(), fullness: 0 })
        .eq("user_id", context.userId).eq("alive", true).select("*").single();
      if (updateError) throw updateError;
      puppy = updated;
    }
    if (puppy?.unlocked && puppy.alive && puppy.last_visit !== todayUtc()) {
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const { data: updated, error: updateError } = await supabaseAdmin.from("pet_puppies")
        .update({ last_visit: todayUtc(), streak: puppy.last_visit === yesterday ? puppy.streak + 1 : 1 })
        .eq("user_id", context.userId).select("*").single();
      if (updateError) throw updateError;
      puppy = updated;
    }
    return { puppy: puppy ? { ...puppy, fullness: puppy.alive ? fullnessNow(puppy.fullness, puppy.last_fed_at) : 0 } as Puppy : null, cost: PUPPY_COST };
  });

export const adoptPuppy = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readError } = await supabaseAdmin.from("pet_puppies").select("unlocked").eq("user_id", context.userId).maybeSingle();
    if (readError) throw readError;
    if (existing?.unlocked) throw new Error("You already have a puppy");
    const ref = uniqueLedgerRef("puppy-adopt", context.userId);
    const { error: spendError } = await supabaseAdmin.rpc("spend_luvies", { _user: context.userId, _amount: PUPPY_COST, _reason: "puppy_adoption", _ref: ref });
    if (spendError) throw new Error(spendError.message);
    const now = new Date().toISOString();
    const name = data.name.trim().slice(0, 20) || "Biscuit";
    const { error } = await supabaseAdmin.from("pet_puppies").upsert({ user_id: context.userId, name, unlocked: true, alive: true, born_at: now, last_fed_at: now, last_visit: todayUtc(), streak: 1 }, { onConflict: "user_id" });
    if (error) {
      await supabaseAdmin.rpc("credit_luvies", { _user: context.userId, _amount: PUPPY_COST, _reason: "refund", _ref: ref });
      throw error;
    }
    return { name };
  });

export const renamePuppy = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const name = data.name.trim().slice(0, 20);
    if (name.length < 2) throw new Error("Name needs at least 2 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("pet_puppies").update({ name, updated_at: new Date().toISOString() }).eq("user_id", context.userId).eq("unlocked", true);
    if (error) throw error;
    return { name };
  });

export const feedPuppy = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const food = PUPPY_FOOD_BY_KEY[data.key];
    if (!food) throw new Error("Unknown puppy food");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: puppy, error: readError } = await supabaseAdmin.from("pet_puppies").select("*").eq("user_id", context.userId).maybeSingle();
    if (readError) throw readError;
    if (!puppy?.unlocked || !puppy.alive || hoursSinceFed(puppy.last_fed_at) >= STARVE_HOURS) throw new Error("Your puppy cannot be fed right now");
    const pantry = { ...(puppy.pantry as Record<string, number>) };
    if (!pantry[food.key]) throw new Error("That food isn't in your pantry");
    pantry[food.key] -= 1;
    if (!pantry[food.key]) delete pantry[food.key];
    const fullness = Math.min(100, fullnessNow(puppy.fullness, puppy.last_fed_at) + food.fullness);
    const affection = Math.min(100, puppy.affection + food.affection);
    const { error } = await supabaseAdmin.from("pet_puppies").update({ pantry, fullness, affection, last_fed_at: new Date().toISOString(), interactions: puppy.interactions + 1, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    if (error) throw error;
    return { fullness, affection };
  });

export const playWithPuppy = createServerFn({ method: "POST" })
  .inputValidator((input: { action: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (!["fetch", "tug", "pat", "belly", "paw", "nap"].includes(data.action)) throw new Error("Unknown activity");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: puppy, error: readError } = await supabaseAdmin.from("pet_puppies").select("unlocked,alive,interactions,affection,last_fed_at").eq("user_id", context.userId).maybeSingle();
    if (readError) throw readError;
    if (!puppy?.unlocked || !puppy.alive || hoursSinceFed(puppy.last_fed_at) >= STARVE_HOURS) throw new Error("Your puppy cannot play right now");
    const affection = Math.min(100, puppy.affection + (data.action === "fetch" ? 3 : 1));
    const { error } = await supabaseAdmin.from("pet_puppies").update({ interactions: puppy.interactions + 1, affection, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    if (error) throw error;
    return { affection };
  });