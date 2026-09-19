// Cherry Sage — the dashboard's changelog + task-tracker backend. Feeds the "changes we made"
// lists on the Website/CRM/Home tabs, the "what Bev needs to do" list, and RJ's checkable task
// list. Gated by the same PIN as the rest of the dashboard (0011) -- checked here directly since
// this store has nothing to do with Supabase/dashboard_summary().
import { getStore } from "@netlify/blobs";
import { createClient } from "@supabase/supabase-js";


function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// 2026-09-19: the site's source is public, so a PIN written here is not a secret. Ownership is
// now decided by the database: the caller's own login token is forwarded to Supabase and
// cherry_sage.is_owner() checks it against cherry_sage.owner_emails.
async function isOwner(req) {
  const auth = req.headers.get("authorization") || "";
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!auth.startsWith("Bearer ") || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "cherry_sage" }, global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("is_owner");
  return !error && data === true;
}

export default async (req) => {
  if (!(await isOwner(req))) return json({ error: "unauthorized" }, 403);

  const store = getStore("sage-updates");

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    return json({ items: items.filter(Boolean).sort((a, b) => b.created_at.localeCompare(a.created_at)) });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const action = String(d.action || "add");

    if (action === "add") {
      const category = String(d.category || "");
      const text = String(d.text || "").trim();
      if (!["website", "crm", "email", "task", "bev_todo"].includes(category) || !text) {
        return json({ error: "bad category or empty text" }, 400);
      }
      const id = `${category}::${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry = {
        id, category, text,
        created_at: new Date().toISOString(),
        done: category === "task" || category === "bev_todo" ? false : undefined,
      };
      await store.setJSON(id, entry);
      return json({ ok: true, entry });
    }

    if (action === "toggle") {
      const id = String(d.id || "");
      const existing = await store.get(id, { type: "json" });
      if (!existing) return json({ error: "not found" }, 404);
      existing.done = !existing.done;
      existing.completed_at = existing.done ? new Date().toISOString() : null;
      await store.setJSON(id, existing);
      return json({ ok: true, entry: existing });
    }

    if (action === "delete") {
      const id = String(d.id || "");
      await store.delete(id);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  }

  return json({ error: "method" }, 405);
};
