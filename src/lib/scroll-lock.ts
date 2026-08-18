import { useEffect } from "react";

/**
 * Reference-counted body scroll lock.
 *
 * Every overlay used to do `prev = body.style.overflow; body.style.overflow = "hidden"`
 * and restore `prev` on unmount. When two overlays overlapped (a takeover over a
 * dialog, a lightbox over a sheet…) the second one captured "hidden" as its
 * "previous" value and restored it forever — leaving the whole page unscrollable
 * and feeling frozen. A single counter fixes that for good.
 */

let locks = 0;
let previousOverflow: string | null = null;

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      document.body.style.overflow = previousOverflow ?? "";
      previousOverflow = null;
    }
  };
}

export function activeScrollLocks() {
  return locks;
}

/** Hard reset — used by the overlay hygiene watchdog when nothing is open. */
export function releaseAllScrollLocks() {
  locks = 0;
  previousOverflow = null;
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
}

/** Lock the page scroll while `active` is true. */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
