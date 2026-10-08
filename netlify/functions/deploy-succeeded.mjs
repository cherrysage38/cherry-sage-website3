// Cherry Sage: automatic "Changes we made" log.
//
// Netlify runs this file by itself after every successful deploy (the name
// "deploy-succeeded" is what tells Netlify to do that; nobody can call it from the web).
// On each LIVE (production) deploy it:
//   1. asks GitHub which commits went out since the last time it ran,
//   2. asks Claude to turn them into short, warm, plain-English notes for Bev,
//   3. files each note in the same "sage-updates" store the dashboard already reads,
//      under "website" or "crm" -- exactly like the entries RJ used to type by hand.
//
// It only ADDS entries. It never edits or deletes anything, and touches nothing else on the site.
//
// Settings (Netlify > Site configuration > Environment variables, scope must include Functions):
//   ANTHROPIC_API_KEY  required for the friendly summaries. Without it, the raw commit title is
//                      used instead, so the log still updates.
//   GITHUB_TOKEN       optional. Only needed if GitHub ever starts refusing requests.
//   CHANGELOG_REPO     optional. Defaults to cherrysage38/cherry-sage-website3.

import { getStore } from "@netlify/blobs";

const DEFAULT_REPO = "cherrysage38/cherry-sage-website3";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_COMMITS = 40; // safety cap per deploy

function env(name) {
  try { return Netlify.env.get(name); } catch { return process.env[name]; }
}

async function gh(path) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "cherry-sage-changelog" };
  const token = env("GITHUB_TOKEN");
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`);
  return res.json();
}

// Which commits are new since we last ran? First run ever: just the commit being deployed.
async function newCommits(repo, lastSha, headSha) {
  if (lastSha && lastSha !== headSha) {
    try {
      const cmp = await gh(`/repos/${repo}/compare/${lastSha}...${headSha}`);
      if (cmp.status === "ahead" || cmp.status === "diverged") {
        return (cmp.commits || []).slice(-MAX_COMMITS);
      }
      if (cmp.status === "identical" || cmp.status === "behind") return []; // e.g. a rollback
    } catch (e) {
      console.log("compare failed, falling back to the deployed commit only:", e.message);
    }
  }
  if (lastSha === headSha) return [];
  return [await gh(`/repos/${repo}/commits/${headSha}`)];
}

// Changed file names help Claude decide "website" vs "crm & email". Only fetched for small batches.
async function filesFor(repo, commit) {
  try {
    const full = commit.files ? commit : await gh(`/repos/${repo}/commits/${commit.sha}`);
    return (full.files || []).map((f) => f.filename).slice(0, 25);
  } catch { return []; }
}

const STYLE_EXAMPLES = `
- crm: Added card-testing and brute-force protection to checkout, so repeated bad card attempts get blocked rather than hitting your terminal.
- crm: Built the real sending system behind your weekly insight email, so the signup on your site now has something to actually send.
- crm: Fixed a real bug where checkout was silently failing for every customer, not just coupon users, caused by a database permissions issue on the customer lookup.
- crm: Added coupon support to checkout, one-time-use enforced by name, email, and phone together, not just email.`;

async function summarize(changes) {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) return null;

  const prompt = `You write the "Changes we made" log on the private dashboard of Beverly (Bev), who owns the website cherrysage.com. She is not technical. Below are code changes that just went live on her site.

Write one short entry per meaningful change, in the same warm, plain-English voice as these existing entries:
${STYLE_EXAMPLES}

Rules:
- One sentence each, written to Bev ("your site", "your checkout"). Say what changed and why it helps her. No jargon, no file names, no commit hashes. If a technical word is unavoidable, explain it in the same sentence.
- Combine commits that are really one change. Skip changes that don't matter to her (typo fixes in code comments, formatting, merges with nothing new, build housekeeping) -- returning nothing is fine.
- category "crm" = checkout, payments, coupons, appointments/booking, customers, emails and newsletters, the dashboard and admin tools, database. category "website" = page wording, articles, blog, images, design, layout, navigation, SEO, analytics, new pages.
- Never invent details that aren't supported by the change descriptions.

