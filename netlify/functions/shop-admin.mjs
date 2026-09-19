// Cherry Sage — Bev's shop/pricing admin. Same PIN pattern as dashboard-summary.mjs/
// sage-updates.mjs (checked here, not the broken STATUS_ADMIN_KEY env var appointments-admin.mjs
// relies on). Lets her rename products, change prices, and turn items on/off without touching code.
import { createClient } from "@supabase/supabase-js";

// 2026-09-19: no PIN (the site's source is public). The caller's own login token is forwarded to
// Supabase and the database function checks cherry_sage.is_owner() itself.
function ownerClient(req) {
  const auth = req.headers.get("authorization") || "";
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!auth.startsWith("Bearer ") || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "cherry_sage" }, global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const notOwner = (e) => /unauthorized/i.test(e?.message || "");
const badToken = (e) => /jwt|token/i.test(e?.message || "");

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async (req) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);
  const supabase = ownerClient(req);
  if (!supabase) return json({ error: "login required" }, 401);

  if (req.method === "GET") {
    const { data, error } = await supabase.rpc("admin_list_products", { p_pin: "" });
    if (error) return json({ error: badToken(error) ? "login required" : notOwner(error) ? "not the owner login" : "could not load products" }, badToken(error) ? 401 : notOwner(error) ? 403 : 500);
    return json({ products: data || [] });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const id = String(d.id || "");
    if (!id) return json({ error: "missing product id" }, 400);
    const { data, error } = await supabase.rpc("admin_update_product", {
      p_pin: "",
      p_id: id,
      p_name: d.name != null ? String(d.name).trim() : null,
      p_price_cents: d.priceCents != null ? Math.round(Number(d.priceCents)) : null,
      p_active: d.active != null ? Boolean(d.active) : null,
    });
    if (error) return json({ error: badToken(error) ? "login required" : notOwner(error) ? "not the owner login" : error.message }, badToken(error) ? 401 : notOwner(error) ? 403 : 400);
    return json({ ok: true, product: data });
  }

  return json({ error: "method" }, 405);
};
