import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Search, CornerDownLeft } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import type { GroupMessage } from "@/hooks/useGroupChat";

export function GroupSearchSheet({
  open,
  onOpenChange,
  messages,
  memberById,
  meId,
  onJumpTo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  messages: GroupMessage[];
  memberById: Map<string, { display_name: string; avatar_url: string | null }>;
  meId: string | null;
  onJumpTo?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const term = q.toLowerCase();
    return messages
      .filter((m) => {
        if (m.deleted_at) return false;
        const sender = memberById.get(m.sender_id)?.display_name?.toLowerCase() || "";
        const content = (m.content || "").toLowerCase();
        return sender.includes(term) || content.includes(term);
      })
      .slice(-30)
      .reverse();
  }, [messages, q, memberById]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-velvet border-l border-border p-0 flex flex-col">
        <SheetHeader className="px-5 pt-6 pb-3 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base tracking-wide text-candle">
            <Search className="size-4 text-petal" /> Search messages
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 py-3 shrink-0">
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to search…"
            className="bg-velvet border-border text-candle placeholder:text-candle/30"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {q.trim() && results.length === 0 && (
            <p className="text-center text-sm text-candle/40 py-12">No messages found.</p>
          )}
          <div className="space-y-2">
            {results.map((m) => {
              const sender = memberById.get(m.sender_id);
              const mine = m.sender_id === meId;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onJumpTo?.(m.id);
                    onOpenChange(false);
                  }}
                  className="w-full text-left rounded-2xl bg-surface/60 border border-border p-3 hover:border-petal/40 transition group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <UserAvatar src={sender?.avatar_url} name={sender?.display_name} className="size-6" userId={m.sender_id} />
                    <span className={`text-[11px] ${mine ? "text-petal" : "text-candle-muted"}`}>
                      {sender?.display_name ?? "…"}
                    </span>
                    <span className="text-[10px] text-candle/40 ml-auto">
                      {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-candle/90 line-clamp-2 break-words">
                    {m.type === "image" ? "📷 Photo" : m.type === "poll" ? "📊 Poll" : m.content}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-petal opacity-0 group-hover:opacity-100 transition-opacity">
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
