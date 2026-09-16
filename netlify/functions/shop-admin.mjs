// Cherry Sage — Bev's shop/pricing admin. Same PIN pattern as dashboard-summary.mjs/
// sage-updates.mjs (checked here, not the broken STATUS_ADMIN_KEY env var appointments-admin.mjs
// relies on). Lets her rename products, change prices, and turn items on/off without touching code.
import { createClient } from "@supabase/supabase-js";

const PIN = "0011";

// Bev's own real login as a second way in, alongside the raw PIN (unchanged). Matches
// appointments-admin.mjs's pattern.
const OWNER_EMAILS = ["cherry38@cherrysage.com", "admin@cherrysage.com"];

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function resolveAdminKey(req, suppliedPin, supabase, realKey) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    const email = (data?.user?.email || "").toLowerCase();
    if (!error && OWNER_EMAILS.includes(email)) return realKey;
    return null;
  }
  if (realKey && suppliedPin === realKey) return realKey;
  return null;
}

export default async (req) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "cherry_sage" } });

  const pin = await resolveAdminKey(req, req.headers.get("x-dashboard-pin") || "", supabase, PIN);
  if (!pin) return json({ error: "unauthorized" }, 403);

  if (req.method === "GET") {
    const { data, error } = await supabase.rpc("admin_list_products", { p_pin: pin });
    if (error) return json({ error: error.message }, 500);
    return json({ products: data || [] });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const id = String(d.id || "");
    if (!id) return json({ error: "missing product id" }, 400);
    const { data, error } = await supabase.rpc("admin_update_product", {
      p_pin: pin,
      p_id: id,
      p_name: d.name != null ? String(d.name).trim() : null,
      p_price_cents: d.priceCents != null ? Math.round(Number(d.priceCents)) : null,
      p_active: d.active != null ? Boolean(d.active) : null,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, product: data });
  }

  return json({ error: "method" }, 405);
};
