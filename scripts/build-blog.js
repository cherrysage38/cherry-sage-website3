// Turns content/blog/*.md (written through the Blog Posts editor at /editor-preview/admin)
// into real, fully-styled blog post pages on the live site, and lists them on blog.html +
// sitemap.xml. Mirrors build-articles.js's pattern exactly, adapted for blog.html's own
// card/word-cloud/archive layout and category taxonomy (different from Guest Articles' own).
// Runs automatically on every Netlify deploy (see package.json build command). Safe to run
// with an empty content/blog/ folder -- it just does nothing.
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import yaml from "js-yaml";
import { loadFooterData, renderFooter } from "./footer.js";

const FOOTER_DATA = loadFooterData();

const BLOCK_TAGS = ["p", "br", "strong", "em", "b", "i", "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "h5", "code", "pre", "img", "iframe", "hr"];
const BLOCK_ATTRS = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  iframe: ["src", "width", "height", "title", "allowfullscreen", "frameborder"],
};
const SAFE_SCHEMES = ["http", "https", "mailto"];
// Only video players from these hosts may be embedded; anything else is stripped.
const EMBED_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"];
// Plain-text web addresses stay plain text (the old WordPress posts did not link them); links are made
// deliberately with the editor's link button.
marked.use({ tokenizer: { url() { return undefined; } } });
function mdBlock(s) {
  return sanitizeHtml(marked.parse(String(s || "").trim()), {
    allowedTags: BLOCK_TAGS, allowedAttributes: BLOCK_ATTRS, allowedSchemes: SAFE_SCHEMES,
    allowedIframeHostnames: EMBED_HOSTS,
    // Links to other sites open in a new tab, like the original WordPress posts did.
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        if (/^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?cherrysage\.com/i.test(href)) {
          return { tagName, attribs: { ...attribs, target: "_blank", rel: "noopener" } };
        }
        return { tagName, attribs };
      },
    },
  });
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = join(ROOT, "content", "blog");
const BLOG_HTML = join(ROOT, "blog.html");
const SITEMAP = join(ROOT, "sitemap.xml");
// JSON-LD is JSON, not HTML: escape for JSON only, so & stays & (not &amp;).
const jstr = (s) => JSON.stringify(String(s || "")).slice(1, -1);
const isPostPage = (html) => html.includes('"@type": "Article"');
const GENERATED_MARKER = "<!-- cs-generated:blog -->";

// Same 8 categories blog.html's toolbar/word-cloud already use -- kept fixed rather than
// free-text so a typo in the CMS can't silently create an unfiltered ninth category.
const CATEGORIES = ["Psychic Readings", "Numerology", "Other World", "Predicting Dates or Timelines", "Gypsy Scams", "Tarot Card Readings", "Online Psychic Readings", "Karma & Past Lives", "Featured Articles", "Astrology", "Dreams"];

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  // Real YAML (the editor writes quotes and colons safely). CORE_SCHEMA keeps dates as plain text.
  let data = {};
  try { data = yaml.load(m[1], { schema: yaml.CORE_SCHEMA }) || {}; } catch (e) { console.warn("[front matter] " + e.message); }
  for (const k of Object.keys(data)) data[k] = data[k] == null ? "" : String(data[k]);
  return { data, body: m[2] };
}

function plainExcerpt(md, len = 140) {
  const text = md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
  return text.length > len ? text.slice(0, len).replace(/\s+\S*$/, "") + "…" : text;
}

