// Cherry Sage — per-post blog/article comments. Moderated: every comment starts "pending"
// and only shows publicly once approved via moderate-comments.html (admin-key gated).
import { getStore } from "@netlify/blobs";
import { createClient } from "@supabase/supabase-js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9-]{1,200}$/;

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
  const store = getStore("comments");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const admin = url.searchParams.get("admin");
    if (admin) {
      if (!(await isOwner(req))) return json({ error: "unauthorized" }, 401);
      const { blobs } = await store.list();
      const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
      const pending = all.filter((c) => c && c.status === "pending").sort((a, b) => b.ts.localeCompare(a.ts));
      return json({ pending });
    }
    const post = String(url.searchParams.get("post") || "");
    if (!SLUG.test(post)) return json({ error: "bad post" }, 400);
    const { blobs } = await store.list({ prefix: `${post}::` });
    const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    const approved = all
      .filter((c) => c && c.status === "approved")
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .map((c) => ({ name: c.name || "Anonymous", message: c.message, ts: c.ts }));
    return json({ comments: approved });
  }

  if (req.method === "POST") {
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }

    // admin moderation action
    if (d.action === "approve" || d.action === "reject") {
      if (!(await isOwner(req))) return json({ error: "unauthorized" }, 401);
      const id = String(d.id || "");
      const rec = await store.get(id, { type: "json" });
      if (!rec) return json({ error: "not found" }, 404);
      if (d.action === "reject") { await store.delete(id); return json({ ok: true, deleted: true }); }
      rec.status = "approved";
      await store.setJSON(id, rec);
      return json({ ok: true, approved: true });
    }

    // one-time admin bulk import (real historical comments from the old WordPress site --
    // written straight to "approved" with their real original date, skips the pending/notify
    // flow entirely since these already happened and were already public). PIN-gated like the
    // site's other admin endpoints (dashboard/shop/status), not the STATUS_ADMIN_KEY, which is
    // unreliable -- see schedule.mjs's history for why. 2026-09-16.
    if (d.action === "import") {
      if (!(await isOwner(req))) return json({ error: "unauthorized" }, 401);
      const items = Array.isArray(d.comments) ? d.comments.slice(0, 500) : [];
      let imported = 0, skipped = 0;
      for (const c of items) {
        const postSlug = String(c.postSlug || "");
        const message = String(c.message || "").trim().slice(0, 4000);
        const ts = String(c.ts || "");
        if (!SLUG.test(postSlug) || !message || !ts) { skipped++; continue; }
        const name = String(c.name || "Anonymous").slice(0, 120);
        const id = `${postSlug}::wp-${c.wpId || Date.now()}`;
        await store.setJSON(id, { id, postSlug, postTitle: postSlug, name, email: "", message, status: "approved", ts });
        imported++;
      }
      return json({ ok: true, imported, skipped });
    }

    // public new-comment submission -- requires being signed in (Bev asked twice: no guest
    // comments, same as no guest booking). The email is taken from the verified session, never
    // from the request body, so it can't be spoofed.
    if (String(d.website || d.hp || "").trim()) return json({ ok: true, bot: 1 });
    if (d.t && Date.now() - Number(d.t) < 1500) return json({ ok: true, bot: 1 });

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return json({ error: "unauthorized" }, 401);
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "unauthorized" }, 401);
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "cherry_sage" } });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    const email = (userData?.user?.email || "").toLowerCase();
    if (userErr || !email || !EMAIL.test(email)) return json({ error: "unauthorized" }, 401);

    const postSlug = String(d.postSlug || "");
    const postTitle = String(d.postTitle || postSlug).slice(0, 200);
    const name = String(d.name || "").slice(0, 120);
    const message = String(d.message || "").trim().slice(0, 2000);
    if (!SLUG.test(postSlug)) return json({ error: "bad post" }, 400);
    if (!message) return json({ error: "empty message" }, 422);

    const ts = new Date().toISOString();
    const id = `${postSlug}::${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { id, postSlug, postTitle, name, email, message, status: "pending", ts };
    await store.setJSON(id, record);

    // notify Bev so she can approve it
    const KEY = process.env.BREVO_KEY;
    const NOTIFY_TO = process.env.NOTIFY_EMAIL;
    if (KEY && NOTIFY_TO) {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { name: "Cherry Sage Website", email: "admin@cherrysage.com" },
            to: [{ email: NOTIFY_TO }],
            ...(email ? { replyTo: { email } } : {}),
            subject: `New comment awaiting approval — ${postTitle}`,
            htmlContent: `<p><strong>New comment on "${escapeHtml(postTitle)}"</strong></p>` +
              `<p>From: ${escapeHtml(name || "Anonymous")}${email ? ` &lt;${escapeHtml(email)}&gt;` : ""}</p>` +
              `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` +
              `<p style="color:#888;font-size:12px">Approve or reject it at /moderate-comments.html</p>`,
          }),
        });
      } catch { /* non-fatal */ }
    }

    return json({ ok: true, pending: true });
  }

  return json({ error: "method" }, 405);
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*" },
  });
}
