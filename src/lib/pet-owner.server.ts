/**
 * A paired couple share ONE panda.
 *
 * Every pet read/write resolves to a single "owner" row so the name, outfit,
 * pantry, fullness, affection and streak are identical on both accounts.
 * Resolution is deterministic:
 *   1. no partner            → the caller's own row
 *   2. exactly one adopted   → that row
 *   3. both adopted          → the oldest panda (tie-break on id)
 *   4. neither adopted       → the lexicographically smaller id
 */
export async function resolvePetOwner(admin: any, userId: string): Promise<string> {
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("partner_id")
      .eq("id", userId)
      .maybeSingle();
    const partnerId = (prof?.partner_id as string | null) ?? null;
    if (!partnerId) return userId;

    const { data: rows } = await admin
      .from("pet_pandas")
      .select("user_id,unlocked,born_at")
      .in("user_id", [userId, partnerId]);

    const adopted = ((rows ?? []) as any[]).filter((r) => r.unlocked === true);
    if (adopted.length === 1) return adopted[0].user_id as string;
    if (adopted.length > 1) {
      adopted.sort(
        (a, b) =>
          String(a.born_at ?? "").localeCompare(String(b.born_at ?? "")) ||
          String(a.user_id).localeCompare(String(b.user_id)),
      );
      return adopted[0].user_id as string;
    }
    return [userId, partnerId].sort()[0]!;
  } catch {
    return userId;
  }
}
