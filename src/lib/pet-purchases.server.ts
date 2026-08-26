export const PET_COST = 250;

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function uniqueLedgerRef(prefix: string, key?: string): string {
  const safeKey = key ? key.replace(/[^a-z0-9:_-]/gi, "-").slice(0, 48) : "entry";
  return `${prefix}:${safeKey}:${Date.now()}:${crypto.randomUUID()}`;
}

export function receiptNo(): string {
  const n = Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, "0");
  const d = new Date();
  return `PM-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}-${n}`;
}