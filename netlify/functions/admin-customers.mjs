// Cherry Sage — Bev's customer list. Built 2026-09-18 in response to her own question ("where
// do I find my users -- Admin, subscribers, customers"). "Admins" are just her + RJ's real
// logins, "subscribers" are Brevo contacts already shown in the CRM tab -- this is the missing
// piece, an actual list of the customers table with real login present, order count, spend,
// and appointment count.
//
// 2026-09-19: no PIN. The source repo is public, so a PIN written in it is not a secret, and
// this RPC returns customer names, emails and phone numbers. The caller's own login token is
// forwarded to Supabase and the database itself checks it against cherry_sage.owner_emails
// (see cherry_sage.is_owner()). No valid owner login, no data.
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

  const { data, error } = await supabase.rpc("admin_list_customers", { p_pin: "" });
  if (error) {
    if (/jwt|token/i.test(error.message || "")) return json({ error: "login required" }, 401);
    const denied = /unauthorized/i.test(error.message || "");
    return json({ error: denied ? "not the owner login" : "could not load customers" }, denied ? 403 : 500);
  }
  return json({ customers: data || [] });
};
