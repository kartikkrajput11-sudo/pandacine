import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TAG_BY_KEY } from "./achievements";

/**
 * Buys an achievement tag for the calling user. Spends Luvies through the
 * shared ledger. Fails if the tag is already owned or the balance is short.
 */
export const purchaseTag = createServerFn({ method: "POST" })
  .inputValidator((input: { tagKey: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tag = TAG_BY_KEY[data.tagKey];
    if (!tag) throw new Error("Unknown tag");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profile_achievements" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("tag_key", tag.key)
      .maybeSingle();
    if (existing) throw new Error("You already own this tag");

    const { data: remaining, error: dErr } = await supabaseAdmin.rpc("spend_luvies" as any, {
      _user: userId,
      _amount: tag.cost,
      _reason: `purchase:${tag.key}`,
      _ref: `tag:${tag.key}`,
    } as any);
    if (dErr) throw new Error(dErr.message.replace(/^.*Not enough Luvies/, "Not enough Luvies"));

    const { error: iErr } = await supabaseAdmin
      .from("profile_achievements" as any)
      .insert({ user_id: userId, tag_key: tag.key });
    if (iErr) {
      // refund through the ledger so history stays honest
      await supabaseAdmin.rpc("credit_luvies" as any, {
        _user: userId,
        _amount: tag.cost,
        _reason: "refund",
        _ref: `tag:${tag.key}`,
      } as any);
      throw iErr;
    }

    return { ok: true, remaining: (remaining as number) ?? 0, tag };
  });
