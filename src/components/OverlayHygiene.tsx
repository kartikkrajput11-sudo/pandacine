import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { activeScrollLocks, releaseAllScrollLocks } from "@/lib/scroll-lock";

/**
 * OverlayHygiene — the watchdog that keeps the page usable.
 *
 * Radix dialogs/sheets set `pointer-events: none` and `data-scroll-locked` on
 * <body> while they're open and clean it up on close. If such a dialog is
 * unmounted while still open (route change from inside a sheet, a takeover
 * mounting over it, a parent that stops rendering), the cleanup never runs and
 * the whole document stays unclickable and unscrollable — a "frozen" page that
 * only a refresh fixes.
 *
 * This component verifies, after every navigation and every interaction, that
 * body-level locks are only in place when an overlay is actually on screen.
 */
function anyOverlayOpen() {
  if (typeof document === "undefined") return false;
  const open = document.querySelectorAll(
    '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[data-radix-popper-content-wrapper],[data-overlay-open="true"]',
  );
  return open.length > 0;
}

function sweep() {
  if (typeof document === "undefined") return;
  if (anyOverlayOpen()) return;

  const body = document.body;
  if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
  if (body.hasAttribute("data-scroll-locked")) body.removeAttribute("data-scroll-locked");
  if (body.getAttribute("aria-hidden") === "true") body.removeAttribute("aria-hidden");
  if (activeScrollLocks() === 0 && body.style.overflow === "hidden") {
    releaseAllScrollLocks();
  }
}

export default function OverlayHygiene() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // After each navigation, give React a couple of frames to unmount overlays,
  // then make sure nothing invisible is still blocking the page.
  useEffect(() => {
    const t1 = window.setTimeout(sweep, 60);
    const t2 = window.setTimeout(sweep, 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  // Safety net for the "nothing responds to my clicks" case: if a pointer event
  // still reaches the document while the body is locked with no overlay open,
  // unlock immediately.
  useEffect(() => {
    const onPointer = () => {
      if (
        document.body.style.pointerEvents === "none" ||
        (document.body.style.overflow === "hidden" && activeScrollLocks() === 0)
      ) {
        sweep();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onPointer, true);
    const id = window.setInterval(sweep, 3000);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onPointer, true);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
