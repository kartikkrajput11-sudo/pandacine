/** Wardrobe catalogue for the PANDACINE mascot. Client-safe (no secrets). */

export type PetCostumeDef = {
  key: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Requirements — all present conditions must be met (or the costume must be in unlocked_costumes). */
  req: {
    affection?: number;
    streak?: number;
    interactions?: number;
    /** Fed at least once (tracked via unlocked_costumes / unlocked_expressions). */
    note?: string;
  };
  /** Tier drives the card treatment. */
  tier: "starter" | "rare" | "legendary";
};

export const PET_COSTUMES: PetCostumeDef[] = [
  {
    key: "classic",
    name: "Classic coat",
    emoji: "🐼",
    blurb: "Pure giant panda. Always available.",
    req: {},
    tier: "starter",
  },
  {
    key: "chef",
    name: "Grove chef",
    emoji: "👨‍🍳",
    blurb: "Unlocked by serving a steamed rice cake.",
    req: { note: "Feed a steamed rice cake" },
    tier: "starter",
  },
  {
    key: "director",
    name: "Cinema director",
    emoji: "🎬",
    blurb: "Unlocked by sharing cinema popcorn.",
    req: { note: "Feed cinema popcorn" },
    tier: "starter",
  },
  {
    key: "wizard",
    name: "Bamboo wizard",
    emoji: "🪄",
    blurb: "Earned through play — 40 interactions.",
    req: { interactions: 40 },
    tier: "rare",
  },
  {
    key: "king",
    name: "Grove royalty",
    emoji: "👑",
    blurb: "Earned at 60% affection and a 5-day streak.",
    req: { affection: 60, streak: 5 },
    tier: "rare",
  },
  {
    key: "golden",
    name: "Golden panda",
    emoji: "✨",
    blurb: "A gilded coat. Birthday cake or a 7-day streak.",
    req: { streak: 7 },
    tier: "legendary",
  },
  {
    key: "tycoon",
    name: "Golden tycoon",
    emoji: "💼",
    blurb: "Gold pinstripe suit, silk tie and briefcase. The grove's chairman.",
    req: { affection: 85, streak: 7, interactions: 80 },
    tier: "legendary",
  },
];

export const COSTUME_BY_KEY: Record<string, PetCostumeDef> = Object.fromEntries(
  PET_COSTUMES.map((c) => [c.key, c]),
);

export type WardrobePet = {
  affection?: number | null;
  streak?: number | null;
  interactions?: number | null;
  unlocked_costumes?: string[] | null;
};

export function costumeUnlocked(def: PetCostumeDef, pet: WardrobePet | null | undefined): boolean {
  if (def.key === "classic") return true;
  if ((pet?.unlocked_costumes ?? []).includes(def.key)) return true;
  const { affection, streak, interactions } = def.req;
  if (affection === undefined && streak === undefined && interactions === undefined) return false;
  if (affection !== undefined && (pet?.affection ?? 0) < affection) return false;
  if (streak !== undefined && (pet?.streak ?? 0) < streak) return false;
  if (interactions !== undefined && (pet?.interactions ?? 0) < interactions) return false;
  return true;
}

/** 0..1 progress toward unlocking. */
export function costumeProgress(def: PetCostumeDef, pet: WardrobePet | null | undefined): number {
  if (costumeUnlocked(def, pet)) return 1;
  const parts: number[] = [];
  if (def.req.affection) parts.push(Math.min(1, (pet?.affection ?? 0) / def.req.affection));
  if (def.req.streak) parts.push(Math.min(1, (pet?.streak ?? 0) / def.req.streak));
  if (def.req.interactions) parts.push(Math.min(1, (pet?.interactions ?? 0) / def.req.interactions));
  if (!parts.length) return 0;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function costumeRequirementText(def: PetCostumeDef): string {
  if (def.req.note) return def.req.note;
  const bits: string[] = [];
  if (def.req.affection) bits.push(`${def.req.affection}% affection`);
  if (def.req.streak) bits.push(`${def.req.streak}-day streak`);
  if (def.req.interactions) bits.push(`${def.req.interactions} interactions`);
  return bits.length ? bits.join(" · ") : "Always yours";
}
