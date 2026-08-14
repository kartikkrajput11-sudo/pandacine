/**
 * Explicit panda lifecycle states.
 *
 * The rest of PandaCine must never infer "dead panda" from missing data —
 * a brand-new user simply has no panda yet. Every surface reads this state.
 */
export type PandaLifecycle = "NO_PANDA_YET" | "ACTIVE_PANDA" | "DEAD_PANDA";

/** Cost, in Luvies, of bringing a brand-new panda into the world after a loss. */
export const REBIRTH_COST = 150;

type LifecycleSource = {
  unlocked?: boolean | null;
  alive?: boolean | null;
  died_at?: string | null;
} | null | undefined;

/**
 * Derives the lifecycle from explicit backend columns only.
 * - never adopted            → NO_PANDA_YET
 * - adopted and alive        → ACTIVE_PANDA
 * - adopted and alive=false  → DEAD_PANDA
 */
export function pandaLifecycle(pet: LifecycleSource): PandaLifecycle {
  if (!pet || pet.unlocked !== true) return "NO_PANDA_YET";
  if (pet.alive === false) return "DEAD_PANDA";
  return "ACTIVE_PANDA";
}

export const isNoPandaYet = (pet: LifecycleSource) => pandaLifecycle(pet) === "NO_PANDA_YET";
export const isActivePanda = (pet: LifecycleSource) => pandaLifecycle(pet) === "ACTIVE_PANDA";
export const isDeadPanda = (pet: LifecycleSource) => pandaLifecycle(pet) === "DEAD_PANDA";
