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

// 2026-09-19: no shared key. The site's source is public, so the old hardcoded admin key was
// readable by anyone. The caller's own login token is forwarded to Supabase and the database
// functions check cherry_sage.is_owner() (owner_emails table) before touching anything.
const notOwner = (e) => /unauthorized/i.test(e?.message || "");
const badToken = (e) => /jwt|token/i.test(e?.message || "");

export default async (req) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "login required" }, 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "cherry_sage" }, global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending_approval";
    const { data, error } = await supabase.rpc("admin_list_appointments", {
      p_admin_key: "",
      p_status: status === "all" ? null : status,
    });
    if (error) return json({ error: badToken(error) ? "login required" : notOwner(error) ? "not the owner login" : error.message }, badToken(error) ? 401 : notOwner(error) ? 403 : 400);
    // The database returns full_name/email/phone but the appointments page reads
    // customer_name/customer_email/customer_phone, so every request showed "Unknown" (found
    // 2026-09-18, Bev). Provide both spellings.
    const appointments = (data || []).map((a) => ({
      ...a, customer_name: a.full_name, customer_email: a.email, customer_phone: a.phone,
    }));
    return json({ appointments });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const id = String(d.id || "");
    const status = String(d.status || "");
    if (!id || !ALLOWED_STATUS.includes(status)) return json({ error: "bad request" }, 400);

    const { data, error } = await supabase.rpc("admin_update_appointment", {
      p_admin_key: "",
      p_id: id,
      p_status: status,
      p_alternate_start: d.alternateStart || null,
      p_decision_note: d.note || null,
    });
    if (error) return json({ error: badToken(error) ? "login required" : notOwner(error) ? "not the owner login" : error.message }, badToken(error) ? 401 : notOwner(error) ? 403 : 400);
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
    `<div style="height:5px;background-color:#C0972F;background:linear-gradient(90deg,#C0972F,#D9B25E,#C0972F);font-size:0;line-height:0;">&nbsp;</div>` +
    `<div style="padding:30px 32px 6px;text-align:center;background-color:#FFFDF8;">` +
    `<img src="https://cherrysage.com/assets/logo-email-full.png" alt="Cherry Sage" width="280" height="74" style="width:280px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;display:block;margin:0 auto;">` +
    `</div><div style="padding:32px;color:#2b2620;font-size:15px;line-height:1.6;">${bodyHtml}</div>` +
    `<div style="padding:20px 32px;border-top:1px solid #EDE2CF;color:#8a8072;font-size:12px;text-align:center;">` +
    `Cherry Sage &middot; Honest, accurate psychic, tarot, and numerology readings by phone. Trusted since 1999.<br>` +
    `<a href="https://www.facebook.com/PsychicReadingByCherrySage/" style="color:#A0142B;text-decoration:none;">Facebook</a> &middot; <a href="https://www.instagram.com/psychiccherrysage/" style="color:#A0142B;text-decoration:none;">Instagram</a> &middot; <a href="https://x.com/cherrysage" style="color:#A0142B;text-decoration:none;">X</a><br>` +
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
