// Cherry Sage — Bev's appointment approval dashboard backend.
// Admin-key gated (same STATUS_ADMIN_KEY as moderate-comments.html). The real
// enforcement lives in the SECURITY DEFINER Postgres functions themselves (admin_list_appointments/
// admin_update_appointment), which check the key again before touching anything -- this function's
// own check is a fast-fail, not the actual security boundary.
import { createClient } from "@supabase/supabase-js";

const CLOVER_API_BASE = "https://api.clover.com";

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const ALLOWED_STATUS = ["approved", "declined", "alternate_offered", "cancelled"];

// Bev's own real login as a second way in, alongside the raw STATUS_ADMIN_KEY (RJ's way in,
// left working unchanged). A valid Supabase session for one of these emails gets the real
// key applied server-side -- the browser never sees it either way.
const OWNER_EMAILS = ["cherry38@cherrysage.com", "admin@cherrysage.com"];

// Resolves the real admin key to use for the RPC calls, from either auth path. Returns null
// if neither checks out.
async function resolveAdminKey(req, suppliedKey, supabase, realKey) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    const email = (data?.user?.email || "").toLowerCase();
    if (!error && OWNER_EMAILS.includes(email)) return realKey;
    return null;
  }
  if (realKey && suppliedKey === realKey) return realKey;
  return null;
}

export default async (req) => {
  const KEY = process.env.STATUS_ADMIN_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "cherry_sage" } });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const key = await resolveAdminKey(req, url.searchParams.get("key"), supabase, KEY);
    if (!key) return json({ error: "unauthorized" }, 401);
    const status = url.searchParams.get("status") || "pending_approval";
    const { data, error } = await supabase.rpc("admin_list_appointments", {
      p_admin_key: key,
      p_status: status === "all" ? null : status,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ appointments: data || [] });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const key = await resolveAdminKey(req, d.key, supabase, KEY);
    if (!key) return json({ error: "unauthorized" }, 401);
    const id = String(d.id || "");
    const status = String(d.status || "");
    if (!id || !ALLOWED_STATUS.includes(status)) return json({ error: "bad request" }, 400);

    const { data, error } = await supabase.rpc("admin_update_appointment", {
      p_admin_key: key,
      p_id: id,
      p_status: status,
      p_alternate_start: d.alternateStart || null,
      p_decision_note: d.note || null,
    });
    if (error) return json({ error: error.message }, 400);
    const details = (data && data[0]) || null;

    var refundResult = null;
    if (status === "declined" && details?.clover_payment_id) {
      refundResult = await refundCloverCharge(details.clover_payment_id, details.amount_cents);
    }

    if (details?.customer_email) {
      await sendStatusEmail(details, status, refundResult);
      if (status === "approved") {
        await tagLastAppointment(details.customer_email, details.requested_start);
      }
    }

    return json({ ok: true, refund: refundResult });
  }

  return json({ error: "method" }, 405);
};

async function refundCloverCharge(chargeId, amountCents) {
  const CLOVER_PRIVATE_TOKEN = process.env.CLOVER_PRIVATE_TOKEN;
  if (!CLOVER_PRIVATE_TOKEN) return { attempted: false, reason: "not configured" };
  try {
    const res = await fetch(`${CLOVER_API_BASE}/v1/refunds`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOVER_PRIVATE_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ charge: chargeId, amount: amountCents, reason: "requested_by_customer" }),
    });
    const raw = await res.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON response, fall through with raw text below */ }
    if (!res.ok || (body.status !== "succeeded" && body.status !== "pending")) {
      return { attempted: true, succeeded: false, error: body?.message || raw?.slice(0, 200) || `refund failed (HTTP ${res.status})` };
    }
    return { attempted: true, succeeded: true, refundId: body.id, status: body.status };
  } catch (e) {
    return { attempted: true, succeeded: false, error: String(e) };
  }
}

