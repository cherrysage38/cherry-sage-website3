// Puts the words Cherry edits in the site editor (Homepage) into index.html.
// content/home.yml holds the text; index.html holds the layout, with markers like
//   <!-- cs-home:hero --> ... <!-- /cs-home:hero -->
// around each editable region. Only what sits between a pair of markers is rewritten, everything else
// on the page (the tarot deck, the Life Path calculator, scripts, menu, footer) is left exactly as it is.
// Runs on every Netlify deploy (see package.json). If content/home.yml or a marker is missing it does
// nothing for that part, so it can never blank the homepage.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME_YML = join(ROOT, "content", "home.yml");
const INDEX = join(ROOT, "index.html");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Links: only site pages, web addresses, mail and in-page anchors. Anything else becomes "#".
const href = (u) => {
  const v = String(u ?? "").trim();
  return /^(\/|#|https?:\/\/|mailto:|tel:)/i.test(v) ? v.replace(/"/g, "%22") : "#";
};
const arr = (x) => (Array.isArray(x) ? x : []);
const head = (h = {}) =>
  `<div class="section-head reveal">\n      <p class="eyebrow">${esc(h.eyebrow)}</p>\n      <h2>${esc(h.heading)}</h2>\n      ${h.intro ? `<p>${esc(h.intro)}</p>` : ""}\n    </div>`;

const regions = {
  hero: (d) => {
    const h = d.hero || {};
    return `
      <p class="eyebrow">${esc(h.eyebrow)}</p>
      <h1>${esc(h.headline)} <span class="accent">${esc(h.headline_accent)}</span></h1>
      <p class="hero-lede">${esc(h.intro)}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${href(h.button1_link)}">${esc(h.button1_label)}</a>
        <a class="btn btn-ghost" href="${href(h.button2_link)}">${esc(h.button2_label)}</a>
      </div>
      <div class="trust-strip">
${arr(h.trust).map((t) => `        <span><span class="dot"></span>${esc(t)}</span>`).join("\n")}
      </div>
    `;
  },
  services: (d) => {
    const s = d.services || {};
    return `
    ${head(s)}
    <div class="grid grid-3">
${arr(s.cards).map((c) => `      <div class="card reveal"><span class="chip">${esc(c.tag)}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p><a class="card-link" href="${href(c.link)}">${esc(c.link_label)}</a></div>`).join("\n")}
    </div>
  `;
  },
  situations: (d) => {
    const s = d.situations || {};
    return `
    ${head(s)}
    <div class="sit-grid">
${arr(s.cards).map((c) => `      <a class="sit-card reveal" href="${href(c.link || "/shop")}"><p class="sit-q">${esc(c.quote)}</p><span class="sit-cta">${esc(c.label)}</span></a>`).join("\n")}
    </div>
  `;
  },
  story: (d) => {
    const s = d.story || {};
    return `
    <div class="reveal">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.heading)}</h2>
      <p>${esc(s.paragraph1)}</p>
      <p>${esc(s.paragraph2)}</p>
      <a class="btn btn-ghost" href="${href(s.button_link)}">${esc(s.button_label)}</a>
    </div>
    <div class="story-card reveal">
      <p class="pull" style="border:none;margin:0;padding:0">${esc(s.quote)}</p>
      <cite>${esc(s.quote_by)}</cite>
    </div>
  `;
  },
  draw: (d) => {
    const s = d.draw || {};
    return `<div class="section-head reveal"><p class="eyebrow">${esc(s.eyebrow)}</p><h2>${esc(s.heading)}</h2><p>${esc(s.intro)}</p></div>`;
  },
  freehead: (d) => {
    const s = d.free || {};
    return `<div class="section-head reveal">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.heading)}</h2>
      <p>${esc(s.intro)}</p>
    </div>`;
  },
  freecards: (d) => {
    const s = d.free || {};
    return `<div class="grid grid-3">
${arr(s.cards).map((c) => `      <div class="card reveal"><span class="free-tag">Free</span><span class="chip">${esc(c.tag)}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p><a class="card-link" href="${href(c.link)}">${esc(c.link_label)}</a></div>`).join("\n")}
    </div>`;
  },
  how: (d) => {
    const s = d.how || {};
    return `
    <div class="section-head reveal"><p class="eyebrow">${esc(s.eyebrow)}</p><h2>${esc(s.heading)}</h2></div>
    <div class="steps">
${arr(s.steps).map((x) => `      <div class="step reveal"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join("\n")}
    </div>
    <div class="center" style="margin-top:2rem"><a class="btn btn-gold" href="${href(s.button_link)}">${esc(s.button_label)}</a></div>
  `;
  },
  testimonials: (d) => {
    const s = d.testimonials || {};
    return `<div class="section-head reveal"><p class="eyebrow">${esc(s.eyebrow)}</p><h2>${esc(s.heading)}</h2><p>${esc(s.intro)}</p></div><div class="t-highlights">${arr(s.quotes).map((q) => `<figure class="quote-card reveal"><blockquote>${esc(q.quote)}</blockquote><figcaption><span class="t-name">${esc(q.name)}</span><span class="t-date">${esc(q.date)}</span></figcaption></figure>`).join("")}</div><div class="center reveal" style="margin-top:2.2rem;display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="${href(s.button1_link)}">${esc(s.button1_label)}</a><a class="btn btn-ghost" href="${href(s.button2_link)}">${esc(s.button2_label)}</a></div>`;
  },
  closing: (d) => {
    const s = d.closing || {};
    return `<h2>${esc(s.heading)}</h2><p>${esc(s.text)}</p><a class="btn btn-gold" href="${href(s.button_link)}">${esc(s.button_label)}</a>`;
  },
};

function main() {
  if (!existsSync(HOME_YML) || !existsSync(INDEX)) return;
  let data = {};
  try { data = yaml.load(readFileSync(HOME_YML, "utf8"), { schema: yaml.CORE_SCHEMA }) || {}; }
  catch (e) { console.warn("[build-home] could not read content/home.yml, homepage left as it is: " + e.message); return; }

  const raw = readFileSync(INDEX, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  let html = raw.replace(/\r\n/g, "\n");
  let changed = 0;
  for (const [name, render] of Object.entries(regions)) {
    const re = new RegExp(`(<!-- cs-home:${name} -->)[\\s\\S]*?(<!-- /cs-home:${name} -->)`);
    if (!re.test(html)) { console.warn(`[build-home] marker "${name}" not found in index.html, skipped.`); continue; }
    const out = render(data);
    html = html.replace(re, (_m, a, b) => a + out + b);
    changed++;
  }
  const finalHtml = html.replace(/\n/g, eol);
  if (finalHtml !== raw) writeFileSync(INDEX, finalHtml);
  console.log(`[build-home] Updated /index.html (${changed} regions from content/home.yml)`);
}

main();