function renderPage({ slug, title, category, author, image, date, bodyHtml, description, seoTitle, relatedHtml }) {
  const url = `https://cherrysage.com/${slug}.html`;
  const pageTitle = seoTitle || `${title} — Cherry Sage`;
  const byline = author ? `By ${esc(author)} · ` : "";
  return `<!doctype html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-J6XYLLVE93"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-J6XYLLVE93');
</script>
${GENERATED_MARKER}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Cherry Sage">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://cherrysage.com${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="https://cherrysage.com${image}">
<meta name="theme-color" content="#6E1A28">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css?v=50">
<link rel="icon" href="assets/favicon.ico?v=2" sizes="any">
<link rel="icon" href="assets/icon-32.png?v=2" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/icon-180.png?v=2">
<script type="application/ld+json">{"@context": "https://schema.org", "@graph": [{"@type": ["ProfessionalService", "Organization"], "@id": "https://cherrysage.com/#org", "name": "Cherry Sage", "url": "https://cherrysage.com/", "description": "Honest, accurate psychic, tarot, and numerology readings by phone since 1999.", "logo": "https://cherrysage.com/assets/logo.png", "image": "https://cherrysage.com/assets/bev_portrait.jpg", "founder": {"@type": "Person", "name": "Cherry Sage"}, "foundingDate": "1999", "areaServed": "Worldwide", "priceRange": "$$", "sameAs": ["https://cherrysage.com"], "aggregateRating": {"@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "390", "bestRating": "5"}}, {"@type": "WebSite", "@id": "https://cherrysage.com/#website", "url": "https://cherrysage.com/", "name": "Cherry Sage", "publisher": {"@id": "https://cherrysage.com/#org"}, "potentialAction": {"@type": "SearchAction", "target": "https://cherrysage.com/blog.html?q={search_term_string}", "query-input": "required name=search_term_string"}}]}</script>
<script type="application/ld+json">{"@context": "https://schema.org", "@type": "Article", "headline": "${jstr(title)}", "description": "${jstr(description)}", "image": ["https://cherrysage.com${image}"], "datePublished": "${date}T12:00:00", "dateModified": "${date}T12:00:00", "articleSection": "${jstr(category)}", "author": {"@type": "Person", "name": "${jstr(author || "Cherry Sage")}"}, "publisher": {"@type": "Organization", "name": "Cherry Sage", "logo": {"@type": "ImageObject", "url": "https://cherrysage.com/assets/logo.png"}}, "mainEntityOfPage": {"@type": "WebPage", "@id": "${url}"}}</script><script type="application/ld+json">{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://cherrysage.com/"}, {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://cherrysage.com/blog.html"}, {"@type": "ListItem", "position": 3, "name": "${jstr(title)}"}]}</script>
</head>
<body>
<header class="site-header">
  <div class="wrap nav-row">
    <a class="brand" href="/" aria-label="Cherry Sage home"><img src="assets/logo-horizontal.png" alt="Cherry Sage — Psychic, Tarot, Numerology"></a>
    <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">&#9776;</button>
    <nav class="primary-nav" id="primaryNav" aria-label="Primary">
      <ul><li class="has-dropdown"><a href="/meet">About</a><ul class="dropdown"><li><a href="/meet">Meet Cherry</a></li><li><a href="/how-it-works">How It Works</a></li><li><a href="/faqs">FAQs</a></li></ul></li><li class="has-dropdown"><a href="/psychic-reading">Readings</a><ul class="dropdown"><li><a href="/psychic-reading">Psychic Reading</a></li><li><a href="/top-rated-psychic-readings">Top Rated Psychic Readings</a></li><li><a href="/real-and-genuine-psychic-readings">Real and Genuine Psychic Readings</a></li><li><a href="/specialized-psychic-readings">Specialized Psychic Readings</a></li><li><a href="/trustworthy-accurate-psychic-readings">Trustworthy Accurate Psychic Readings</a></li><li><a href="/tarot">Tarot Card Reading</a></li><li><a href="/compatibility">Compatibility</a></li><li><a href="/book-appointment">Request a Time</a></li></ul></li><li class="has-dropdown"><a href="/numerology">Numerology</a><ul class="dropdown"><li><a href="/free-karmic-reading">Free Numerology Reading</a></li><li><a href="/life-path-number-meanings">Life Path Number Meanings</a></li><li><a href="/basic-number-meanings">Basic Number Meanings</a></li><li><a href="/expression-number">Expression Number</a></li><li><a href="/soul-urge-number">Soul Urge Number</a></li><li><a href="/birthday-number">Birthday Number</a></li><li><a href="/karmic-lessons">Karmic Lessons</a></li><li><a href="/karmic-debts">Karmic Debts</a></li></ul></li><li class="has-dropdown"><a href="/testimonials">Reviews</a><ul class="dropdown"><li><a href="/feedback">Leave Feedback</a></li></ul></li><li class="has-dropdown"><a href="/blog">Blog</a><ul class="dropdown"><li><a href="/articles">Guest Articles</a></li></ul></li><li class="has-dropdown"><a href="/tarot-pull">Free Tools</a><ul class="dropdown"><li><a href="/tarot-pull">Free Tarot Pull</a></li><li><a href="/tarot-spread">Free Tarot Spread</a></li><li><a href="/life-path">Life Path Calculator</a></li><li><a href="/horoscope">Daily Horoscope</a></li></ul></li><li><a href="/shop">Shop</a></li><li><a href="/contact">Contact</a></li><li><a href="/account" class="nav-utility">My Account</a></li></ul>
      <a class="btn btn-primary" href="/checkout-appointment">Book a Reading</a>
    </nav>
  </div>
</header>
<main>
<section class="page-hero post-head"><div class="ph-glow" aria-hidden="true"></div><div class="wrap reveal"><p class="eyebrow">${byline}${esc(category)} · ${esc(date)}</p><h1>${esc(title)}</h1></div></section>
<section class="section"><div class="wrap post-wrap">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span class="bc-sep">›</span><a href='/blog'>Blog</a><span class="bc-sep">›</span><span aria-current="page">${esc(category)}</span></nav>
  <img class="post-hero-img" src="${image}" alt="${esc(title)}">
  <article class="post-content reveal">${bodyHtml}</article>
  <div class="post-cta reveal"><p class="eyebrow">Ready for the real thing?</p><h3>Talk it through with Cherry</h3><p>An honest reading goes far beyond an article. First-timers get 10 minutes for $24.</p><a class='btn btn-primary' href='/checkout-appointment'>Book a Reading</a></div>
</div></section>
${relatedHtml}<section class="section cs-comments"><div class="wrap"><div id="csComments" data-post-title="${esc(title)}"></div></div></section>
</main>
${renderFooter(FOOTER_DATA)}
<div class="chat-widget" id="chatWidget" role="button" tabindex="0" aria-label="Chat with Ivy, Cherry's assistant — click to open">
  <span class="cw-hint" id="cwHint">Click to chat with Ivy</span>
  <span class="cw-status" title="Cherry is Online"><span class="status-dot"></span>Chat with Ivy</span>
  <span class="cw-bubble"><img src="assets/mark-clean.png" alt=""></span>
</div>
<script src="app.js?v=12"></script>
<script src="embers.js?v=4"></script>
<script src="magic.js?v=2"></script>
<script src="funnel.js?v=11"></script>
<script src="chat.js?v=8"></script>
<script src="status.js?v=3"></script>
<script src="/assets/vendor/supabase.js?v=2116"></script>
<script src="comments.js?v=1"></script>
</body>
</html>
`;
}

