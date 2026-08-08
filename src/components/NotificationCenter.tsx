import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Check, Trash2, X, MessageCircle, Users, Megaphone, Phone, Sparkles, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  NotifItem,
  clearAll,
  markAllRead,
  markRead,
  removeNotification,
  setNotifUser,
  subscribeNotifications,
} from "@/lib/notifications";
import { AvatarImg } from "@/components/AvatarImg";
import { cn } from "@/lib/utils";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function kindIcon(kind: NotifItem["kind"]) {
  const cls = "h-3.5 w-3.5";
  switch (kind) {
    case "dm":        return <MessageCircle className={cls} />;
    case "group":     return <Users className={cls} />;
    case "broadcast": return <Megaphone className={cls} />;
    case "call":      return <Phone className={cls} />;
    default:          return <Sparkles className={cls} />;
  }
}

const KIND_LABEL: Record<NotifItem["kind"], string> = {
  dm: "Message",
  group: "Group",
  broadcast: "Announcement",
  call: "Call",
  system: "Pandacine",
};

export default function NotificationCenter() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setNotifUser(data.user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setNotifUser(session?.user?.id ?? null);
    });

    const unsub = subscribeNotifications((list) => setItems(list));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      unsub();
    };
  }, []);

  // Escape closes the drawer; body scroll locks while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const unread = useMemo(() => items.filter((x) => !x.read).length, [items]);
  const visible = useMemo(() => (filter === "unread" ? items.filter((x) => !x.read) : items), [items, filter]);

  const groups = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = visible.filter((n) => n.createdAt >= startOfToday.getTime());
    const earlier = visible.filter((n) => n.createdAt < startOfToday.getTime());
    return [
      ["Today", today],
      ["Earlier", earlier],
    ] as const;
  }, [visible]);

  // Only render on the homepage (/app). Placed inline in the home header.
  if (pathname !== "/app") return null;

  const openItem = (n: NotifItem) => {
    markRead(n.id);
    if (n.href) navigate({ to: n.href as any });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative z-[95]">
      <button
        onClick={() => setOpen(true)}
        aria-label="Notifications"
        title={unread > 0 ? `${unread} new` : "Notifications"}
        className="group relative flex h-6 w-6 items-center justify-center rounded-full border border-petal/40 bg-[var(--surface-elevated)]/85 shadow-[0_4px_14px_-6px_rgba(230,180,120,0.5)] backdrop-blur-md transition hover:border-petal/70"
      >
        <Bell className="h-3 w-3 text-candle" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.85)] ring-2 ring-[var(--surface-elevated)] animate-pulse" />
        )}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[300]">
                <motion.button
                  aria-label="Close notifications"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                  className="absolute inset-0 bg-[rgba(6,4,10,0.62)] backdrop-blur-[6px]"
                />

                <motion.aside
                  initial={{ x: "100%", opacity: 0.4 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "100%", opacity: 0.2 }}
                  transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  className="absolute inset-y-0 right-0 flex w-[min(26rem,100vw)] flex-col border-l border-petal/25 bg-[var(--surface-elevated)]/95 shadow-[-40px_0_90px_-40px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:inset-y-3 sm:right-3 sm:rounded-[1.75rem] sm:border"
                >
                  {/* gilded top edge */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petal/70 to-transparent"
                  />

                  <header className="flex items-start justify-between gap-3 px-5 pt-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-petal">The Salon</p>
                      <h2 className="font-serif text-2xl italic leading-tight text-candle">Notifications</h2>
                      <p className="mt-0.5 text-xs text-candle-muted">
                        {unread > 0 ? `${unread} waiting for you` : "Nothing unread"}
                      </p>
                    </div>
                    <button
                      onClick={() => setOpen(false)}
                      title="Close"
                      className="grid size-9 place-items-center rounded-full border border-border text-candle-muted transition hover:border-petal/50 hover:text-candle"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </header>

                  <div className="flex items-center gap-2 px-5 pb-3 pt-4">
                    {(["all", "unread"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest transition",
                          filter === f
                            ? "border-petal/60 bg-petal/10 text-petal"
                            : "border-border text-candle-muted hover:text-candle",
                        )}
                      >
                        {f === "all" ? `All ${items.length ? `· ${items.length}` : ""}` : `Unread ${unread ? `· ${unread}` : ""}`}
                      </button>
                    ))}
                    <span className="flex-1" />
                    {items.length > 0 && (
                      <>
                        <button
                          onClick={markAllRead}
                          title="Mark all read"
                          className="rounded-full border border-border p-1.5 text-candle-muted transition hover:border-petal/50 hover:text-candle"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={clearAll}
                          title="Clear all"
                          className="rounded-full border border-border p-1.5 text-candle-muted transition hover:border-petal/50 hover:text-candle"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 pb-6">
                    {visible.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                        <div className="grid h-16 w-16 place-items-center rounded-full border border-petal/30 bg-gradient-to-br from-petal/12 to-transparent">
                          <Inbox className="h-7 w-7 text-petal" />
                        </div>
                        <p className="font-serif text-lg italic text-candle">All quiet</p>
                        <p className="text-xs text-candle-muted">
                          Messages, calls and announcements will gather here.
                        </p>
                      </div>
                    ) : (
                      groups.map(([label, list]) =>
                        list.length === 0 ? null : (
                          <section key={label} className="mb-4">
                            <p className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.24em] text-candle-muted">
                              {label}
                            </p>
                            <ul className="space-y-2">
                              {list.map((n) => (
                                <li key={n.id} className="group relative">
                                  <button
                                    onClick={() => openItem(n)}
                                    className={cn(
                                      "flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
                                      n.read
                                        ? "border-border/70 bg-surface/50 hover:border-petal/40"
                                        : "border-petal/35 bg-[linear-gradient(120deg,rgba(230,180,120,0.12),transparent_60%)] hover:border-petal/60",
                                    )}
                                  >
                                    <div className="relative shrink-0">
                                      {n.icon && (n.icon.startsWith("http") || /\.(png|jpe?g|webp|gif|avif)$/i.test(n.icon)) ? (
                                        <AvatarImg
                                          src={n.icon}
                                          className="h-11 w-11 rounded-2xl border border-petal/40 object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-petal/40 bg-gradient-to-br from-petal/20 to-petal/5 text-lg">
                                          {n.icon || "✨"}
                                        </div>
                                      )}
                                      {!n.read && (
                                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-petal shadow-[0_0_8px_var(--petal)] ring-2 ring-[var(--surface-elevated)]" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-petal">
                                        {kindIcon(n.kind)}
                                        <span>{KIND_LABEL[n.kind]}</span>
                                        <span className="normal-case tracking-normal text-candle-muted/70">
                                          · {timeAgo(n.createdAt)}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 truncate text-sm font-medium text-candle">{n.title}</div>
                                      <div className="line-clamp-2 text-xs text-candle-muted">{n.body}</div>
                                    </div>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeNotification(n.id);
                                    }}
                                    title="Dismiss"
                                    className="absolute right-2 top-2 rounded-full p-1 text-candle-muted opacity-0 transition group-hover:opacity-100 hover:bg-petal/10 hover:text-candle"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ),
                      )
                    )}
                  </div>

                  {items.length > 0 && (
                    <footer className="border-t border-petal/15 px-5 py-2.5 text-center text-[10px] uppercase tracking-widest text-candle-muted">
                      {items.length} kept · latest 60
                    </footer>
                  )}
                </motion.aside>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
