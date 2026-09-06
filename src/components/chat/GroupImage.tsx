import { useEffect, useState } from "react";
import { signMedia } from "@/lib/chat";

export function GroupImage({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (path.startsWith("http")) {
      setUrl(path);
      return;
    }
    signMedia(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => { alive = false; };
  }, [path]);
  if (!url) return <div className={`w-48 h-32 bg-surface animate-pulse rounded-xl ${className ?? ""}`} />;
  return <img src={url} alt="" className={`max-w-full max-h-80 rounded-xl object-cover ${className ?? ""}`} />;
}
