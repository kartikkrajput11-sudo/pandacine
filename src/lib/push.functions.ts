import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key — safe to ship to browsers. Private half lives in VAPID_PRIVATE_JWK. */
export const VAPID_PUBLIC_KEY =
  "BGaLILtZJ4uuiqimD0aShDChpy7iVfTTCsN5uUW-y9FwcI94yNnspuTjMi9CKENz08qc6GJNp71QTqeuqznAPqg";

type Payload = { title: string; body: string; url: string; tag?: string };

async function deliver(userIds: string[], payload: Payload) {
  const jwk = process.env["VAPID_PRIVATE_JWK"];
  if (!jwk || userIds.length === 0) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { buildPushHTTPRequest } = await import("@pushforge/builder");
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        const req = await buildPushHTTPRequest({
          privateJWK: jwk,
          subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message: { payload, adminContact: "mailto:hello@pandacine.com", options: { ttl: 3600, urgency: "high" } },
        });
        const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
        if (res.ok) sent++;
        else if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      } catch (e) {
        console.error("push failed", e);
      }
    }),
  );
  return sent;
}

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(10).max(300),
  auth: z.string().min(4).max(100),
  userAgent: z.string().max(300).optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Endpoint is unique per browser; re-bind it to whoever is signed in now.
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    const { error } = await supabaseAdmin.from("push_subscriptions").insert({
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.userAgent ?? null,
    });
    if (error) throw new Error("Could not save notification settings");
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sent = await deliver([context.userId], {
      title: "PANDACINE 🐼",
      body: "Phone notifications are on. You'll hear from your panda here.",
      url: "/app",
      tag: "test",
    });
    return { sent };
  });

const RECENT_MS = 3 * 60 * 1000;

function preview(type: string, content: string) {
  switch (type) {
    case "image": return "📷 Sent a photo";
    case "video": return "🎬 Sent a video";
    case "video_note": return "⭕ Sent a video note";
    case "voice": case "audio": return "🎙️ Sent a voice message";
    case "music": return "🎵 Shared a song";
    case "sticker": return "Sent a sticker";
    case "gif": return "Sent a GIF";
    default: return content.length > 120 ? content.slice(0, 117) + "…" : content || "New message";
  }
}

/**
 * Notify recipients of something the caller just created. The server re-reads
 * the row and only notifies if the caller is its sender and it is fresh.
 */
export const notifyPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["message", "letter", "call"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = context.userId;
    const { data: prof } = await supabaseAdmin.from("profiles").select("display_name").eq("id", me).maybeSingle();
    const name = prof?.display_name || "Someone";
    const fresh = (iso: string) => Date.now() - new Date(iso).getTime() < RECENT_MS;

    if (data.kind === "message") {
      const { data: m } = await supabaseAdmin
        .from("messages")
        .select("sender_id, receiver_id, group_id, type, content, created_at")
        .eq("id", data.id)
        .maybeSingle();
      if (!m || m.sender_id !== me || !fresh(m.created_at)) return { sent: 0 };
      const body = preview(m.type, m.content);
      if (m.group_id) {
        const [{ data: g }, { data: mem }] = await Promise.all([
          supabaseAdmin.from("chat_groups").select("name").eq("id", m.group_id).maybeSingle(),
          supabaseAdmin.from("chat_group_members").select("user_id").eq("group_id", m.group_id),
        ]);
        const ids = (mem ?? []).map((r) => r.user_id).filter((u) => u !== me);
        return {
          sent: await deliver(ids, {
            title: g?.name ? `${name} · ${g.name}` : name,
            body,
            url: `/app/chat/group/${m.group_id}`,
            tag: `group-${m.group_id}`,
          }),
        };
      }
      if (!m.receiver_id) return { sent: 0 };
      return {
        sent: await deliver([m.receiver_id], { title: name, body, url: `/app/chat/${me}`, tag: `dm-${me}` }),
      };
    }

    if (data.kind === "letter") {
      const { data: l } = await supabaseAdmin
        .from("love_letters")
        .select("sender_id, recipient_id, created_at")
        .eq("id", data.id)
        .maybeSingle();
      if (!l || l.sender_id !== me || !fresh(l.created_at)) return { sent: 0 };
      return {
        sent: await deliver([l.recipient_id], {
          title: "💌 A sealed love letter",
          body: `${name} just sealed a letter for you.`,
          url: "/app/letters",
          tag: `letter-${data.id}`,
        }),
      };
    }

    const { data: c } = await supabaseAdmin
      .from("calls")
      .select("initiator_id, peer_id, group_id, kind, status, started_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!c || c.initiator_id !== me || c.status !== "ringing" || !fresh(c.started_at)) return { sent: 0 };
    let ids: string[] = c.peer_id ? [c.peer_id] : [];
    if (c.group_id) {
      const { data: mem } = await supabaseAdmin.from("chat_group_members").select("user_id").eq("group_id", c.group_id);
      ids = (mem ?? []).map((r) => r.user_id).filter((u) => u !== me);
    }
    return {
      sent: await deliver(ids, {
        title: `${c.kind === "video" ? "📹 Video" : "📞 Voice"} call`,
        body: `${name} is calling you…`,
        url: c.group_id ? `/app/call/group/${c.group_id}?call=${data.id}` : `/app/call/${me}?call=${data.id}`,
        tag: `call-${data.id}`,
      }),
    };
  });
