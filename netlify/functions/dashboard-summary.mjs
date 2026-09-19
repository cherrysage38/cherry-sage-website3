// Cherry Sage — Bev's dashboard home. Gated by a short PIN (Bev's call, 2026-09-10 -- no email
// sign-in step). The PIN is checked inside dashboard_summary() itself, a SECURITY DEFINER
// function, so this is a real server-side check, not just a UI prompt someone could skip by
// calling the function directly. Every number here comes from a real system (Supabase for
// bookings, Netlify Blobs for contact-form leads, Brevo for email marketing), nothing invented.
import { createClient } from "@supabase/supabase-js";
import { getStore } from "@netlify/blobs";

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
  const BREVO_KEY = process.env.BREVO_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "not configured" }, 503);

  const supabase = ownerClient(req);
  if (!supabase) return json({ error: "login required" }, 401);

  const { data: summary, error: rpcErr } = await supabase.rpc("dashboard_summary", { p_pin: "" });
  if (rpcErr) {
    if (badToken(rpcErr)) return json({ error: "login required" }, 401);
    return json({ error: notOwner(rpcErr) ? "not the owner login" : "could not load summary" }, notOwner(rpcErr) ? 403 : 500);
  }

  // Contact-form leads (Netlify Blobs) -- best-effort, never fails the whole summary.
  let recentLeads = 0, totalLeads = 0;
  try {
    const store = getStore("leads");
    const { blobs } = await store.list();
    totalLeads = blobs.length;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    recentLeads = blobs.filter((b) => {
      const ts = Date.parse(b.key.split("_")[0]) || 0;
      return ts >= cutoff;
    }).length;
  } catch { /* blobs unavailable in some contexts; leave at 0 */ }

  // Brevo: contact list size, every real list with its own count, total campaigns ever sent,
  // and the most recent campaigns' real stats. Mirrors BBC's own /os/crm.html tile+list pattern.
  let brevo = { contactCount: null, recentCampaigns: [], lists: [], campaignCount: null };
  if (BREVO_KEY) {
    try {
      const contactsRes = await fetch("https://api.brevo.com/v3/contacts?limit=1", {
        headers: { "api-key": BREVO_KEY, accept: "application/json" },
      });
      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        brevo.contactCount = typeof cData.count === "number" ? cData.count : null;
      }
    } catch { /* non-fatal */ }
    try {
      // The bulk /contacts/lists endpoint reports 0 subscribers for every list -- a known Brevo
      // quirk, already documented on BBC's own /os/crm.html. The per-list endpoint is accurate,
      // so fetch each list individually rather than trust the bulk listing's counts.
      const listsRes = await fetch("https://api.brevo.com/v3/contacts/lists?limit=50&sort=desc", {
        headers: { "api-key": BREVO_KEY, accept: "application/json" },
      });
      if (listsRes.ok) {
        const lData = await listsRes.json();
        const ids = (lData.lists || []).map((l) => l.id);
        const details = await Promise.all(ids.map(async (id) => {
          try {
            const r = await fetch(`https://api.brevo.com/v3/contacts/lists/${id}`, {
              headers: { "api-key": BREVO_KEY, accept: "application/json" },
            });
            if (!r.ok) return null;
            const d = await r.json();
            return { id: d.id, name: d.name, totalSubscribers: d.totalSubscribers ?? d.uniqueSubscribers ?? null };
          } catch { return null; }
        }));
        brevo.lists = details.filter(Boolean);
      }
    } catch { /* non-fatal */ }
    try {
      const campCountRes = await fetch("https://api.brevo.com/v3/emailCampaigns?limit=1&status=sent", {
        headers: { "api-key": BREVO_KEY, accept: "application/json" },
      });
      if (campCountRes.ok) {
        const ccData = await campCountRes.json();
        brevo.campaignCount = typeof ccData.count === "number" ? ccData.count : null;
      }
    } catch { /* non-fatal */ }
    try {
      const campRes = await fetch("https://api.brevo.com/v3/emailCampaigns?limit=5&sort=desc&status=sent", {
        headers: { "api-key": BREVO_KEY, accept: "application/json" },
      });
      if (campRes.ok) {
        const cData = await campRes.json();
        brevo.recentCampaigns = (cData.campaigns || []).map((c) => ({
          name: c.name,
          sentDate: c.sentDate,
          // campaignStats, never globalStats -- globalStats can silently read 0/0 on real sends.
          delivered: c.statistics?.campaignStats?.[0]?.delivered ?? null,
          opens: c.statistics?.campaignStats?.[0]?.uniqueViews ?? null,
          clicks: c.statistics?.campaignStats?.[0]?.uniqueClicks ?? null,
        }));
      }
    } catch { /* non-fatal */ }
  }

  // Same-PIN changelog/task store (sage-updates.mjs), folded in here so the dashboard makes one
  // fetch for everything. Never fails the whole summary if Blobs has a hiccup.
  let updates = { website: [], crm: [], today: [], bevTodos: [], rjTasks: [] };
  try {
    const store = getStore("sage-updates");
    const { blobs } = await store.list();
    const items = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }))))
      .filter(Boolean)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    updates.website = items.filter((i) => i.category === "website");
    updates.crm = items.filter((i) => i.category === "crm" || i.category === "email");
    updates.today = items.filter((i) => i.created_at.slice(0, 10) === todayStr && i.category !== "task" && i.category !== "bev_todo");
    updates.bevTodos = items.filter((i) => i.category === "bev_todo" && !i.done);
    updates.rjTasks = items.filter((i) => i.category === "task");
  } catch { /* non-fatal */ }

  return json({
    ...summary,
    leads: { total: totalLeads, last30Days: recentLeads },
    brevo,
    updates,
  });
};