// "Keep reading": up to 3 newest other posts in the same category. A post can switch it off
// with related: false in its front matter.
function relatedSection(post, all) {
  if (post.related === "false") return "";
  const same = all.filter((p) => p.slug !== post.slug && p.category === post.category)
    .sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug)).slice(0, 3);
  if (!same.length) return "";
  const cards = same.map((p) => `<a class='bcard reveal' href='/${p.slug}'><div class="bc-img" style="background-image:url('${p.image}')"></div><div class="bc-body"><span class="cat-chip">${esc(p.category)}</span><h3>${esc(p.title)}</h3></div></a>`).join("");
  return `<section class="section section-tint"><div class="wrap"><div class="section-head reveal"><p class="eyebrow">Keep reading</p><h2>More on ${esc(post.category)}</h2></div><div class="blog-cards">${cards}</div></div></section>\n`;
}

const CARD_RE = /<a class='bcard reveal' data-cat='[^']*' data-ym='[^']*' href='\/([^']*)'>[\s\S]*?<span class="bc-date">(\d{4}-\d{2}-\d{2})<\/span><\/div>\n<\/a>/g;
// Every post gets a card, not only brand-new ones: 12 older posts (Featured Articles, Astrology,
// Dreams) had pages but were never listed on blog.html (found 2026-10-03). A missing card is put
// in date order among the others, which blog.html lists newest first.
function upsertCard(html, { slug, title, category, image, date, excerpt }) {
  const ym = date.slice(0, 7);
  const cardRe = new RegExp(`<a class='bcard reveal' data-cat='[^']*' data-ym='[^']*' href='/${slug}'>[\\s\\S]*?</a>`);
  const newCard = `<a class='bcard reveal' data-cat='${esc(category)}' data-ym='${ym}' href='/${slug}'>\n  <img class="bc-img" src="${image}" alt="" loading="lazy" decoding="async">\n  <div class="bc-body"><span class="cat-chip">${esc(category)}</span><h3>${esc(title)}</h3><p>${esc(excerpt)}</p><span class="bc-date">${date}</span></div>\n</a>`;

  if (cardRe.test(html)) return { html: html.replace(cardRe, newCard), added: false };
  const listStart = html.indexOf('<div class="blog-cards">') + '<div class="blog-cards">'.length;
  let at = listStart;
  for (const m of html.slice(listStart).matchAll(CARD_RE)) {
    if (m[2] + m[1] < date + slug) { at = listStart + m.index; break; }
    at = listStart + m.index + m[0].length;
  }
  return { html: html.slice(0, at) + newCard + html.slice(at), added: true, ym };
}

