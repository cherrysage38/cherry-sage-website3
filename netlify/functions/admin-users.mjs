// Cherry Sage — Bev's Users tab (2026-09-21). She asked where she can add, delete and manage user
// accounts, and said so many junk accounts register on her site. Lists every registered account,
// blocks or unblocks one, deletes one (only when it has no orders or appointments), and keeps chosen
// email addresses or whole domains from registering again.
//
// No PIN: the caller's own login token is forwarded to Supabase and the database functions check
// cherry_sage.is_owner() themselves (see the users_management migrations).
import { createClient } from "@supabase/supabase-js";

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
const msg = (e) => String(e?.message || "");
const notOwner = (e) => /^unauthorized/i.test(msg(e));
const badToken = (e) => /jwt|token/i.test(msg(e));

export default async (req) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "login required" }, 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "cherry_sage" }, global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fail = (error, fallback, code = 500) => {
    if (badToken(error)) return json({ error: "login required" }, 401);
    if (notOwner(error)) return json({ error: "not the owner login" }, 403);
    // These messages are written for Bev by the database functions ("has history: ...", "cannot change an owner account").
    if (/^(has history|cannot change|that would block|enter an email|user not found)/i.test(msg(error))) return json({ error: msg(error) }, 409);
    return json({ error: fallback }, code);
  };

  if (req.method === "GET") {
    const users = await supabase.rpc("admin_list_users", { p_pin: "" });
    if (users.error) return fail(users.error, "could not load users");
    const blocked = await supabase.rpc("admin_list_blocked_emails", { p_pin: "" });
    return json({ users: users.data || [], blocked: blocked.error ? [] : (blocked.data || []) });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const id = String(d.id || "");
    const uuid = /^[0-9a-f-]{36}$/i;

    if (d.action === "block" || d.action === "unblock") {
      if (!uuid.test(id)) return json({ error: "bad request" }, 400);
      const { error } = await supabase.rpc("admin_set_user_blocked", { p_pin: "", p_user_id: id, p_blocked: d.action === "block", p_reason: d.reason ? String(d.reason).slice(0, 200) : null });
      return error ? fail(error, "could not update that account") : json({ ok: true });
    }
    if (d.action === "delete") {
      if (!uuid.test(id)) return json({ error: "bad request" }, 400);
      const { error } = await supabase.rpc("admin_delete_user", { p_pin: "", p_user_id: id });
      return error ? fail(error, "could not delete that account") : json({ ok: true });
    }
    if (d.action === "block_email" || d.action === "unblock_email") {
      const { error } = await supabase.rpc("admin_set_email_blocked", { p_pin: "", p_email: String(d.email || "").slice(0, 200), p_blocked: d.action === "block_email", p_reason: d.reason ? String(d.reason).slice(0, 200) : null });
      return error ? fail(error, "could not update the block list") : json({ ok: true });
    }
    return json({ error: "unknown action" }, 400);
  }

  return json({ error: "method" }, 405);
};
