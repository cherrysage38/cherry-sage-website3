// Run each morning by .github/workflows/scheduled-posts.yml (Bev, 2026-10-10: scheduled posts).
// Finds blog posts whose date has arrived (today, or the last few days in case a morning was missed)
// that haven't been released yet, notes them in content/.scheduled-log, and prints their titles.
// The workflow then commits that note, and the commit makes Netlify rebuild the site, which is what
// actually puts the post up (build-blog.js holds back anything dated after today).
// Featured posts (Bev, 2026-10-12): a post ticked "Feature at the top of the Blog" with no end date gets
// one written in, 60 days from today. The morning after a feature ends it notes that too, so the site
// rebuilds and the newest post takes the top spot again. Changes nothing else.
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
const FEATURE_DAYS = 60;
const due = [], notes = [];
for (const f of readdirSync(BLOG).filter((n) => n.endsWith(".md"))) {
  const raw = readFileSync(join(BLOG, f), "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let data = {};
  try { data = (m && yaml.load(m[1], { schema: yaml.CORE_SCHEMA })) || {}; } catch { continue; }
  const date = String(data.date || "").slice(0, 10), slug = f.replace(/\.md$/, "");
  const title = String(data.title || slug);
  if (String(data.featured) === "true" && String(data.hidden) !== "true") {
    const until = String(data.featured_until || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      const end = fmt(new Date(Date.now() + FEATURE_DAYS * 86400000));
      // Write the end date into the post's front matter, replacing a blank featured_until if there is one.
      const fm = m[1].match(/^featured_until:.*$/m) ? m[1].replace(/^featured_until:.*$/m, `featured_until: "${end}"`)
        : m[1].replace(/^featured:.*$/m, (x) => `${x}\nfeatured_until: "${end}"`);
      writeFileSync(join(BLOG, f), raw.replace(m[1], fm));
      notes.push(`Featured until ${end}: ${title}`);
    } else if (until < today && until >= earliest && !done.has(`feature-ended:${slug}`)) {
      due.push({ date: until, slug: `feature-ended:${slug}`, title: `Feature ended: ${title}` });
    }
  }
  if (String(data.hidden) === "true" || date > today || date < earliest || done.has(slug)) continue;
  due.push({ date, slug, title });
}

if (!due.length && !notes.length) { console.log("Nothing due today."); process.exit(0); }
if (due.length) {
  const lines = due.map((d) => `${d.date} ${d.slug}`).join("\n") + "\n";
  writeFileSync(LOG, (existsSync(LOG) ? readFileSync(LOG, "utf8") : "") + lines);
}
console.log(due.map((d) => d.title).concat(notes).join(" | "));
