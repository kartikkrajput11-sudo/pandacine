import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { currentPushSubscription, disablePush, enablePush, pushSupported, resyncPush } from "@/lib/push-client";
import { sendTestPush } from "@/lib/push.functions";

export function PushToggle() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const test = useServerFn(sendTestPush);

  useEffect(() => {
    setSupported(pushSupported());
    currentPushSubscription().then((s) => {
      const active = !!s && Notification.permission === "granted";
      setOn(active);
      if (active) resyncPush();
    });
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setOn(false);
        toast.success("Phone notifications off");
      } else {
        const r = await enablePush();
        if (r === "granted") {
          setOn(true);
          toast.success("Phone notifications on");
          test().catch(() => {});
        } else if (r === "denied") {
          toast.error("Notifications are blocked. Allow them for this site in your browser settings.");
        } else {
          toast.error("This browser can't receive notifications. On iPhone, add PANDACINE to your Home Screen first.");
        }
      }
    } catch {
      toast.error("Couldn't change notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={busy || !supported}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-petal-soft/10 disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="size-5 animate-spin text-petal" />
        ) : on ? (
          <Bell className="size-5 text-petal" />
        ) : (
          <BellOff className="size-5 text-candle-muted" />
        )}
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Phone notifications</p>
          <p className="text-sm text-candle">
            {!supported
              ? "Not available in this browser"
              : on
                ? "On — messages, letters & calls, even when closed"
                : "Off — get alerts when the app is closed"}
          </p>
        </div>
        <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-petal" : "border border-border bg-velvet"}`} aria-hidden>
          <span className={`absolute top-0.5 size-5 rounded-full bg-candle shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
        </span>
      </button>
      {on && (
        <button
          onClick={() => test().then((r) => toast.success(r.sent ? "Test sent — check your notifications" : "No device received it")).catch(() => toast.error("Test failed"))}
          className="px-4 pb-3 text-xs text-petal underline-offset-4 hover:underline"
        >
          Send a test notification
        </button>
      )}
    </div>
  );
}
