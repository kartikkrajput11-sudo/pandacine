/** PandaMart — client-safe catalogue helpers, cart maths and receipt types. */

import { PET_FOODS, type PetFood } from "@/lib/pet-foods";
import { PUPPY_FOODS } from "@/lib/puppy-foods";

export type CartLine = {
  kind: "food" | "puppy_food" | "boutique";
  key: string;
  name: string;
  emoji: string;
  price: number;
  qty: number;
};

export type MartDepartment = {
  key: string;
  label: string;
  tagline: string;
  emoji: string;
};

export const MART_DEPARTMENTS: MartDepartment[] = [
  { key: "Bamboo grove", label: "Bamboo grove", tagline: "Fresh cut every morning", emoji: "🎋" },
  { key: "Fresh produce", label: "Fresh produce", tagline: "Crisp, loud, satisfying", emoji: "🥕" },
  { key: "Bakery", label: "Bakery", tagline: "Warm from the oven", emoji: "🥐" },
  { key: "Treats", label: "Treats", tagline: "Cinema-night indulgence", emoji: "🍿" },
  { key: "Puppy meals", label: "Puppy meals", tagline: "Made for little paws", emoji: "🥣" },
  { key: "Puppy treats", label: "Puppy treats", tagline: "For very good dogs", emoji: "🦴" },
  { key: "Boutique", label: "Boutique", tagline: "Outfits, props & effects", emoji: "👑" },
];

export function foodsByAisle(aisle: string): PetFood[] {
  return [...PET_FOODS, ...PUPPY_FOODS].filter((f) => f.aisle === aisle);
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.qty, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

export type MartOrder = {
  id: string;
  receipt_no: string;
  buyer_id: string;
  partner_id: string | null;
  items: CartLine[];
  total: number;
  buyer_share: number;
  partner_share: number;
  split_status: "none" | "pending" | "accepted" | "declined";
  note: string | null;
  created_at: string;
  settled_at: string | null;
};

/** Card number derived from the account id — display only, never a secret. */
export function cardNumber(userId: string | undefined | null): string {
  const hex = (userId ?? "").replace(/[^0-9a-f]/gi, "").padEnd(16, "0");
  const digits = Array.from(hex.slice(0, 16))
    .map((c) => (parseInt(c, 16) % 10).toString())
    .join("");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function cardLast4(userId: string | undefined | null): string {
  return cardNumber(userId).replace(/\s/g, "").slice(-4);
}