// The "Latest" feature at the top of blog.html was only ever set by hand, so it stayed on a May 2025
// post however many new ones Bev published (found 2026-09-29). Point it at the newest post, unless
// the one already featured is newer (the older posts not written in the editor aren't in content/blog).
const FEATURED_RE = /<a class='blog-featured reveal' href='\/[^']*'>[\s\S]*?<\/a>/;
function upsertFeatured(html, { slug, title, category, image, date, excerpt }, hiddenSlugs) {
  const current = html.match(FEATURED_RE);
  if (!current) return html;
  const curSlug = (current[0].match(/href='\/([^']*)'/) || [])[1] || "";
  const curDate = (current[0].match(/<span class="bc-date">(\d{4}-\d{2}-\d{2})<\/span>/) || [])[1] || "";
  if (curDate > date && !hiddenSlugs.has(curSlug)) return html;
  const block = `<a class='blog-featured reveal' href='/${slug}'>\n  <div class="bf-img" style="background-image:url('${image}')"></div>\n  <div class="bf-body"><span class="cat-chip">Latest · ${esc(category)}</span><h2>${esc(title)}</h2><span class="bc-date">${date}</span><p style="color:var(--ink-soft)">${esc(excerpt)}</p><span class="card-link">Read the post →</span></div>\n</a>`;
  return html.replace(FEATURED_RE, () => block);
}

// Adds a topic's button to the toolbar and the "Browse by topic" cloud when blog.html doesn't have one
// yet, so its posts can be filtered like the rest. Returns null when the topic is already there.
function addTopic(html, category) {
  const f = esc(category);
  if (html.includes(`data-f="${f}"`)) return null;
  const chipsEnd = html.indexOf("</div>", html.indexOf('<div class="bchips">'));
  html = html.slice(0, chipsEnd) + `<button class="bchip" data-f="${f}">${f}</button>` + html.slice(chipsEnd);
  const cloudEnd = html.indexOf("</div>", html.indexOf('<div class="wordcloud">'));
  return html.slice(0, cloudEnd) + `<button class="wc-tag" data-f="${f}" style="font-size:0.87rem">${f}<span class="wc-n">0</span></button>` + html.slice(cloudEnd);
}

// Once counts are final: size the newly added cloud topics like the others (about 0.82rem plus
// 0.05rem per post) and keep the cloud ordered biggest first.
function tidyWordCloud(html, added) {
  const start = html.indexOf('<div class="wordcloud">') + '<div class="wordcloud">'.length;
  const end = html.indexOf("</div>", start);
  const tags = html.slice(start, end).match(/<button class="wc-tag"[\s\S]*?<\/button>/g) || [];
  const sized = tags.map((t) => {
    const f = (t.match(/data-f="([^"]*)"/) || [])[1];
    const n = parseInt((t.match(/<span class="wc-n">(\d+)/) || [])[1] || "0", 10);
    const tag = added.has(f) ? t.replace(/font-size:[\d.]+rem/, `font-size:${(0.82 + 0.05 * n).toFixed(2)}rem`) : t;
    return { n, tag };
  });
  sized.sort((a, b) => b.n - a.n);
  return html.slice(0, start) + sized.map((x) => x.tag).join("") + html.slice(end);
}

