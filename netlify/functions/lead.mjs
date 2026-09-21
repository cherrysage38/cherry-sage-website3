// Cherry Sage — lead capture. Durable by default (Netlify Blobs), forwards to Brevo when keyed.
// Every email opt-in (hero card, deck, Ivy weekly) and the contact form POST here.
import { getStore } from "@netlify/blobs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same look as every other Cherry Sage email: gold bar, full logo on cream, warm footer.
function brandedEmail(inner) {
  return `<div style="background:#FAF6EF;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:520px;margin:0 auto;background:#FFFDF8;border:1px solid #EDE2CF;border-radius:12px;overflow:hidden;">` +
    `<div style="height:5px;background-color:#C0972F;background:linear-gradient(90deg,#C0972F,#D9B25E,#C0972F);font-size:0;line-height:0;">&nbsp;</div>` +
    `<div style="padding:30px 32px 6px;text-align:center;background-color:#FFFDF8;">` +
    `<img src="https://cherrysage.com/assets/logo-email-full.png" alt="Cherry Sage" width="280" height="74" style="width:280px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;display:block;margin:0 auto;">` +
    `</div><div style="padding:32px;color:#2b2620;font-size:15px;line-height:1.6;">${inner}</div>` +
    `<div style="padding:20px 32px;border-top:1px solid #EDE2CF;color:#8a8072;font-size:12px;text-align:center;">` +
    `Cherry Sage &middot; Honest, accurate psychic, tarot, and numerology readings by phone. Trusted since 1999.<br>` +
    `<a href="https://cherrysage.com" style="color:#A0142B;">cherrysage.com</a></div></div></div>`;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let d = {};
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) d = await req.json();
    else { const t = await req.text(); d = Object.fromEntries(new URLSearchParams(t)); }
  } catch { return json({ error: "bad body" }, 400); }

  // invisible captcha: honeypot field (humans never fill it) + too-fast submit = bot
  if (String(d.website || d.hp || "").trim()) return json({ ok: true, bot: 1 });
  if (d.t && Date.now() - Number(d.t) < 1500) return json({ ok: true, bot: 1 });

  const source = String(d.source || "site").slice(0, 60);
  const name = String(d.name || "").slice(0, 120);
  const message = String(d.message || "").slice(0, 2000);

  // Feedback is the one lead source Bev asked to require being signed in for ("users cannot
  // leave feedback unless they are logged into their Account"). Every other source through this
  // same endpoint (newsletter, contact, weekly tips) stays guest-open by design, so this check
  // is scoped to source === "feedback" only. The email is taken from the verified session, never
  // from the request body, so it can't be spoofed to dodge the has-history check downstream.
  let email;
  if (source === "feedback") {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return json({ error: "unauthorized" }, 401);
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "unauthorized" }, 401);
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "cherry_sage" } });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    email = (userData?.user?.email || "").toLowerCase();
    if (userErr || !email || !EMAIL.test(email)) return json({ error: "unauthorized" }, 401);
  } else {
    email = String(d.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) return json({ error: "invalid email" }, 422);
  }

  const record = { email, source, name, message, ts: new Date().toISOString(),
                   ua: req.headers.get("user-agent") || "" };

  // 1) durable store — always works, no external key needed
  let stored = false;
  try {
    const store = getStore("leads");
    await store.setJSON(`${Date.now()}-${email}`, record);
    stored = true;
  } catch (e) { /* blobs unavailable in some local runs; continue */ }

  // 2) forward to Brevo when a live key is configured
  let brevo = "skipped";
  const KEY = process.env.BREVO_KEY;
  const LIST = process.env.BREVO_LIST_ID;
  // SOURCE is a single mutable attribute -- a contact's later activity (checkout, contact form)
  // overwrites it, so it can't reliably identify "who opted into weekly tips" over time. List
  // membership is additive and stable, so weekly-tips opt-ins ALSO join a dedicated list (14,
  // "Weekly Tips Subscribers") regardless of whatever they do afterward.
  const WEEKLY_TIPS_SOURCES = ["weekly-tips-hero", "weekly-tips-draw", "popup-shuffle", "chat-weekly"];
  const WEEKLY_TIPS_LIST_ID = 14;
  if (KEY) {
    try {
      const listIds = LIST ? [Number(LIST)] : [];
      if (WEEKLY_TIPS_SOURCES.includes(source)) listIds.push(WEEKLY_TIPS_LIST_ID);
      const body = { email, updateEnabled: true,
        attributes: { SOURCE: source, ...(name ? { FIRSTNAME: name } : {}), ...(message ? { MESSAGE: message } : {}) },
        ...(listIds.length ? { listIds } : {}) };
      const r = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      brevo = r.ok ? "ok" : `error ${r.status}`;
    } catch { brevo = "network"; }
  }

  // 3) notify Bev by email for the submissions she'd want to see right away
  // (contact, feedback, appointment requests, numerology report requests — NOT newsletter/opt-in captures)
  let notified = "skipped";
  const NOTIFY_TO = process.env.NOTIFY_EMAIL;
  const wantsNotify = source === "contact" || source === "feedback" || source === "appointment" || source.startsWith("report:");
  if (KEY && NOTIFY_TO && wantsNotify) {
    try {
      const label = source.startsWith("report:") ? `Report request — ${source.slice(7)}`
        : source === "feedback" ? "New feedback"
        : source === "appointment" ? "New appointment request"
        : "New contact form message";
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "Cherry Sage Website", email: "admin@cherrysage.com" },
          to: [{ email: NOTIFY_TO }],
          replyTo: { email },
          subject: `${label} — from ${name || email}`,
          htmlContent: brandedEmail(
            `<p style="margin:0 0 12px"><strong>${label}</strong></p>` +
            `<p style="margin:0 0 12px">From: ${name ? `${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;` : escapeHtml(email)}</p>` +
            (message ? `<div style="margin:0 0 14px;padding:14px 16px;background:#FAF6EF;border-radius:8px">${escapeHtml(message).replace(/\n/g, "<br>")}</div>` : "") +
            `<p style="margin:0;color:#8a8072;font-size:13px">Reply to this email to write back directly to ${escapeHtml(email)}.</p>`),
        }),
      });
      notified = r.ok ? "ok" : `error ${r.status}`;
    } catch { notified = "network"; }
  }

  // 4) confirmation to the person who wrote to Cherry (contact form only). One per address per day, so the
  // form can never be used to flood someone else's inbox with our email.
  let confirmation = "skipped";
  if (KEY && source === "contact" && message.trim().length >= 3) {
    try {
      let recentlySent = false;
      try {
        const marks = getStore("contact-confirmations");
        const key = "c-" + email.replace(/[^a-z0-9]/g, "_");
        const prev = await marks.get(key, { type: "json" });
        if (prev && Date.now() - Number(prev.t || 0) < 24 * 3600 * 1000) recentlySent = true;
        else await marks.setJSON(key, { t: Date.now() });
      } catch { /* blobs unavailable: fall through and send */ }
      if (!recentlySent) {
        const first = escapeHtml((name || "").trim().split(/\s+/)[0] || "there");
        const r2 = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { name: "Cherry Sage", email: "admin@cherrysage.com" },
            to: [{ email }],
            replyTo: { email: "admin@cherrysage.com", name: "Cherry Sage" },
            subject: "We received your message",
            htmlContent: brandedEmail(
              `<p>Hi ${first},</p>` +
              `<p>Thank you for writing to Cherry Sage. Your message has reached Cherry, and she will reply to you herself by email.</p>` +
              `<p style="margin:16px 0 6px;color:#8a8072;font-size:13px">What you sent:</p>` +
              `<div style="margin:0 0 16px;padding:14px 16px;background:#FAF6EF;border-radius:8px">${escapeHtml(message).replace(/\n/g, "<br>")}</div>` +
              `<p>If you would rather talk it through by phone, you can <a href="https://cherrysage.com/book-appointment" style="color:#A0142B;">request a time with Cherry</a>.</p>` +
              `<p style="margin:24px 0 0">Warmly,<br>Cherry Sage</p>`),
          }),
        });
        confirmation = r2.ok ? "ok" : `error ${r2.status}`;
      } else confirmation = "already-sent-today";
    } catch { confirmation = "network"; }
  }

  return json({ ok: true, stored, brevo, notified, confirmation });
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
