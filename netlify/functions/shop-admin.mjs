// Cherry Sage — Bev's shop manager. Lets her rename products, change prices, edit the description shown
// in the shop, choose which items show in the shop, edit the questions each numerology report asks the
// customer, and delete a product nobody has ordered, all without touching code.
//
// 2026-09-21: descriptions, "show in shop" and report questions moved into the database (Bev: "What
// shows as the product description in the front end is nowhere in this product management").
// No PIN: the caller's own login token is forwarded to Supabase and the database functions check
// cherry_sage.is_owner() themselves.
import { createClient } from "@supabase/supabase-js";

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
const msg = (e) => String(e?.message || "");
const notOwner = (e) => /^unauthorized/i.test(msg(e));
const badToken = (e) => /jwt|token/i.test(msg(e));

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Errors the database writes for Bev in plain English are passed through; anything else is generic.
function fail(error, fallback) {
  if (badToken(error)) return json({ error: "login required" }, 401);
  if (notOwner(error)) return json({ error: "not the owner login" }, 403);
  if (/^(has history|the product needs|the price is not|the description is too|the report questions|one of the report|product not found)/i.test(msg(error))) return json({ error: msg(error) }, 409);
  return json({ error: fallback }, 500);
}

export default async (req) => {
  const supabase = ownerClient(req);
  if (!supabase) return json({ error: "login required" }, 401);

  if (req.method === "GET") {
    const { data, error } = await supabase.rpc("admin_list_products", { p_pin: "" });
    if (error) return fail(error, "could not load products");
    return json({ products: data || [] });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const id = String(d.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "missing product id" }, 400);

    if (d.action === "delete") {
      const { error } = await supabase.rpc("admin_delete_product", { p_pin: "", p_id: id });
      return error ? fail(error, "could not delete that product") : json({ ok: true });
    }

    const hasFields = Array.isArray(d.reportFields);
    const { error } = await supabase.rpc("admin_update_product_details", {
      p_pin: "",
      p_id: id,
      p_name: d.name != null ? String(d.name).trim() : "",
      p_price_cents: d.priceCents != null ? Math.round(Number(d.priceCents)) : null,
      p_active: d.active != null ? Boolean(d.active) : null,
      p_description: d.description != null ? String(d.description) : null,
      p_show_in_shop: d.showInShop != null ? Boolean(d.showInShop) : null,
      p_report_fields: hasFields
        ? d.reportFields.slice(0, 20).map((f) => ({
            key: String(f.key || "").slice(0, 31),
            label: String(f.label || "").slice(0, 200),
            type: String(f.type || "text"),
            required: Boolean(f.required),
          }))
        : null,
      p_set_fields: hasFields,
    });
    return error ? fail(error, "could not save") : json({ ok: true });
  }

  return json({ error: "method" }, 405);
};
