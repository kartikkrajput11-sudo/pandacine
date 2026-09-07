import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2 } from "lucide-react";

export function AnnouncementComposer({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onSend(t);
      setText("");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-velvet border-t border-border rounded-t-2xl pb-8">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base tracking-wide text-candle">
            <Megaphone className="size-4 text-petal" /> Admin announcement
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share an important update with the group…"
            className="min-h-[120px] bg-surface border-border text-candle placeholder:text-candle/30 resize-none"
          />
          <SheetFooter>
            <Button
              type="submit"
              disabled={!text.trim() || busy}
              className="w-full bg-petal hover:bg-petal/90 text-velvet"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
              <span className="ml-1.5">Announce to group</span>
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
