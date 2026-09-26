import { fullnessNow, hoursSinceFed, STARVE_HOURS } from "@/lib/pet-foods";

export { fullnessNow, hoursSinceFed, STARVE_HOURS };

export type PuppyFood = { key: string; name: string; emoji: string; price: number; fullness: number; affection: number; aisle: "Puppy meals" | "Puppy treats"; note: string };

export const PUPPY_FOODS: PuppyFood[] = [
  { key: "puppy-kibble", name: "Puppy kibble", emoji: "🥣", price: 8, fullness: 22, affection: 2, aisle: "Puppy meals", note: "A hearty everyday bowl" },
  { key: "chicken-dinner", name: "Chicken dinner", emoji: "🍗", price: 24, fullness: 48, affection: 5, aisle: "Puppy meals", note: "Boneless, cooked and puppy-safe" },
  { key: "salmon-bowl", name: "Salmon bowl", emoji: "🐟", price: 32, fullness: 60, affection: 7, aisle: "Puppy meals", note: "A special nourishing meal" },
  { key: "carrot-crunch", name: "Carrot crunch", emoji: "🥕", price: 9, fullness: 15, affection: 3, aisle: "Puppy treats", note: "A crunchy little reward" },
  { key: "apple-slices", name: "Apple slices", emoji: "🍎", price: 11, fullness: 18, affection: 4, aisle: "Puppy treats", note: "Seedless slices for a sweet treat" },
  { key: "dog-biscuit", name: "Dog biscuit", emoji: "🦴", price: 18, fullness: 24, affection: 8, aisle: "Puppy treats", note: "The good-dog reward" },
  { key: "pumpkin-bites", name: "Pumpkin bites", emoji: "🎃", price: 20, fullness: 30, affection: 7, aisle: "Puppy treats", note: "Soft and gentle on little tummies" },
];
export const PUPPY_FOOD_BY_KEY: Record<string, PuppyFood> = Object.fromEntries(PUPPY_FOODS.map((f) => [f.key, f]));