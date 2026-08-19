import { useEffect, useState } from "react";

/**
 * Full-screen "takeover" registry.
 *
 * Pandacine has several surfaces that replace the whole app (Anniversary
 * Nocturne, Golden Hour, the founders' story, the milestone celebration).
 * When two of them mounted at once, the higher one silently swallowed every
 * click meant for the other and the app looked frozen. Anything full-screen
 * registers here so the lower-priority celebrations simply wait their turn.
 */

let count = 0;
const listeners = new Set<(active: boolean) => void>();

function emit() {
  const active = count > 0;
  listeners.forEach((l) => l(active));
}

export function registerTakeover(): () => void {
  count += 1;
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    count = Math.max(0, count - 1);
    emit();
  };
}

export function takeoverActive() {
  return count > 0;
}

/** True while any full-screen takeover is on screen. */
export function useTakeoverActive() {
  const [active, setActive] = useState(() => count > 0);
  useEffect(() => {
    setActive(count > 0);
    listeners.add(setActive);
    return () => {
      listeners.delete(setActive);
    };
  }, []);
  return active;
}

/** Mark this component as a takeover for as long as `active` is true. */
export function useTakeover(active = true) {
  useEffect(() => {
    if (!active) return;
    return registerTakeover();
  }, [active]);
}