Reply with ONLY a JSON array, like [{"category":"website","text":"..."}]. Use [] if nothing is worth noting.

Changes:
${changes}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const arr = JSON.parse(match[0]);
  return arr
    .filter((e) => e && typeof e.text === "string" && e.text.trim())
    .map((e) => ({ category: e.category === "website" ? "website" : "crm", text: e.text.trim().slice(0, 600) }));
}

// Which dashboard list a change belongs in, without AI. Bev's rule: checkout, payments, coupons,
// bookings, customers, emails and the dashboard go to "CRM & email"; everything else to "Website".
const CRM_FILES = [
  /^netlify\/functions\//, /^_migrations\//, /^dashboard/, /^appointments-dashboard/, /^shop-admin/,
  /^status-admin/, /^moderate-comments/, /^checkout/, /^cart/, /^buy-minutes/, /^book-appointment/,
  /^report-payment/, /^account/, /^login/, /coupon/i, /email/i,
];
const CRM_WORDS = /\b(checkout|payments?|pay|coupons?|bookings?|appointments?|scheduler|customers?|e-?mails?|newsletters?|brevo|clover|dashboard|cart|orders?|refunds?|crm)\b/i;

function categoryFor(title, files) {
  if (files && files.length) return files.some((f) => CRM_FILES.some((re) => re.test(f))) ? "crm" : "website";
  return CRM_WORDS.test(title) ? "crm" : "website";
}

// Plain fallback when there's no API key or Claude is unreachable: the commit's own title.
function fallbackEntries(commits) {
  return commits
    .map((c) => ({ title: (c.commit?.message || "").split("\n")[0].trim(), files: c._files }))
    .filter(({ title }) => title && !/^merge (pull request|branch)/i.test(title))
    .map(({ title, files }) => ({ category: categoryFor(title, files), text: title.replace(/\s*\(#\d+\)$/, "") }));
}

export default async (req) => {
  let payload = {};
  try { ({ payload = {} } = await req.json()); } catch { return new Response("bad body", { status: 400 }); }

  // Only log what actually went live on cherrysage.com, not preview copies.
  if (payload.context !== "production") return new Response("skipped: not production");
  const headSha = payload.commit_ref;
  if (!headSha) return new Response("skipped: no commit");

  const repo = env("CHANGELOG_REPO") || DEFAULT_REPO;
  const state = getStore("sage-updates-auto"); // separate store, so the dashboard never sees this bookkeeping
  const updates = getStore("sage-updates");

  const last = await state.get("last", { type: "json" }).catch(() => null);
  let commits;
  try {
    commits = await newCommits(repo, last?.sha, headSha);
  } catch (e) {
    // GitHub sometimes refuses requests from Netlify's shared servers. Don't lose the entry:
    // Netlify already tells us the title of what just went live, so use that.
    console.log("GitHub unavailable, using the deploy title instead:", e.message);
    commits = payload.title && last?.sha !== headSha ? [{ sha: headSha, commit: { message: payload.title } }] : [];
  }

  if (commits.length) {
    const lines = [];
    for (const c of commits) {
      const files = commits.length <= 10 ? await filesFor(repo, c) : [];
      c._files = files;
      lines.push(`- ${c.commit?.message?.trim() || "(no message)"}${files.length ? `\n  files: ${files.join(", ")}` : ""}`);
    }

    let entries;
    try {
      entries = await summarize(lines.join("\n"));
    } catch (e) {
      console.log("summary failed, using commit titles:", e.message);
    }
    if (!entries) entries = fallbackEntries(commits);

    const now = new Date().toISOString();
    for (const e of entries) {
      const id = `${e.category}::${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await updates.setJSON(id, { id, category: e.category, text: e.text, created_at: now, auto: true, commit: headSha });
    }
    console.log(`logged ${entries.length} entr${entries.length === 1 ? "y" : "ies"} for ${commits.length} commit(s)`);
  }

  await state.setJSON("last", { sha: headSha, at: new Date().toISOString(), deploy: payload.id || null });
  return new Response("ok");
};
