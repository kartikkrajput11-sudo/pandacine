/** Luvies — the PandaCine relationship currency. Client-safe helpers only. */

export const LUVIES = "Luvies";

export function formatLuvies(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(n ?? 0)));
}

/** "2,450 Luvies" */
export function luviesLabel(n: number | null | undefined): string {
  return `${formatLuvies(n)} ${LUVIES}`;
}

export type PandaCategory =
  | "outfit"
  | "accessory"
  | "prop"
  | "effect"
  | "environment"
  | "expression";

export const PANDA_CATEGORIES: { key: PandaCategory; label: string; icon: string; blurb: string }[] = [
  { key: "outfit", label: "Outfits", icon: "👕", blurb: "Hoodies, pajamas, jackets" },
  { key: "accessory", label: "Accessories", icon: "🎩", blurb: "Hats, crowns, glasses" },
  { key: "prop", label: "Props", icon: "🎒", blurb: "Plushies, flowers, books" },
  { key: "effect", label: "Effects", icon: "✨", blurb: "Hearts, sparkles, petals" },
  { key: "environment", label: "Environments", icon: "🏠", blurb: "Rooms and scenes" },
  { key: "expression", label: "Expressions", icon: "🐼", blurb: "Moods and animations" },
];

export type PandaShopItem = {
  id: string;
  item_key: string;
  category: PandaCategory;
  name: string;
  emoji: string;
  description: string | null;
  price: number;
  rarity: "common" | "rare" | "legendary";
  sort_order: number;
};

export type PandaInventoryRow = {
  item_key: string;
  equipped: boolean;
  acquired_at: string;
};

export type LuviesWallet = { balance: number; earned: number; spent: number };

export type StreakRecoveryState = {
  eligible: boolean;
  reason?:
    | "no_partner"
    | "streak_intact"
    | "already_recovered"
    | "declined"
    | "expired"
    | "insufficient_luvies"
    | "ok"
    | string;
  lost_days?: number;
  missed_days?: number;
  gap_start?: string;
  gap_end?: string;
  cost?: number;
  balance: number;
  cycle_key?: string;
  /** When the streak officially broke, and the 48h deadline to recover it. */
  broke_at?: string;
  expires_at?: string;
};


/** Human label for a ledger row so history reads like a statement. */
export function ledgerLabel(reason: string, refId: string | null): { title: string; detail: string } {
  if (reason.startsWith("panda_item:")) {
    return { title: "Panda item purchase", detail: (refId ?? "").replace(/^item:/, "").replace(/-/g, " ") };
  }
  if (reason === "streak_recovery") {
    return { title: "Streak recovery", detail: "Streak restored" };
  }
  if (reason === "purchase_bundle") return { title: "Luvies top-up", detail: "Bundle purchase" };
  if (reason === "panda_adoption") return { title: "Panda adoption", detail: "Welcomed your panda home" };
  if (reason === "panda_food") return { title: "Grove market", detail: (refId ?? "").replace(/^food:/, "").replace(/-/g, " ") };
  if (reason === "refund") return { title: "Refund", detail: refId ?? "Purchase reversed" };
  if (reason.startsWith("ritual:")) return { title: "Ritual reward", detail: reason.split(":")[1] ?? "" };
  if (reason.startsWith("purchase:")) return { title: "Shop purchase", detail: reason.split(":")[1] ?? "" };
  if (reason.startsWith("admin")) return { title: "Gift from PandaCine", detail: "Admin grant" };
  return { title: reason.replace(/_/g, " "), detail: refId ?? "" };
}

export const RARITY_STYLE: Record<PandaShopItem["rarity"], string> = {
  common: "border-border text-candle-muted",
  rare: "border-petal/40 text-petal",
  legendary: "border-amber-400/50 text-amber-300",
};
