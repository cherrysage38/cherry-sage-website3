// Cherry Sage — Bev's coupon self-service. Built 2026-09-18: she asked "where do I create
// coupons" back on 9/13 and was told there was no admin screen for it yet, only the hardcoded
// TEST100 code.
//
// 2026-09-19: no PIN. The source repo is public, so a PIN written in it is not a secret, and
// anyone holding it could mint a 100%-off coupon. The caller's own login token is forwarded to
// Supabase and the database checks it against cherry_sage.owner_emails (cherry_sage.is_owner()).
import { createClient } from "@supabase/supabase-js";

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async (req) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "login required" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "cherry_sage" },
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const denied = (error) => /unauthorized/i.test(error?.message || "");
  const expired = (error) => /jwt|token/i.test(error?.message || "");

  if (req.method === "GET") {
    const { data, error } = await supabase.rpc("admin_list_coupons", { p_pin: "" });
    if (expired(error)) return json({ error: "login required" }, 401);
    if (error) return json({ error: denied(error) ? "not the owner login" : "could not load coupons" }, denied(error) ? 403 : 500);
    return json({ coupons: data || [] });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }

    if (d.action === "create") {
      const { data, error } = await supabase.rpc("admin_create_coupon", {
        p_pin: "",
        p_code: String(d.code || ""),
        p_discount_type: String(d.discount_type || ""),
        p_discount_value: Number(d.discount_value),
        p_one_time_use_per_customer: !!d.one_time_use_per_customer,
        p_max_total_redemptions: d.max_total_redemptions ? Number(d.max_total_redemptions) : null,
        p_allowed_emails: Array.isArray(d.allowed_emails) && d.allowed_emails.length ? d.allowed_emails.map((e) => String(e)) : null,
      });
      if (error) return json({ error: denied(error) ? "not the owner login" : (error.message || "could not create coupon") }, denied(error) ? 403 : 422);
      return json({ ok: true, id: data });
    }

    if (d.action === "set_active") {
      const { error } = await supabase.rpc("admin_set_coupon_active", {
        p_pin: "", p_id: String(d.id || ""), p_active: !!d.active,
      });
      if (error) return json({ error: denied(error) ? "not the owner login" : (error.message || "could not update coupon") }, denied(error) ? 403 : 422);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  }

  return json({ error: "method" }, 405);
};
