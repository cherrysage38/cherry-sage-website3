// Cherry Sage — charges a multi-item cart in ONE Clover charge, then records it as one
// cart_orders row with a cart_order_items line per product, via confirm_paid_cart. Same
// security posture as purchase-charge.mjs: price always re-derived server-side per line item,
// coupon re-validated atomically at confirm time, real Clover charge required before anything
// is recorded, same card-testing rate-limit/decline-throttle as the rest of checkout.
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
    const key = `cart-ip:${ip}`;
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
  const cardToken = String(d.cardToken || "");
  const couponCode = d.couponCode ? String(d.couponCode).trim() : null;
  const items = Array.isArray(d.items) ? d.items : [];

  if (!customerId || !items.length) return json({ error: "missing cart details" }, 422);
  if (!cardToken.startsWith("clv_")) return json({ error: "invalid card token" }, 422);
  if (items.length > 20) return json({ error: "too many items in one order" }, 422);

  const productIds = items.map((it) => String(it.readingProductId || "")).filter(Boolean);
  if (productIds.length !== items.length) return json({ error: "bad item in cart" }, 422);

  const { data: products, error: productErr } = await supabase
    .from("reading_products")
    .select("id, name, price_cents, active, requires_scheduling")
    .in("id", productIds);
  if (productErr) return json({ error: "could not load products" }, 500);
  const byId = new Map((products || []).map((p) => [p.id, p]));

  let totalCents = 0;
  const lineSummaries = [];
  for (const it of items) {
    const p = byId.get(String(it.readingProductId));
    if (!p || !p.active || p.requires_scheduling) {
      return json({ error: `Product not available: ${it.readingProductId}` }, 422);
    }
    const { data: priced, error: pricedErr } = await supabase.rpc("price_with_coupon", {
      p_reading_product_id: p.id,
      p_coupon_code: couponCode,
      p_customer_id: customerId,
    });
    const priceRow = Array.isArray(priced) ? priced[0] : priced;
    if (pricedErr || !priceRow || priceRow.error) {
      return json({ error: priceRow?.error || "could not price this cart" }, 422);
    }
    totalCents += priceRow.final_price_cents;
    lineSummaries.push({ name: p.name, priceCents: priceRow.final_price_cents });
  }

  let charge;
  if (totalCents === 0) {
    charge = { status: "succeeded", paid: true, id: `free-${customerId}-${Date.now()}` };
  } else {
    let cloverRes, raw;
    try {
      cloverRes = await fetch(`${CLOVER_API_BASE}/v1/charges`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOVER_PRIVATE_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          amount: totalCents,
          currency: "usd",
          source: cardToken,
          ecomind: "ecom",
          description: `Cherry Sage — ${items.length} item${items.length > 1 ? "s" : ""}`,
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

  const rpcItems = items.map((it) => ({
    reading_product_id: it.readingProductId,
    details: it.details && typeof it.details === "object" ? it.details : null,
  }));

  const { data: cartOrderId, error: confirmErr } = await supabase.rpc("confirm_paid_cart", {
    p_server_key: SERVER_KEY,
    p_customer_id: customerId,
    p_items: rpcItems,
    p_clover_payment_id: charge.id,
    p_coupon_code: couponCode,
  });
  if (confirmErr || !cartOrderId) {
    return json({
      error: "Your payment was processed successfully, but we could not finish recording your order automatically. Please contact Cherry Sage directly and reference this: " + charge.id,
      chargeSucceededButOrderFailed: true,
    }, 500);
  }

  const { data: customer } = await supabase.from("customers").select("email, full_name").eq("id", customerId).maybeSingle();

  // Payment succeeded, this cart is no longer abandoned -- clear the pending record so
  // abandoned-cart-check.mjs never emails a customer who already checked out.
  try { await getStore("abandoned-carts").delete(customerId); } catch { /* non-fatal */ }

  const BREVO_KEY = process.env.BREVO_KEY;
  const money = (c) => "$" + (c / 100).toFixed(2);
  const NOTIFY_TO = process.env.NOTIFY_EMAIL;
  const orderDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const orderNum = esc(String(cartOrderId).slice(0, 8).toUpperCase());
  const itemsHtml = lineSummaries.map((l) =>
    `<tr><td style="padding:6px 0">${esc(l.name)}</td><td style="padding:6px 0;text-align:right">${money(l.priceCents)}</td></tr>`
  ).join("");
  const receiptTable =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">` +
    `<tr><td style="padding:8px 0;color:#8a8072;font-size:12px;border-bottom:1px solid #EDE2CF">Order #</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #EDE2CF;font-size:12px;color:#8a8072">Date</td></tr>` +
    `<tr><td style="padding:8px 0;border-bottom:1px solid #EDE2CF">${orderNum}</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #EDE2CF">${esc(orderDate)}</td></tr>` +
    itemsHtml +
    `<tr><td style="padding:14px 0 0;font-weight:bold;border-top:1px solid #EDE2CF">Total paid</td><td style="padding:14px 0 0;text-align:right;font-weight:bold;border-top:1px solid #EDE2CF">${money(totalCents)}</td></tr>` +
    `</table>`;
  if (BREVO_KEY && NOTIFY_TO) {
    await notify(NOTIFY_TO, `New paid cart order — ${lineSummaries.length} item${lineSummaries.length > 1 ? "s" : ""}`,
      `<p><strong>${esc(customer?.full_name || "A customer")}</strong> just paid for ${lineSummaries.length} item${lineSummaries.length > 1 ? "s" : ""}.</p>` +
      receiptTable +
      `<p>Email: ${esc(customer?.email || "")}</p>`);
  }
  if (BREVO_KEY && customer?.email) {
    await notify(customer.email, "Your order with Cherry Sage",
      `<p>Thank you, ${esc(customer.full_name || "")}. Your payment was processed successfully. Here's your receipt.</p>` +
      receiptTable +
      `<p>Cherry will be in touch, or you can call/email anytime.</p>`);
  }

  return json({
    ok: true,
    cartOrderId,
    chargeId: charge.id,
    items: lineSummaries,
    totalCents,
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
    `<img src="https://cherrysage.com/assets/logo-email.png" alt="Cherry Sage" width="200" height="56" style="height:56px;width:200px;max-width:220px;border:0;outline:none;text-decoration:none;display:block;margin:0 auto;">` +
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
