import { Link, useLocation } from "@tanstack/react-router";
import { Home, MessageCircle, Film, Gamepad2, User, PawPrint } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

type Item = {
  to: "/app" | "/app/chat" | "/app/movies" | "/app/pet" | "/app/play" | "/app/me";
  label: string;
  Icon: typeof Home;
  exact?: boolean;
  primary?: boolean;
  search?: Record<string, unknown>;
};

const items: Item[] = [
  { to: "/app", label: "Home", Icon: Home, exact: true },
  { to: "/app/chat", label: "Chat", Icon: MessageCircle },
  { to: "/app/movies", label: "Watch", Icon: Film, search: { q: "" } },
  { to: "/app/pet", label: "Panda", Icon: PawPrint, primary: true },
  { to: "/app/play", label: "Play", Icon: Gamepad2 },
  { to: "/app/me", label: "Me", Icon: User },
];

/**
 * The house rail — a quiet glass bar with a single champagne indicator.
 * One accent, no rainbow: the palette stays editorial in both themes.
 */
export function BottomNav() {
  const location = useLocation();
  const unread = useUnreadMessages();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[520px] -translate-x-1/2"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-none absolute inset-x-8 bottom-2 h-10 rounded-full bg-petal/20 blur-2xl" />
      <ul className="relative mx-3 flex items-center justify-between gap-1 rounded-full border border-border/70 bg-surface/80 px-2 py-2 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        {items.map(({ to, label, Icon, exact, search, primary }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <li key={to} className={`relative flex-1 ${primary ? "-translate-y-2.5" : ""}`}>
              <Link
                to={to}
                search={search as never}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="group relative flex flex-col items-center gap-1 rounded-full px-1 py-1.5 transition-transform active:scale-95"
              >
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-full border transition-all duration-300 ${
                    active
                      ? "border-petal/40 bg-[linear-gradient(160deg,var(--petal-soft),transparent_75%)] opacity-100"
                      : "border-transparent opacity-0 group-hover:border-border group-hover:bg-velvet/50 group-hover:opacity-100"
                  }`}
                />

                <span className="relative">
                  <span
                    className={`relative grid size-8 place-items-center rounded-full transition-colors ${
                      primary
                        ? active
                          ? "bg-petal text-velvet shadow-[0_10px_24px_-10px_var(--petal)]"
                          : "border border-petal/35 bg-petal/10 text-petal"
                        : ""
                    }`}
                  >
                    <Icon
                      className={`size-[19px] transition-colors ${
                        primary && active ? "" : active ? "text-petal" : "text-candle-muted group-hover:text-candle"
                      }`}
                    />
                  </span>
                  {to === "/app/chat" && unread > 0 && (
                    <span className="absolute -right-1 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-velvet">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>

                <span
                  className={`relative text-[9px] uppercase tracking-[0.16em] transition-colors ${
                    active ? "text-petal" : "text-candle-muted/70 group-hover:text-candle-muted"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
