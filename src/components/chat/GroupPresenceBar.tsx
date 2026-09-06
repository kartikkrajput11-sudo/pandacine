import { useMemo } from "react";
import { UserAvatar } from "@/components/UserAvatar";

export function GroupPresenceBar({
  onlineIds,
  typingIds,
  memberById,
  meId,
}: {
  onlineIds: string[];
  typingIds: string[];
  memberById: Map<string, { display_name: string; avatar_url: string | null }>;
  meId: string | null;
}) {
  const othersOnline = useMemo(
    () => onlineIds.filter((id) => id !== meId),
    [onlineIds, meId],
  );
  const othersTyping = useMemo(
    () => typingIds.filter((id) => id !== meId),
    [typingIds, meId],
  );

  const typingNames = useMemo(
    () =>
      othersTyping
        .slice(0, 3)
        .map((id) => memberById.get(id)?.display_name ?? "…")
        .filter(Boolean),
    [othersTyping, memberById],
  );

  if (othersOnline.length === 0 && typingNames.length === 0) return null;

  return (
    <div className="px-4 py-1.5 flex items-center gap-3 text-[11px] text-candle-muted/80">
      {othersOnline.length > 0 && (
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex -space-x-1.5">
            {othersOnline.slice(0, 4).map((id) => (
              <UserAvatar
                key={id}
                src={memberById.get(id)?.avatar_url}
                name={memberById.get(id)?.display_name}
                className="size-4 ring-1 ring-velvet"
                userId={id}
              />
            ))}
          </div>
          <span className="truncate">
            {othersOnline.length === 1
              ? `${memberById.get(othersOnline[0])?.display_name ?? "…"} online`
              : `${othersOnline.length} online`}
          </span>
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/70" />
        </div>
      )}

      {typingNames.length > 0 && (
        <div className="flex items-center gap-1.5 ml-auto truncate animate-pulse">
          <span className="truncate italic">
            {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing
          </span>
          <span className="flex gap-0.5">
            <span className="size-1 rounded-full bg-petal animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="size-1 rounded-full bg-petal animate-bounce" style={{ animationDelay: "120ms" }} />
            <span className="size-1 rounded-full bg-petal animate-bounce" style={{ animationDelay: "240ms" }} />
          </span>
        </div>
      )}
    </div>
  );
}