// A standard .ics calendar invite so "Add to calendar" is a real attachment, not just a
// promise in the email copy. Built from scratch, no dependency -- it's a plain text format.
function buildICS(details) {
  const start = new Date(details.requested_start);
  const minutes = Number(details.duration_minutes) || 30;
  const end = new Date(start.getTime() + minutes * 60000);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const escIcs = (s) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cherry Sage//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${details.id || Date.now()}@cherrysage.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escIcs((details.product_name || "Reading") + " with Cherry Sage")}`,
    `DESCRIPTION:${escIcs("Your reading with Cherry Sage. Questions? Reply to your confirmation email.")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

async function sendStatusEmail(details, status, refundResult) {
  const when = fmt(details.requested_start);
  const name = esc(details.customer_name || "");
  let subject, body, ics = null;

  if (status === "approved") {
    subject = "Your appointment with Cherry Sage is confirmed";
    body = `<p>Great news, ${name}. Your <strong>${esc(details.product_name)}</strong> reading is confirmed for ${when}.</p>` +
      `<p>Cherry looks forward to speaking with you.</p>` +
      `<p style="font-size:.9em;color:#8a8072">A calendar invite is attached, so it's one tap to add to your phone.</p>`;
    ics = buildICS(details);
  } else if (status === "alternate_offered") {
    const alt = fmt(details.alternate_start);
    subject = "A different time for your Cherry Sage reading";
    body = `<p>Hi ${name}, your requested time (${when}) doesn't quite work, but Cherry can do <strong>${alt}</strong> instead.</p>` +
      `<p>Reply to this email to confirm, or to find another time.</p>`;
  } else if (status === "declined") {
    subject = "Your Cherry Sage appointment request";
    var refundLine = refundResult?.succeeded
      ? "<p>Your payment has been refunded.</p>"
      : "<p>We're processing your refund now, if you don't see it in a few business days please reply to this email.</p>";
    body = `<p>Hi ${name}, unfortunately Cherry isn't able to make ${when} work.</p>` + refundLine +
      `<p>Please feel free to request a different time whenever you're ready.</p>`;
  } else {
    return;
  }

  const KEY = process.env.BREVO_KEY;
  if (!KEY) return;
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Cherry Sage", email: "admin@cherrysage.com" },
        to: [{ email: details.customer_email }],
        subject, htmlContent: brandShell(body),
        ...(ics ? { attachment: [{ content: Buffer.from(ics, "utf-8").toString("base64"), name: "cherry-sage-reading.ics" }] } : {}),
      }),
    });
  } catch { /* non-fatal */ }
}

function brandShell(bodyHtml) {
  return `<div style="background:#FAF6EF;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:520px;margin:0 auto;background:#FFFDF8;border:1px solid #EDE2CF;border-radius:12px;overflow:hidden;">` +
    `<div style="background:linear-gradient(160deg,#6E1A28 0%,#4A0F19 100%);padding:28px 32px;text-align:center;">` +
    `<img src="https://cherrysage.com/assets/logo-horizontal.png" alt="Cherry Sage" width="152" height="40" style="height:40px;width:152px;max-width:220px;border:0;outline:none;text-decoration:none;display:block;margin:0 auto;">` +
    `</div><div style="padding:32px;color:#2b2620;font-size:15px;line-height:1.6;">${bodyHtml}</div>` +
    `<div style="padding:20px 32px;border-top:1px solid #EDE2CF;color:#8a8072;font-size:12px;text-align:center;">` +
    `Cherry Sage &middot; Honest, accurate psychic, tarot, and numerology readings by phone. Trusted since 1999.<br>` +
    `<a href="https://cherrysage.com" style="color:#A0142B;">cherrysage.com</a></div></div></div>`;
}

// Feeds the Thank You automation in Brevo -- it triggers off this date attribute since
// nothing else pushes appointment data there. Best-effort: a failed tag should never block
// the approval itself, which is why this has no return value the caller checks.
async function tagLastAppointment(email, requestedStartIso) {
  const KEY = process.env.BREVO_KEY;
  if (!KEY || !email || !requestedStartIso) return;
  const dateOnly = new Date(requestedStartIso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  try {
    await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: "PUT",
      headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ attributes: { LAST_APPOINTMENT_AT: dateOnly } }),
    });
  } catch { /* non-fatal */ }
}

function fmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  }) + " Eastern";
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