function bumpWordCloud(html, category) {
  // The button's own visible text (the category name again) sits between the opening tag
  // and the count span, e.g. ...data-f="Numerology" style="...">Numerology<span class="wc-n">8</span>
  const tagRe = new RegExp(`(data-f="${category.replace(/&/g, "&amp;")}"[^>]*>[^<]*<span class="wc-n">)(\\d+)(</span>)`);
  return html.replace(tagRe, (m, a, n, b) => `${a}${parseInt(n, 10) + 1}${b}`);
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function upsertArchive(html, ym) {
  const itemRe = new RegExp(`(<button class="arch-item" data-ym="${ym}">[^<]*<span>\\()(\\d+)(\\)</span></button>)`);
  if (itemRe.test(html)) return html.replace(itemRe, (m, a, n, b) => `${a}${parseInt(n, 10) + 1}${b}`);
  const [y, mo] = ym.split("-");
  const label = `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
  const newItem = `<li><button class="arch-item" data-ym="${ym}">${label}<span>(1)</span></button></li>`;
  // The archive is newest month first; put an older month in its place rather than at the top.
  const listStart = html.indexOf('<ul class="archive-list">') + '<ul class="archive-list">'.length;
  const listEnd = html.indexOf("</ul>", listStart);
  let at = listEnd;
  for (const m of html.slice(listStart, listEnd).matchAll(/<li><button class="arch-item" data-ym="(\d{4}-\d{2})">/g)) {
    if (m[1] < ym) { at = listStart + m.index; break; }
  }
  return html.slice(0, at) + newItem + html.slice(at);
}

// "Hide from site": take a post off the live site without deleting what was written. Removes its
// page, its blog.html card (and the counts that card added) and its sitemap entry. Unticking it
// brings everything back on the next build, because the page and card are rebuilt from the .md.
function removeCard(html, slug) {
  const cardRe = new RegExp(`<a class='bcard reveal' data-cat='([^']*)' data-ym='([^']*)' href='/${slug}'>[\\s\\S]*?</a>`);
  const m = html.match(cardRe);
  if (!m) return html;
  html = html.replace(cardRe, "");
  // data-cat is written escaped (&amp;), which is how the word cloud's data-f is written too.
  const tagRe = new RegExp(`(data-f="${m[1]}"[^>]*>[^<]*<span class="wc-n">)(\\d+)(</span>)`);
  html = html.replace(tagRe, (x, a, n, b) => `${a}${Math.max(0, parseInt(n, 10) - 1)}${b}`);
  const itemRe = new RegExp(`<li><button class="arch-item" data-ym="${m[2]}">([^<]*)<span>\\((\\d+)\\)</span></button></li>`);
  return html.replace(itemRe, (x, label, n) => (parseInt(n, 10) <= 1 ? "" : `<li><button class="arch-item" data-ym="${m[2]}">${label}<span>(${parseInt(n, 10) - 1})</span></button></li>`));
}

function removeFromSitemap(slug) {
  const xml = readFileSync(SITEMAP, "utf8");
  const entryRe = new RegExp(`[ \\t]*<url><loc>https://cherrysage\\.com/${slug}\\.html</loc>[\\s\\S]*?</url>\\n?`);
  if (entryRe.test(xml)) writeFileSync(SITEMAP, xml.replace(entryRe, ""));
}

function hidePost(slug, html) {
  const outPath = join(ROOT, `${slug}.html`);
  // Only ever delete a page this script made, never a hand-built page that shares the name.
  if (existsSync(outPath)) {
    const existing = readFileSync(outPath, "utf8");
    if (existing.includes(GENERATED_MARKER) || isPostPage(existing)) unlinkSync(outPath);
  }
  removeFromSitemap(slug);
  return removeCard(html, slug);
}

function addToSitemap(slug) {
  let xml = readFileSync(SITEMAP, "utf8");
  const url = `https://cherrysage.com/${slug}.html`;
  if (xml.includes(`<loc>${url}</loc>`)) return;
  const today = new Date().toISOString().slice(0, 10);
  xml = xml.replace("</urlset>", `  <url><loc>${url}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>\n</urlset>`);
  writeFileSync(SITEMAP, xml);
}

function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.log("[build-blog] No content/blog folder — nothing to build.");
    return;
  }
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.log("[build-blog] No blog drafts found — nothing to build.");
    return;
  }

  let blogHtml = readFileSync(BLOG_HTML, "utf8");
  let changed = false;
  let newest = null;
  const hiddenSlugs = new Set();
  const addedTopics = new Set();

  // First pass: read every post so each page can link to its category neighbours.
  const all = [];
  for (const file of files) {
    const { data } = parseFrontMatter(readFileSync(join(CONTENT_DIR, file), "utf8"));
    if (data.hidden === "true") continue;
    if (data.title && data.category && data.image && data.date) all.push({ slug: file.replace(/\.md$/, ""), title: data.title, category: data.category, image: data.image, date: String(data.date).slice(0, 10), related: data.related });
  }

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const raw = readFileSync(join(CONTENT_DIR, file), "utf8");
    const { data, body } = parseFrontMatter(raw);

    if (data.hidden === "true") {
      hiddenSlugs.add(slug);
      blogHtml = hidePost(slug, blogHtml);
      changed = true;
      console.log(`[build-blog] Hidden /${slug}.html (Hide from site is ticked)`);
      continue;
    }

    if (!data.title || !data.category || !data.image || !data.date) {
      console.warn(`[build-blog] Skipping ${file}: missing title, category, image, or date.`);
      continue;
    }
    if (!CATEGORIES.includes(data.category)) {
      console.warn(`[build-blog] Skipping ${file}: "${data.category}" isn't one of blog.html's real categories.`);
      continue;
    }
    // The editor's date widget can write a full timestamp depending on version/settings; only the day matters.
    data.date = String(data.date).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      console.warn(`[build-blog] Skipping ${file}: date must be YYYY-MM-DD.`);
      continue;
    }

    const outPath = join(ROOT, `${slug}.html`);
    if (existsSync(outPath)) {
      const existing = readFileSync(outPath, "utf8");
      if (!existing.includes(GENERATED_MARKER) && !isPostPage(existing)) {
        console.warn(`[build-blog] Skipping ${file}: /${slug}.html already exists and is not a post page.`);
        continue;
      }
    }

    const isNew = !existsSync(outPath);
    const bodyHtml = mdBlock(body);
    const description = data.description || plainExcerpt(body);

    const page = renderPage({ slug, title: data.title, category: data.category, author: data.author, image: data.image, date: data.date, bodyHtml, description, seoTitle: data.seo_title, relatedHtml: relatedSection({ slug, category: data.category, related: data.related }, all) });
    writeFileSync(outPath, page);
    changed = true;

    const result = upsertCard(blogHtml, { slug, title: data.title, category: data.category, image: data.image, date: data.date, excerpt: plainExcerpt(body) });
    blogHtml = result.html;
    if (result.added) {
      const withTopic = addTopic(blogHtml, data.category);
      if (withTopic) { blogHtml = withTopic; addedTopics.add(esc(data.category)); }
      blogHtml = bumpWordCloud(blogHtml, data.category);
      blogHtml = upsertArchive(blogHtml, result.ym);
      addToSitemap(slug);
    }
    if (!newest || (data.date + slug) > (newest.date + newest.slug)) {
      newest = { slug, title: data.title, category: data.category, image: data.image, date: data.date, excerpt: plainExcerpt(body, 120) };
    }
    console.log(`[build-blog] ${isNew ? "Published" : "Updated"} /${slug}.html (${data.category})`);
  }

  // A post deleted in the editor leaves its old page behind; take it down like a hidden one.
  const slugs = new Set(files.map((f) => f.replace(/\.md$/, "")));
  for (const page of readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
    const slug = page.replace(/\.html$/, "");
    if (slugs.has(slug) || !readFileSync(join(ROOT, page), "utf8").includes(GENERATED_MARKER)) continue;
    hiddenSlugs.add(slug);
    blogHtml = hidePost(slug, blogHtml);
    changed = true;
    console.log(`[build-blog] Removed /${slug}.html (its post was deleted in the editor)`);
  }

  if (addedTopics.size) blogHtml = tidyWordCloud(blogHtml, addedTopics);
  if (newest) blogHtml = upsertFeatured(blogHtml, newest, hiddenSlugs);
  if (changed) writeFileSync(BLOG_HTML, blogHtml);
}

main();
