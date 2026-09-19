// Cherry Sage — Bev's coupon self-service. Built 2026-09-18: she asked "where do I create
// coupons" back on 9/13 and was told there was no admin screen for it yet, only the hardcoded
// TEST100 code. Same PIN/owner-login pattern as admin-customers.mjs and dashboard-summary.mjs.
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAILS = ["cherry38@cherrysage.com", "admin@cherrysage.com"];
const PIN = "0011";

async function resolveAdminKey(req, suppliedPin, supabase, realKey) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    const email = (data?.user?.email || "").toLowerCase();
    if (!error && OWNER_EMAILS.includes(email)) return realKey;
    return null;
  }
  return suppliedPin || null;
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async (req) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "cherry_sage" } });

  if (req.method === "GET") {
    const pin = await resolveAdminKey(req, req.headers.get("x-dashboard-pin") || "", supabase, PIN);
    if (!pin) return json({ error: "pin required" }, 401);
    const { data, error } = await supabase.rpc("admin_list_coupons", { p_pin: pin });
    if (error) return json({ error: /unauthorized/i.test(error.message || "") ? "wrong pin" : "could not load coupons" }, /unauthorized/i.test(error.message || "") ? 403 : 500);
    return json({ coupons: data || [] });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const pin = await resolveAdminKey(req, d.pin || "", supabase, PIN);
    if (!pin) return json({ error: "pin required" }, 401);

    if (d.action === "create") {
      const { data, error } = await supabase.rpc("admin_create_coupon", {
        p_pin: pin,
        p_code: String(d.code || ""),
        p_discount_type: String(d.discount_type || ""),
        p_discount_value: Number(d.discount_value),
        p_one_time_use_per_customer: !!d.one_time_use_per_customer,
        p_max_total_redemptions: d.max_total_redemptions ? Number(d.max_total_redemptions) : null,
        p_allowed_emails: Array.isArray(d.allowed_emails) && d.allowed_emails.length ? d.allowed_emails.map((e) => String(e)) : null,
      });
      if (error) return json({ error: error.message || "could not create coupon" }, /unauthorized/i.test(error.message || "") ? 403 : 422);
      return json({ ok: true, id: data });
    }

    if (d.action === "set_active") {
      const { error } = await supabase.rpc("admin_set_coupon_active", {
        p_pin: pin, p_id: String(d.id || ""), p_active: !!d.active,
      });
      if (error) return json({ error: error.message || "could not update coupon" }, /unauthorized/i.test(error.message || "") ? 403 : 422);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  }

  return json({ error: "method" }, 405);
};
