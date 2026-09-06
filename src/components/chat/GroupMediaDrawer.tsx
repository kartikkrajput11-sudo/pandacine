import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Images, Video, FileText, Mic, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signMedia } from "@/lib/chat";
import { SignedImage } from "./SignedImage";
import type { GroupMessage } from "@/hooks/useGroupChat";

type Tab = "all" | "photos" | "videos" | "files" | "voice";

const PAGE_SIZE = 200;
const MAX_PAGES = 100;

function mediaCategory(m: GroupMessage): Tab | null {
  if (m.type === "image") return "photos";
  if (m.type === "video") return "videos";
  if (m.type === "voice" || m.type === "audio") return "voice";
  if (m.type === "file" || m.media_url) return "files";
  if (m.media_url) {
    const ext = (m.content || "").split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "photos";
    if (["mp4", "mov", "webm"].includes(ext)) return "videos";
    return "files";
  }
  return null;
}

function VideoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signMedia(path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);
  if (!url) return <div className="w-full h-full bg-surface animate-pulse" />;
  return (
    <div className="w-full h-full relative bg-black">
      <video src={url} preload="metadata" className="w-full h-full object-cover opacity-80" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Video className="size-6 text-white/90 drop-shadow" />
      </div>
    </div>
  );
}

export function GroupMediaDrawer({
  open,
  onOpenChange,
  groupId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);
  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "all", label: "All", icon: Images },
    { key: "photos", label: "Photos", icon: Images },
    { key: "videos", label: "Videos", icon: Video },
    { key: "files", label: "Files", icon: FileText },
    { key: "voice", label: "Voice", icon: Mic },
  ];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setDone(false);
    cursorRef.current = undefined;

    async function load() {
      for (let page = 0; page < MAX_PAGES; page++) {
        if (cancelled) return;
        const { data, error } = await supabase.rpc("chat_group_messages", {
          _group_id: groupId,
          _before: cursorRef.current,
          _limit: PAGE_SIZE,
        });
        if (cancelled) return;
        if (error) break;
        const rows = (data ?? []) as unknown as GroupMessage[];
        if (rows.length === 0) {
          setDone(true);
          break;
        }
        const media = rows.filter((m) => mediaCategory(m) !== null);
        setItems((prev) => [...prev, ...media]);
        cursorRef.current = rows[rows.length - 1].created_at;
        if (rows.length < PAGE_SIZE) {
          setDone(true);
          break;
        }
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [open, groupId]);

  const filtered = useMemo(
    () => (tab === "all" ? items : items.filter((m) => mediaCategory(m) === tab)),
    [items, tab],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, GroupMessage[]>();
    for (const m of filtered) {
      const date = new Date(m.created_at).toDateString();
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => +new Date(b[0]) - +new Date(a[0]));
  }, [filtered]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-velvet border-l border-border p-0 flex flex-col">
        <SheetHeader className="px-5 pt-6 pb-3 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base tracking-wide text-candle">
            <Images className="size-4 text-petal" /> Shared media
          </SheetTitle>
        </SheetHeader>

        <div className="shrink-0 flex gap-1 px-4 py-3 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition ${
                  tab === t.key
                    ? "bg-petal/15 border-petal/40 text-petal"
                    : "bg-surface border-border text-candle-muted hover:text-candle"
                }`}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {loading && items.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-20 text-candle-muted text-sm">
              <Loader2 className="size-4 animate-spin" /> Gathering full history…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Images className="size-10 text-candle/20" />
              <p className="text-xs text-candle/55 tracking-wide">No {tab === "all" ? "media" : tab} shared yet.</p>
            </div>
          )}

          <div className="space-y-5">
            {grouped.map(([date, rows]) => (
              <div key={date}>
                <p className="sticky top-0 z-10 text-[10px] uppercase tracking-wider text-candle/40 mb-2 bg-velvet/80 backdrop-blur py-1">
                  {new Date(date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {rows.map((m) => {
                    const cat = mediaCategory(m);
                    if (cat === "photos" && m.media_url) {
                      return (
                        <div key={m.id} className="aspect-square rounded-xl overflow-hidden bg-surface border border-border">
                          <SignedImage path={m.media_url} className="w-full h-full object-cover" />
                        </div>
                      );
                    }
                    if (cat === "videos" && m.media_url) {
                      return (
                        <div key={m.id} className="aspect-square rounded-xl overflow-hidden bg-black border border-border">
                          <VideoThumb path={m.media_url} />
                        </div>
                      );
                    }
                    if (cat === "voice" || cat === "audio") {
                      return (
                        <div key={m.id} className="col-span-1 aspect-square rounded-xl bg-surface border border-border flex flex-col items-center justify-center gap-1 p-2">
                          <Mic className="size-6 text-petal" />
                          <span className="text-[9px] text-candle/50 text-center line-clamp-2">Voice note</span>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className="aspect-square rounded-xl bg-surface border border-border flex flex-col items-center justify-center gap-1 p-2">
                        <FileText className="size-6 text-candle/60" />
                        <span className="text-[9px] text-candle/50 text-center line-clamp-2">File</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {!done && items.length > 0 && (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-candle/30" />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
