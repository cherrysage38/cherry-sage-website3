// Cherry Sage — sends "This Week's Insight" (Brevo template 19) to everyone on the Weekly Tips
// Subscribers list (14). Owner-login gated: this reaches real subscriber inboxes, so it is never
// public and never auto-fires on a schedule without a human triggering this call. Tracks who's
// already been sent a given week's content (Blobs store "weekly-sent") so re-running the same
// week's send is idempotent, never double-emails anyone.
import { getStore } from "@netlify/blobs";
import { createClient } from "@supabase/supabase-js";

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

const LIST_ID = 14;
const TEMPLATE_ID = 19;

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const KEY = process.env.BREVO_KEY;
  if (!KEY) return json({ error: "not configured" }, 503);

  let d = {};
  try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  if (!(await isOwner(req))) return json({ error: "unauthorized: log in as the owner" }, 403);

  const insightBody = String(d.insightBody || "").trim();
  if (!insightBody) return json({ error: "insightBody is required, no default content is invented here" }, 422);
  const week = String(d.week || isoWeek(new Date()));
  const dryRun = d.dryRun !== false; // default true -- an explicit dryRun:false is required to actually send

  const store = getStore("weekly-sent");
  const sentKey = `${week}`;
  let alreadySent = [];
  try {
    const existing = await store.get(sentKey, { type: "json" });
    if (existing) alreadySent = existing.emails || [];
  } catch { /* first run for this week */ }

  // Pull every real contact on the list (paginated).
  let contacts = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`https://api.brevo.com/v3/contacts/lists/${LIST_ID}/contacts?limit=500&offset=${offset}`, {
      headers: { "api-key": KEY, accept: "application/json" },
    });
    if (!r.ok) return json({ error: `could not read the list (HTTP ${r.status})` }, 502);
    const data = await r.json();
    const batch = data.contacts || [];
    contacts.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
  }

  const targets = contacts.filter((c) => !c.emailBlacklisted && !alreadySent.includes(c.email));

  if (dryRun) {
    return json({
      ok: true, dryRun: true, week,
      listSize: contacts.length,
      wouldSend: targets.length,
      alreadySentThisWeek: alreadySent.length,
      sample: targets.slice(0, 5).map((c) => c.email),
    });
  }

  const results = { sent: 0, failed: 0, failures: [] };
  for (const c of targets) {
    try {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          to: [{ email: c.email }],
          templateId: TEMPLATE_ID,
          params: { INSIGHT_BODY: insightBody },
        }),
      });
      if (r.ok) { results.sent++; alreadySent.push(c.email); }
      else { results.failed++; results.failures.push({ email: c.email, status: r.status }); }
    } catch (e) {
      results.failed++; results.failures.push({ email: c.email, error: String(e) });
    }
  }

  await store.setJSON(sentKey, { emails: alreadySent, updated_at: new Date().toISOString() });

  return json({ ok: true, dryRun: false, week, listSize: contacts.length, ...results });
};
