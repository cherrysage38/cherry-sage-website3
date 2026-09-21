// Cherry Sage — charges a NON-scheduled purchase (Buy Minutes instant, or a numerology report)
// and, only on confirmed Clover success, records a real paid order via confirm_paid_purchase.
// Same security posture as checkout-charge.mjs: price always derived server-side, coupon
// re-validated atomically at confirm time, real Clover charge required before anything is
// recorded, and the same card-testing rate-limit/decline-throttle built tonight (2026-09-11).
import { createClient } from "@supabase/supabase-js";
import { getStore } from "@netlify/blobs";

const CLOVER_API_BASE = "https://api.clover.com";
// Payment-confirmation key: a secret Netlify setting (CS_SERVER_KEY), checked by the database
// (cherry_sage.server_key_ok). Never write the value in this repo, it is public.
const SERVER_KEY = process.env.CS_SERVER_KEY;

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 8;
const MAX_DECLINES_PER_WINDOW = 5; // was 3 -- too tight, locked out a real customer over a few mistyped-card declines, 2026-09-16
const BLOCK_MS = 10 * 60 * 1000; // was 30 min -- same incident

async function checkAndRecordAttempt(ip) {
  try {
    const store = getStore("checkout-abuse");
    const key = `purchase-ip:${ip}`;
    const now = Date.now();
    const rec = (await store.get(key, { type: "json" })) || { attempts: [], declines: [], blockedUntil: 0 };
    if (rec.blockedUntil && rec.blockedUntil > now) return { blocked: true };
    rec.attempts = rec.attempts.filter((t) => now - t < RATE_WINDOW_MS);
    rec.declines = rec.declines.filter((t) => now - t < RATE_WINDOW_MS);
    if (rec.attempts.length >= MAX_ATTEMPTS_PER_WINDOW) {
      rec.blockedUntil = now + BLOCK_MS;
      await store.setJSON(key, rec);
      return { blocked: true };
    }
    rec.attempts.push(now);
    await store.setJSON(key, rec);
    return { blocked: false, record: rec, store, key };
  } catch { return { blocked: false }; }
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

  const customerId = String(d.customerId || "");
  const readingProductId = String(d.readingProductId || "");
  const cardToken = String(d.cardToken || "");
  const couponCode = d.couponCode ? String(d.couponCode).trim() : null;
  const details = d.details && typeof d.details === "object" ? d.details : null;

  if (!customerId || !readingProductId) return json({ error: "missing purchase details" }, 422);
  if (!cardToken.startsWith("clv_")) return json({ error: "invalid card token" }, 422);

  const { data: product, error: productErr } = await supabase
    .from("reading_products")
    .select("id, name, price_cents, active, requires_scheduling")
    .eq("id", readingProductId)
    .maybeSingle();
  if (productErr || !product || !product.active || product.requires_scheduling) {
    return json({ error: "product not available" }, 422);
  }

  const { data: priced, error: pricedErr } = await supabase.rpc("price_with_coupon", {
    p_reading_product_id: readingProductId,
    p_coupon_code: couponCode,
    p_customer_id: customerId,
  });
  const priceRow = Array.isArray(priced) ? priced[0] : priced;
  if (pricedErr || !priceRow || priceRow.error) {
    return json({ error: priceRow?.error || "could not price this purchase" }, 422);
  }
  const finalPriceCents = priceRow.final_price_cents;

  let charge, cloverRes, raw;
  if (finalPriceCents === 0) {
    charge = { status: "succeeded", paid: true, id: `free-${customerId}-${Date.now()}` };
  } else {
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
  }

  const { data: orderId, error: confirmErr } = await supabase.rpc("confirm_paid_purchase", {
    p_server_key: SERVER_KEY,
    p_customer_id: customerId,
    p_reading_product_id: readingProductId,
    p_clover_payment_id: charge.id,
    p_coupon_code: couponCode,
    p_details: details,
  });
  if (confirmErr || !orderId) {
    return json({
      error: "Your payment was processed successfully, but we could not finish recording your order automatically. Please contact Cherry Sage directly and reference this: " + charge.id,
      chargeSucceededButOrderFailed: true,
    }, 500);
  }

  const { data: customer } = await supabase.from("customers").select("email, full_name").eq("id", customerId).maybeSingle();

  const BREVO_KEY = process.env.BREVO_KEY;
  const money = (c) => "$" + (c / 100).toFixed(2);
  const NOTIFY_TO = process.env.NOTIFY_EMAIL;
  if (BREVO_KEY && NOTIFY_TO) {
    await notify(NOTIFY_TO, `New paid purchase — ${product.name}`,
      `<p><strong>${esc(customer?.full_name || "A customer")}</strong> just bought ${esc(product.name)}.</p>` +
      `<p>Amount: ${money(finalPriceCents)}<br>Email: ${esc(customer?.email || "")}</p>` +
      (details ? `<p>Details: ${esc(JSON.stringify(details))}</p>` : ""));
  }
  if (BREVO_KEY && customer?.email) {
    await notify(customer.email, "Your order with Cherry Sage",
      `<p>Thank you, ${esc(customer.full_name || "")}. Your payment for <strong>${esc(product.name)}</strong> was processed successfully.</p>` +
      `<p>Amount charged: ${money(finalPriceCents)}</p>` +
      `<p>Cherry will be in touch, or you can call/email anytime to use your purchase.</p>`);
  }

  return json({
    ok: true,
    orderId,
    chargeId: charge.id,
    product: { name: product.name, priceCents: finalPriceCents },
  });
};

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
    `<a href="https://cherrysage.com" style="color:#A0142B;">cherrysage.com</a></div></div></div>`;
}

async function notify(to, subject, htmlContent) {
  const KEY = process.env.BREVO_KEY;
  if (!KEY || !to) return;
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Cherry Sage", email: "admin@cherrysage.com" },
        to: [{ email: to }],
        subject, htmlContent: brandShell(htmlContent),
      }),
    });
  } catch { /* non-fatal */ }
}
