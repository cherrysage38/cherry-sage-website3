// Cherry Sage — starts a multi-item cart purchase: finds or creates the customer, validates
// every item in the cart exists/active/not-scheduling, hands back real names+prices for the
// payment step to show. Mirrors purchase-start.mjs's customer-lookup + abuse-defense pattern,
// extended to a list of items instead of one product.
import { createClient } from "@supabase/supabase-js";
import { getStore } from "@netlify/blobs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function tooManyStarts(ip) {
  try {
    const store = getStore("checkout-abuse");
    const key = `cart-start-ip:${ip}`;
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const rec = (await store.get(key, { type: "json" })) || { attempts: [] };
    rec.attempts = rec.attempts.filter((t) => now - t < windowMs);
    if (rec.attempts.length >= 15) return true;
    rec.attempts.push(now);
    await store.setJSON(key, rec);
    return false;
  } catch { return false; }
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const clientIp = req.headers.get("x-nf-client-connection-ip") || "unknown";
  if (await tooManyStarts(clientIp)) {
    return json({ error: "Too many attempts from this connection. Please try again later." }, 429);
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "cherry_sage" } });

  let d = {};
  try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }

  const email = String(d.email || "").trim().toLowerCase();
  const fullName = String(d.name || "").trim().slice(0, 200);
  const phone = String(d.phone || "").trim().slice(0, 40);
  const items = Array.isArray(d.items) ? d.items : [];

  if (!EMAIL.test(email)) return json({ error: "invalid email" }, 422);
  if (!fullName) return json({ error: "name required" }, 422);
  if (!items.length) return json({ error: "cart is empty" }, 422);
  if (items.length > 20) return json({ error: "too many items in one order" }, 422);

  const productIds = items.map((it) => String(it.readingProductId || "")).filter(Boolean);
  if (productIds.length !== items.length) return json({ error: "bad item in cart" }, 422);

  const { data: products, error: productErr } = await supabase
    .from("reading_products")
    .select("id, name, price_cents, active, requires_scheduling")
    .in("id", productIds);
  if (productErr) return json({ error: "could not load products" }, 500);

  const byId = new Map((products || []).map((p) => [p.id, p]));
  const resolvedItems = [];
  for (const it of items) {
    const p = byId.get(String(it.readingProductId));
    if (!p || !p.active || p.requires_scheduling) {
      return json({ error: `Product not available: ${it.readingProductId}` }, 422);
    }
    resolvedItems.push({
      readingProductId: p.id, name: p.name, priceCents: p.price_cents,
      details: it.details && typeof it.details === "object" ? it.details : null,
    });
  }

  const { data: customerId, error: custErr } = await supabase.rpc("create_customer_if_missing", {
    p_email: email, p_full_name: fullName, p_phone: phone || null,
  });
  if (custErr || !customerId) return json({ error: "could not save customer: " + (custErr?.message || "unknown") }, 500);

  // Marks this cart as "started" for the abandoned-cart follow-up (abandoned-cart-check.mjs).
  // cart-charge.mjs clears this same record the moment payment actually succeeds, so a
  // completed purchase never gets a "you left something" email.
  try {
    await getStore("abandoned-carts").setJSON(customerId, {
      email, name: fullName, items: resolvedItems, startedAt: Date.now(),
    });
  } catch { /* non-fatal, worst case a follow-up email doesn't fire */ }

  return json({ ok: true, customerId, items: resolvedItems });
};
