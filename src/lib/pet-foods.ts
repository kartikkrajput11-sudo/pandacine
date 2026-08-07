/** Supermarket catalogue for the PANDACINE mascot. Client-safe (no secrets). */

export type PetFood = {
  key: string;
  name: string;
  emoji: string;
  /** Coin price per unit. */
  price: number;
  /** Fullness restored (0..100 scale). */
  fullness: number;
  /** Affection gained when fed. */
  affection: number;
  aisle: "Bamboo grove" | "Fresh produce" | "Bakery" | "Treats";
  note: string;
  /** Expression unlocked once this food has been fed at least once. */
  unlocksExpression?: string;
  /** Costume unlocked once this food has been fed at least once. */
  unlocksCostume?: string;
};

export const PET_FOODS: PetFood[] = [
  {
    key: "bamboo-shoot",
    name: "Bamboo shoot",
    emoji: "🎋",
    price: 5,
    fullness: 12,
    affection: 1,
    aisle: "Bamboo grove",
    note: "Everyday staple. Crunchy, endless, beloved.",
  },
  {
    key: "bamboo-bundle",
    name: "Bamboo bundle",
    emoji: "🌿",
    price: 18,
    fullness: 40,
    affection: 3,
    aisle: "Bamboo grove",
    note: "A full armful — a proper panda meal.",
    unlocksExpression: "content",
  },
  {
    key: "young-culm",
    name: "Young culm",
    emoji: "🥬",
    price: 30,
    fullness: 55,
    affection: 5,
    aisle: "Bamboo grove",
    note: "Tender spring growth. Panda-grade luxury.",
    unlocksExpression: "blissful",
  },
  {
    key: "apple",
    name: "Crisp apple",
    emoji: "🍎",
    price: 10,
    fullness: 18,
    affection: 2,
    aisle: "Fresh produce",
    note: "Sweet, juicy, gone in four bites.",
  },
  {
    key: "carrot",
    name: "Carrot",
    emoji: "🥕",
    price: 8,
    fullness: 15,
    affection: 2,
    aisle: "Fresh produce",
    note: "Loud chewing guaranteed.",
    unlocksExpression: "smug",
  },
  {
    key: "honey-bun",
    name: "Honey bun",
    emoji: "🍞",
    price: 25,
    fullness: 35,
    affection: 6,
    aisle: "Bakery",
    note: "Warm, sticky, dangerously addictive.",
    unlocksExpression: "starstruck",
  },
  {
    key: "steamed-cake",
    name: "Steamed rice cake",
    emoji: "🍡",
    price: 35,
    fullness: 45,
    affection: 7,
    aisle: "Bakery",
    note: "Panda keeper favourite. Instant devotion.",
    unlocksCostume: "chef",
  },
  {
    key: "popcorn",
    name: "Cinema popcorn",
    emoji: "🍿",
    price: 20,
    fullness: 20,
    affection: 6,
    aisle: "Treats",
    note: "For movie nights. Expect flying kernels.",
    unlocksCostume: "director",
  },
  {
    key: "cookie",
    name: "Panda cookie",
    emoji: "🍪",
    price: 22,
    fullness: 22,
    affection: 8,
    aisle: "Treats",
    note: "Sugar rush incoming.",
    unlocksExpression: "hyper",
  },
  {
    key: "birthday-cake",
    name: "Birthday cake",
    emoji: "🎂",
    price: 90,
    fullness: 100,
    affection: 20,
    aisle: "Treats",
    note: "A whole cake. Unlocks the golden coat.",
    unlocksCostume: "golden",
  },
];

export const FOOD_BY_KEY: Record<string, PetFood> = Object.fromEntries(PET_FOODS.map((f) => [f.key, f]));

export const PET_AISLES = ["Bamboo grove", "Fresh produce", "Bakery", "Treats"] as const;

/** Hours of neglect before the panda dies for good. */
export const STARVE_HOURS = 48;
/** Fullness is fully drained over this many hours. */
export const DRAIN_HOURS = 24;

export function fullnessNow(base: number, lastFedAt: string | null | undefined): number {
  if (!lastFedAt) return base;
  const hrs = (Date.now() - new Date(lastFedAt).getTime()) / 36e5;
  return Math.max(0, Math.round(base - (hrs / DRAIN_HOURS) * 100));
}

export function hoursSinceFed(lastFedAt: string | null | undefined): number {
  if (!lastFedAt) return 0;
  return (Date.now() - new Date(lastFedAt).getTime()) / 36e5;
}
