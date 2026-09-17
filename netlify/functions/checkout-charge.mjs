// Cherry Sage — submits the actual Clover charge and, only on confirmed success, converts
// the slot hold into a real paid order + pending_approval appointment.
//
// Security posture, matched to the DB-level fix in confirm_paid_booking:
// - The amount charged is ALWAYS derived server-side from reading_products (and, if a coupon
//   is present, cherry_sage.price_with_coupon), never from anything the client sends. A
//   compromised/malicious client can misrepresent nothing that actually costs Cherry money.
// - A coupon's one-time-use-per-customer check (matching on email, phone, OR name -- so
//   switching your email doesn't get you a second first-timer discount) is re-run again inside
//   confirm_paid_booking right before the order is written, not trusted from this earlier call.
// - confirm_paid_booking is only ever called AFTER Clover itself confirms status:"succeeded"
//   and paid:true on a real charge response -- the DB function no longer trusts a caller's
//   claimed payment id, but this is the actual point where the real verification happens.
import { createClient } from "@supabase/supabase-js";
import { getStore } from "@netlify/blobs";

const CLOVER_API_BASE = "https://api.clover.com";
const SERVER_KEY = "CherrySage-hours-2026"; // matches confirm_paid_booking's hardcoded gate

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Card-testing defense (real incident, 2026-09-11: Bev's WooCommerce shop took 1000+ fraudulent
// charge attempts from bots running stolen cards). This endpoint is the one place a real card
// gets charged, so it is the one place that attack lands here too. Two independent limits, both
// scoped per IP via a Blobs counter (no external service needed):
//   - a flat attempt cap, so a script can't hammer this endpoint at all;
//   - a tighter DECLINE cap, since "many different cards, mostly declined" is the actual
//     signature of card testing, not just high volume from one real customer.
// Never blocks on Blobs being unavailable -- a monitoring failure must not take checkout down.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 8;
const MAX_DECLINES_PER_WINDOW = 5; // was 3 -- too tight, locked out a real customer over a few mistyped-card declines, 2026-09-16
const BLOCK_MS = 10 * 60 * 1000; // was 30 min -- same incident

async function checkAndRecordAttempt(ip) {
  try {
    const store = getStore("checkout-abuse");
    const key = `ip:${ip}`;
    const now = Date.now();
    const rec = (await store.get(key, { type: "json" })) || { attempts: [], declines: [], blockedUntil: 0 };
    if (rec.blockedUntil && rec.blockedUntil > now) return { blocked: true, reason: "cooling down after repeated declines" };
    rec.attempts = rec.attempts.filter((t) => now - t < RATE_WINDOW_MS);
    rec.declines = rec.declines.filter((t) => now - t < RATE_WINDOW_MS);
    if (rec.attempts.length >= MAX_ATTEMPTS_PER_WINDOW) {
      rec.blockedUntil = now + BLOCK_MS;
      await store.setJSON(key, rec);
      return { blocked: true, reason: "too many attempts" };
    }
    rec.attempts.push(now);
    await store.setJSON(key, rec);
    return { blocked: false, record: rec, store, key };
  } catch { return { blocked: false }; } // Blobs hiccup -- fail open, never block real checkouts on it
}

async function recordDecline(store, key, rec) {
  if (!store || !rec) return;
  try {
    const now = Date.now();
    rec.declines.push(now);
    if (rec.declines.length >= MAX_DECLINES_PER_WINDOW) rec.blockedUntil = now + BLOCK_MS;
    await store.setJSON(key, rec);
  } catch { /* non-fatal */ }
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const CLOVER_PRIVATE_TOKEN = process.env.CLOVER_PRIVATE_TOKEN;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !CLOVER_PRIVATE_TOKEN) {
    return json({ error: "not configured" }, 503);
  }

  const clientIp = req.headers.get("x-nf-client-connection-ip") || "unknown";
  const abuse = await checkAndRecordAttempt(clientIp);
  if (abuse.blocked) {
    return json({ error: "Too many attempts from this connection. Please try again later or contact Cherry Sage directly." }, 429);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "cherry_sage" } });

  let d = {};
  try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }

  const holdId = String(d.holdId || "");
  const customerId = String(d.customerId || "");
  const readingProductId = String(d.readingProductId || "");
  const cardToken = String(d.cardToken || "");
  const couponCode = d.couponCode ? String(d.couponCode).trim() : null;

  if (!holdId || !customerId || !readingProductId) return json({ error: "missing booking details" }, 422);
  if (!cardToken.startsWith("clv_")) return json({ error: "invalid card token" }, 422);

  const { data: product, error: productErr } = await supabase
    .from("reading_products")
    .select("id, name, price_cents, active, requires_scheduling, duration_minutes")
    .eq("id", readingProductId)
    .maybeSingle();
  if (productErr || !product || !product.active || !product.requires_scheduling) {
    return json({ error: "reading product not available" }, 422);
  }

  // Derive the real, final price ourselves -- never trust a client-supplied amount or a
  // client-supplied claim that a coupon is valid. price_with_coupon looks the customer up
  // itself (it's SECURITY DEFINER) rather than us reading `customers` directly here, since
  // that table has no anon SELECT policy -- reading it with the anon key would silently
  // return nothing rather than a real error.
  const { data: priced, error: pricedErr } = await supabase.rpc("price_with_coupon", {
    p_reading_product_id: readingProductId,
    p_coupon_code: couponCode,
    p_customer_id: customerId,
  });
  const priceRow = Array.isArray(priced) ? priced[0] : priced;
  if (pricedErr || !priceRow || priceRow.error) {
    return json({ error: priceRow?.error || "could not price this reading" }, 422);
  }
  const finalPriceCents = priceRow.final_price_cents;

  // Confirm the hold is still ours and hasn't expired before we ever touch a real card.
  // slot_holds has RLS with zero policies (nobody should be able to read every hold in the
  // table via the anon key) -- check_hold_valid is the narrow, SECURITY DEFINER way to ask
  // "is just this one hold still good" without opening the table itself up.
  const { data: holdCheck } = await supabase.rpc("check_hold_valid", { p_hold_id: holdId });
  const holdRow = Array.isArray(holdCheck) ? holdCheck[0] : holdCheck;
  if (!holdRow || !holdRow.is_valid) {
    return json({ error: "Your held time has expired, please choose a time again." }, 409);
  }
  const hold = { requested_start: holdRow.requested_start, duration_minutes: holdRow.duration_minutes };
  if (hold.duration_minutes !== product.duration_minutes) {
    return json({ error: "reading product does not match the held slot" }, 422);
  }

  // A coupon can bring this to $0. Clover, like most processors, doesn't do real $0.00
  // charges (Bev's own WooCommerce terminal has the same quirk) -- skip the charge entirely
  // rather than send an amount that isn't a real transaction.
  let charge, cloverRes, raw;
  if (finalPriceCents === 0) {
    charge = { status: "succeeded", paid: true, id: `free-${holdId}` };
  } else {
  // Submit the real charge to Clover.
  try {
    cloverRes = await fetch(`${CLOVER_API_BASE}/v1/charges`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOVER_PRIVATE_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        amount: finalPriceCents,
        currency: "usd",
        source: cardToken,
        ecomind: "ecom",
        description: `Cherry Sage — ${product.name}`,
      }),
    });
  } catch {
    return json({ error: "Could not reach the payment processor. Please try again." }, 502);
  }
  raw = await cloverRes.text();
  try { charge = raw ? JSON.parse(raw) : {}; } catch { charge = {}; }
  if (!cloverRes.ok) {
    await recordDecline(abuse.store, abuse.key, abuse.record);
    return json({ error: charge?.message || raw?.slice(0, 200) || "Card was declined. Please try a different card." }, 402);
  }

  if (charge.status !== "succeeded" || charge.paid !== true) {
    await recordDecline(abuse.store, abuse.key, abuse.record);
    return json({ error: "Payment did not complete. Please try again." }, 402);
  }
  } // end finalPriceCents === 0 ? / else

  // Only now, with a real confirmed charge (or a confirmed $0 coupon redemption), convert the
  // hold into a real booking.
  const { data: orderId, error: confirmErr } = await supabase.rpc("confirm_paid_booking", {
    p_server_key: SERVER_KEY,
    p_hold_id: holdId,
    p_customer_id: customerId,
    p_reading_product_id: readingProductId,
    p_clover_payment_id: charge.id,
    p_coupon_code: couponCode,
  });
  if (confirmErr || !orderId) {
    // The card WAS charged successfully but we couldn't record the booking -- this needs a
    // human, not a silent failure. Surface enough detail to find it (real Clover charge id).
    return json({
      error: "Your payment went through, but we could not finish reserving your appointment automatically. Please contact Cherry Sage directly and reference this: " + charge.id,
      chargeSucceededButBookingFailed: true,
    }, 500);
  }

  // Notify both sides. Best-effort -- a booking that already succeeded should not fail the
  // customer's request just because an email had trouble sending.
  const { data: customer } = await supabase.from("customers").select("email, full_name").eq("id", customerId).maybeSingle();

  // Mark the Brevo contact as converted so the abandoned-checkout automation leaves them alone.
  const BREVO_KEY = process.env.BREVO_KEY;
  if (BREVO_KEY && customer?.email) {
    try {
      await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: { "api-key": BREVO_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email: customer.email, updateEnabled: true, attributes: { CHECKOUT_STATUS: "completed" } }),
      });
    } catch { /* non-fatal */ }
  }
  const when = new Date(hold.requested_start).toLocaleString("en-US", {
    timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  }) + " Eastern";
  const money = (c) => "$" + (c / 100).toFixed(2);
  const orderDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const couponLine = couponCode ? `<br>Coupon used: ${esc(couponCode.toUpperCase())}` : "";
  const receiptTable =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">` +
    `<tr><td style="padding:8px 0;color:#8a8072;font-size:12px;border-bottom:1px solid #EDE2CF">Order #</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #EDE2CF;font-size:12px;color:#8a8072">Date</td></tr>` +
    `<tr><td style="padding:8px 0;border-bottom:1px solid #EDE2CF">${esc(String(orderId).slice(0, 8).toUpperCase())}</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #EDE2CF">${esc(orderDate)}</td></tr>` +
    `<tr><td colspan="2" style="padding:14px 0 6px;font-weight:bold">${esc(product.name)}</td></tr>` +
    `<tr><td style="padding:2px 0;color:#8a8072;font-size:14px">Appointment: ${esc(when)}</td><td></td></tr>` +
    (couponCode ? `<tr><td style="padding:2px 0;color:#8a8072;font-size:14px">Coupon: ${esc(couponCode.toUpperCase())}</td><td></td></tr>` : "") +
    `<tr><td style="padding:14px 0 0;font-weight:bold;border-top:1px solid #EDE2CF">Total paid</td><td style="padding:14px 0 0;text-align:right;font-weight:bold;border-top:1px solid #EDE2CF">${money(finalPriceCents)}</td></tr>` +
    `</table>`;
  await notify(process.env.NOTIFY_EMAIL, `New paid booking — ${product.name}`,
    `<p><strong>${esc(customer?.full_name || "A customer")}</strong> just booked and paid for a reading.</p>` +
    `<p>Reading: ${esc(product.name)}<br>When: ${esc(when)}<br>Amount: ${money(finalPriceCents)}${couponLine}<br>Email: ${esc(customer?.email || "")}<br>Order #: ${esc(String(orderId).slice(0, 8).toUpperCase())}</p>` +
    `<p style="color:#888;font-size:12px">Approve, decline, or offer an alternate time at /appointments-dashboard.html</p>`,
    customer?.email ? { email: customer.email } : undefined);
  if (customer?.email) {
    await notify(customer.email, "Your reading with Cherry Sage — payment received",
      `<p>Thank you, ${esc(customer.full_name || "")}. Your payment went through, here's your receipt.</p>` +
      receiptTable +
      `<p>Cherry will review and confirm your appointment shortly. You'll hear from her directly once it's confirmed.</p>`);
  }

  return json({
    ok: true,
    orderId,
    chargeId: charge.id,
    product: { name: product.name, priceCents: finalPriceCents },
    requestedStart: hold.requested_start,
  });
};

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function brandShell(bodyHtml) {
  return `<div style="background:#FAF6EF;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:520px;margin:0 auto;background:#FFFDF8;border:1px solid #EDE2CF;border-radius:12px;overflow:hidden;">` +
    `<div style="background:linear-gradient(160deg,#6E1A28 0%,#4A0F19 100%);padding:28px 32px;text-align:center;">` +
    `<img src="https://cherrysage.com/assets/logo-horizontal.png" alt="Cherry Sage" style="height:40px;max-width:220px;">` +
    `</div><div style="padding:32px;color:#2b2620;font-size:15px;line-height:1.6;">${bodyHtml}</div>` +
    `<div style="padding:20px 32px;border-top:1px solid #EDE2CF;color:#8a8072;font-size:12px;text-align:center;">` +
    `Cherry Sage &middot; Honest, accurate psychic, tarot, and numerology readings by phone. Trusted since 1999.<br>` +
    `<a href="https://cherrysage.com" style="color:#A0142B;">cherrysage.com</a></div></div></div>`;
}

async function notify(to, subject, htmlContent, replyTo) {
  const KEY = process.env.BREVO_KEY;
  if (!KEY || !to) return;
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Cherry Sage", email: "admin@cherrysage.com" },
        to: [{ email: to }],
        ...(replyTo ? { replyTo } : {}),
        subject, htmlContent: brandShell(htmlContent),
      }),
    });
  } catch { /* non-fatal, matches the existing lead.mjs/comments.mjs notify pattern */ }
}
