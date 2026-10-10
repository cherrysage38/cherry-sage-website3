// Run each morning by .github/workflows/scheduled-posts.yml (Bev, 2026-10-10: scheduled posts).
// Finds blog posts whose date has arrived (today, or the last few days in case a morning was missed)
// that haven't been released yet, notes them in content/.scheduled-log, and prints their titles.
// The workflow then commits that note, and the commit makes Netlify rebuild the site, which is what
// actually puts the post up (build-blog.js holds back anything dated after today). Changes nothing else.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BLOG = join(ROOT, "content", "blog");
const LOG = join(ROOT, "content", ".scheduled-log");
const CATCH_UP_DAYS = 3;

const fmt = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
const today = fmt(new Date());
const earliest = fmt(new Date(Date.now() - CATCH_UP_DAYS * 86400000));

const done = new Set(existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").map((l) => l.trim().split(" ")[1]).filter(Boolean) : []);
const due = [];
for (const f of readdirSync(BLOG).filter((n) => n.endsWith(".md"))) {
  const m = readFileSync(join(BLOG, f), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let data = {};
  try { data = (m && yaml.load(m[1], { schema: yaml.CORE_SCHEMA })) || {}; } catch { continue; }
  const date = String(data.date || "").slice(0, 10), slug = f.replace(/\.md$/, "");
  if (String(data.hidden) === "true" || date > today || date < earliest || done.has(slug)) continue;
  due.push({ date, slug, title: String(data.title || slug) });
}

if (!due.length) { console.log("Nothing due today."); process.exit(0); }
const lines = due.map((d) => `${d.date} ${d.slug}`).join("\n") + "\n";
writeFileSync(LOG, (existsSync(LOG) ? readFileSync(LOG, "utf8") : "") + lines);
console.log(due.map((d) => d.title).join(" | "));
