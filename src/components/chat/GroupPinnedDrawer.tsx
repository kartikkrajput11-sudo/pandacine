import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pin, X, CornerDownLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { GroupImage } from "./GroupImage";
import type { GroupMessage } from "@/hooks/useGroupChat";

export function GroupPinnedDrawer({
  open,
  onOpenChange,
  groupId,
  memberById,
  onJumpTo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  memberById: Map<string, { display_name: string; avatar_url: string | null }>;
  onJumpTo?: (id: string) => void;
}) {
  const [pins, setPins] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("group_id", groupId)
        .not("pinned_at", "is", null)
        .is("deleted_at", null)
        .order("pinned_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        if (!error) setPins((data ?? []) as GroupMessage[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, groupId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-velvet border-l border-border p-0">
        <SheetHeader className="px-5 pt-6 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base tracking-wide text-candle">
            <Pin className="size-4 text-petal" /> Pinned messages
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto h-[calc(100%-4.5rem)] px-4 py-4">
          {loading && <p className="text-center text-sm text-candle-muted py-8">Loading…</p>}
          {!loading && pins.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <Pin className="size-10 text-candle/20" />
              <p className="text-xs text-candle/55 tracking-wide">No pinned messages yet.</p>
              <p className="text-[10px] text-candle/35 max-w-[220px]">
                Long-press a message and tap Pin to keep it here for everyone.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {pins.map((m) => {
              const sender = memberById.get(m.sender_id);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onJumpTo?.(m.id);
                    onOpenChange(false);
                  }}
                  className="w-full text-left rounded-2xl bg-surface/50 border border-border p-3 hover:border-petal/40 transition group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <UserAvatar src={sender?.avatar_url} name={sender?.display_name} className="size-6" />
                    <span className="text-[11px] text-candle-muted truncate">{sender?.display_name ?? "…"}</span>
                    <span className="ml-auto text-[10px] text-candle/40">
                      {new Date(m.pinned_at!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="text-sm text-candle/90 break-words">
                    {m.type === "image" && m.media_url ? (
                      <GroupImage path={m.media_url} />
                    ) : m.type === "poll" ? (
                      <span className="italic text-candle-muted">📊 Poll</span>
                    ) : m.type === "event" ? (
                      <span className="italic text-candle-muted">📅 Event</span>
                    ) : (
                      m.content
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-petal opacity-0 group-hover:opacity-100 transition-opacity">
                    <CornerDownLeft className="size-3" /> Jump to message
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
