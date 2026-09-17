// Cherry Sage — Bev's customer list. Built 2026-09-18 in response to her own question ("where
// do I find my users -- Admin, subscribers, customers"). "Admins" are just her + RJ's real
// logins, "subscribers" are Brevo contacts already shown in the CRM tab -- this is the missing
// piece, an actual list of the customers table with real login present, order count, spend,
// and appointment count. Same PIN/owner-login pattern as dashboard-summary.mjs.
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

  const pin = await resolveAdminKey(req, req.headers.get("x-dashboard-pin") || "", supabase, PIN);
  if (!pin) return json({ error: "pin required" }, 401);

  const { data, error } = await supabase.rpc("admin_list_customers", { p_pin: pin });
  if (error) {
    const msg = /unauthorized/i.test(error.message || "") ? "wrong pin" : "could not load customers";
    return json({ error: msg }, error.message?.includes("unauthorized") ? 403 : 500);
  }
  return json({ customers: data || [] });
};
