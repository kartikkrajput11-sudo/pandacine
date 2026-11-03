import { VAPID_PUBLIC_KEY, notifyPush, removePushSubscription, savePushSubscription } from "@/lib/push.functions";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(): Promise<"granted" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await savePushSubscription({
    data: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, userAgent: navigator.userAgent.slice(0, 300) },
  });
  return "granted";
}

export async function disablePush() {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await removePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

/** Re-sync an already-granted subscription (e.g. after sign-in on this device). */
export async function resyncPush() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const sub = await currentPushSubscription();
  if (sub) {
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await savePushSubscription({ data: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth } }).catch(() => {});
  }
}

/** Fire-and-forget: tell recipients about something we just created. */
export function pingPush(kind: "message" | "letter" | "call", id: string | null | undefined) {
  if (!id) return;
  notifyPush({ data: { kind, id } }).catch(() => {});
}
