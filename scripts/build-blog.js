// Turns content/blog/*.md (written through the Blog Posts editor at /editor-preview/admin)
// into real, fully-styled blog post pages on the live site, and lists them on blog.html +
// sitemap.xml. Mirrors build-articles.js's pattern exactly, adapted for blog.html's own
// card/word-cloud/archive layout and category taxonomy (different from Guest Articles' own).
// Runs automatically on every Netlify deploy (see package.json build command). Safe to run
// with an empty content/blog/ folder -- it just does nothing.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const BLOCK_TAGS = ["p", "br", "strong", "em", "b", "i", "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "code", "pre", "img"];
const BLOCK_ATTRS = { a: ["href", "title", "target", "rel"], img: ["src", "alt", "title"] };
const SAFE_SCHEMES = ["http", "https", "mailto"];
function mdBlock(s) {
  return sanitizeHtml(marked.parse(String(s || "").trim()), { allowedTags: BLOCK_TAGS, allowedAttributes: BLOCK_ATTRS, allowedSchemes: SAFE_SCHEMES });
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = join(ROOT, "content", "blog");
const BLOG_HTML = join(ROOT, "blog.html");
const SITEMAP = join(ROOT, "sitemap.xml");
const GENERATED_MARKER = "<!-- cs-generated:blog -->";

// Same 8 categories blog.html's toolbar/word-cloud already use -- kept fixed rather than
// free-text so a typo in the CMS can't silently create an unfiltered ninth category.
const CATEGORIES = ["Psychic Readings", "Numerology", "Other World", "Predicting Dates or Timelines", "Gypsy Scams", "Tarot Card Readings", "Online Psychic Readings", "Karma & Past Lives"];

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    data[kv[1]] = val;
  }
  return { data, body: m[2] };
}

function plainExcerpt(md, len = 140) {
  const text = md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
  return text.length > len ? text.slice(0, len).replace(/\s+\S*$/, "") + "…" : text;
}

function renderPage({ slug, title, category, author, image, date, bodyHtml, description }) {
  const url = `https://cherrysage.com/${slug}.html`;
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
<title>${esc(title)} — Cherry Sage</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Cherry Sage">
<meta property="og:title" content="${esc(title)} — Cherry Sage">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://cherrysage.com${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)} — Cherry Sage">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="https://cherrysage.com${image}">
<meta name="theme-color" content="#6E1A28">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css?v=45">
<link rel="icon" href="assets/favicon.ico?v=2" sizes="any">
<link rel="icon" href="assets/icon-32.png?v=2" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/icon-180.png?v=2">
<script type="application/ld+json">{"@context": "https://schema.org", "@graph": [{"@type": ["ProfessionalService", "Organization"], "@id": "https://cherrysage.com/#org", "name": "Cherry Sage", "url": "https://cherrysage.com/", "description": "Honest, accurate psychic, tarot, and numerology readings by phone since 1999.", "logo": "https://cherrysage.com/assets/logo.png", "image": "https://cherrysage.com/assets/bev_portrait.jpg", "founder": {"@type": "Person", "name": "Cherry Sage"}, "foundingDate": "1999", "areaServed": "Worldwide", "priceRange": "$$", "sameAs": ["https://cherrysage.com"], "aggregateRating": {"@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "390", "bestRating": "5"}}, {"@type": "WebSite", "@id": "https://cherrysage.com/#website", "url": "https://cherrysage.com/", "name": "Cherry Sage", "publisher": {"@id": "https://cherrysage.com/#org"}, "potentialAction": {"@type": "SearchAction", "target": "https://cherrysage.com/blog.html?q={search_term_string}", "query-input": "required name=search_term_string"}}]}</script>
<script type="application/ld+json">{"@context": "https://schema.org", "@type": "Article", "headline": "${esc(title)}", "description": "${esc(description)}", "image": ["https://cherrysage.com${image}"], "datePublished": "${date}T12:00:00", "dateModified": "${date}T12:00:00", "articleSection": "${esc(category)}", "author": {"@type": "Person", "name": "${esc(author || "Cherry Sage")}"}, "publisher": {"@type": "Organization", "name": "Cherry Sage", "logo": {"@type": "ImageObject", "url": "https://cherrysage.com/assets/logo.png"}}, "mainEntityOfPage": {"@type": "WebPage", "@id": "${url}"}}</script><script type="application/ld+json">{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://cherrysage.com/"}, {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://cherrysage.com/blog.html"}, {"@type": "ListItem", "position": 3, "name": "${esc(title)}"}]}</script>
</head>
<body>
<header class="site-header">
  <div class="wrap nav-row">
    <a class="brand" href="/" aria-label="Cherry Sage home"><img src="assets/logo-horizontal.png" alt="Cherry Sage — Psychic, Tarot, Numerology"></a>
    <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">&#9776;</button>
    <nav class="primary-nav" id="primaryNav" aria-label="Primary">
      <ul><li><a href="/meet">Meet Cherry</a></li><li class="has-dropdown"><a href="/psychic-reading">Readings</a><ul class="dropdown"><li><a href="/psychic-reading">Psychic Reading</a></li><li><a href="/tarot">Tarot Card Reading</a></li><li><a href="/book-appointment">Request a Time</a></li></ul></li><li class="has-dropdown"><a href="/numerology">Numerology</a><ul class="dropdown"><li><a href="/free-karmic-reading">Free Numerology Reading</a></li></ul></li><li class="has-dropdown"><a href="/testimonials">Reviews</a><ul class="dropdown"><li><a href="/feedback">Leave Feedback</a></li></ul></li><li class="has-dropdown"><a href="/blog">Blog</a><ul class="dropdown"><li><a href="/articles">Guest Articles</a></li></ul></li><li class="has-dropdown"><a href="/tarot-pull">Free Tools</a><ul class="dropdown"><li><a href="/tarot-pull">Free Tarot Pull</a></li><li><a href="/tarot-spread">Free Tarot Spread</a></li><li><a href="/life-path">Life Path Calculator</a></li><li><a href="/horoscope">Daily Horoscope</a></li></ul></li><li><a href="/shop">Shop</a></li><li><a href="/contact">Contact</a></li><li><a href="/account" class="nav-utility">My Account</a></li></ul>
      <a class="btn btn-primary" href="/book-appointment">Book a Reading</a>
    </nav>
  </div>
</header>
<main>
<section class="page-hero post-head"><div class="ph-glow" aria-hidden="true"></div><div class="wrap reveal"><p class="eyebrow">${byline}${esc(category)}</p><h1>${esc(title)}</h1></div></section>
<section class="section"><div class="wrap post-wrap">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span class="bc-sep">›</span><a href='/blog'>Blog</a><span class="bc-sep">›</span><span aria-current="page">${esc(category)}</span></nav>
  <img class="post-hero-img" src="${image}" alt="${esc(title)}">
  <article class="post-content reveal">${bodyHtml}</article>
  <div class="post-cta reveal"><p class="eyebrow">Ready for the real thing?</p><h3>Talk it through with Cherry</h3><p>An honest reading goes far beyond an article. First-timers get 10 minutes for $24.</p><a class='btn btn-primary' href='/book-appointment'>Book a Reading</a></div>
</div></section>
<section class="section cs-comments"><div class="wrap"><div id="csComments" data-post-title="${esc(title)}"></div></div></section>
</main>
<footer class="footer">
  <div class="wrap footer-grid">
    <div>
      <div class="footer-brand"><img src="assets/mark-clean.png" alt=""><span>Cherry Sage</span></div>
      <p style="font-size:.9rem">Honest, accurate psychic, tarot, and numerology readings by phone. Trusted since 1999.</p>
    </div>
    <div><h4>Readings</h4><ul><li><a href='/psychic-reading'>Psychic Reading</a></li><li><a href='/tarot'>Tarot Card Reading</a></li><li><a href='/numerology'>Numerology</a></li><li><a href='/how-it-works'>How It Works</a></li></ul></div>
    <div><h4>Explore</h4><ul><li><a href='/meet'>Meet Cherry</a></li><li><a href='/blog'>Blog</a></li><li><a href='/articles'>Guest Articles</a></li><li><a href='/testimonials'>Testimonials</a></li><li><a href='/policies'>Policies</a></li></ul></div>
    <div><h4>Free</h4><ul><li><a href='/tarot-pull'>Free Tarot Pull</a></li><li><a href='/tarot-spread'>Free Tarot Spread</a></li><li><a href='/life-path'>Life Path Calculator</a></li><li><a href='/free-karmic-reading'>Karmic Accumulation</a></li><li><a href='/horoscope'>Daily Horoscope</a></li><li><a href='/feedback'>Leave Feedback</a></li></ul></div>
  </div>
  <div class="wrap footer-signup"><h4>Cherry's Newsletter</h4><p class="nl-lede">Honest insight on the psychic path, numerology, and tarot, straight to your inbox. No spam, unsubscribe any time.</p><form class="nl-form" novalidate><input type="email" placeholder="Your email" aria-label="Your email address" required><button type="submit">Subscribe</button></form><p class="nl-note" aria-live="polite"></p></div>
  <div class="wrap footer-bottom">© Cherry Sage. Serving clients worldwide since 1999. · Site by Balay ni Bruno &amp; Co.</div>
</footer>
<div class="chat-widget" id="chatWidget" role="button" tabindex="0" aria-label="Chat with Ivy, Cherry's assistant — click to open">
  <span class="cw-hint" id="cwHint">Click to chat with Ivy</span>
  <span class="cw-status" title="Cherry is Online"><span class="status-dot"></span>Chat with Ivy</span>
  <span class="cw-bubble"><img src="assets/mark-clean.png" alt=""></span>
</div>
<script src="app.js?v=9"></script>
<script src="embers.js?v=4"></script>
<script src="magic.js?v=2"></script>
<script src="funnel.js?v=8"></script>
<script src="chat.js?v=7"></script>
<script src="status.js?v=1"></script>
<script src="comments.js?v=1"></script>
</body>
</html>
`;
}

function upsertCard(html, { slug, title, category, image, date, excerpt, isNew }) {
  const ym = date.slice(0, 7);
  const cardRe = new RegExp(`<a class='bcard reveal' data-cat='[^']*' data-ym='[^']*' href='/${slug}'>[\\s\\S]*?</a>`);
  const newCard = `<a class='bcard reveal' data-cat='${esc(category)}' data-ym='${ym}' href='/${slug}'>\n  <img class="bc-img" src="${image}" alt="" loading="lazy" decoding="async">\n  <div class="bc-body"><span class="cat-chip">${esc(category)}</span><h3>${esc(title)}</h3><p>${esc(excerpt)}</p><span class="bc-date">${date}</span></div>\n</a>`;

  if (cardRe.test(html)) return { html: html.replace(cardRe, newCard), added: false };
  if (!isNew) return { html, added: false };
  return { html: html.replace('<div class="blog-cards">', `<div class="blog-cards">${newCard}`), added: true, ym };
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
  return html.replace('<ul class="archive-list">', `<ul class="archive-list">${newItem}`);
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

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const raw = readFileSync(join(CONTENT_DIR, file), "utf8");
    const { data, body } = parseFrontMatter(raw);

    if (!data.title || !data.category || !data.image || !data.date) {
      console.warn(`[build-blog] Skipping ${file}: missing title, category, image, or date.`);
      continue;
    }
    if (!CATEGORIES.includes(data.category)) {
      console.warn(`[build-blog] Skipping ${file}: "${data.category}" isn't one of blog.html's real categories.`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      console.warn(`[build-blog] Skipping ${file}: date must be YYYY-MM-DD.`);
      continue;
    }

    const outPath = join(ROOT, `${slug}.html`);
    if (existsSync(outPath)) {
      const existing = readFileSync(outPath, "utf8");
      if (!existing.includes(GENERATED_MARKER)) {
        console.warn(`[build-blog] Skipping ${file}: /${slug}.html already exists and was not created by this pipeline.`);
        continue;
      }
    }

    const isNew = !existsSync(outPath);
    const bodyHtml = mdBlock(body);
    const description = plainExcerpt(body);

    const page = renderPage({ slug, title: data.title, category: data.category, author: data.author, image: data.image, date: data.date, bodyHtml, description });
    writeFileSync(outPath, page);
    changed = true;

    const result = upsertCard(blogHtml, { slug, title: data.title, category: data.category, image: data.image, date: data.date, excerpt: description, isNew });
    blogHtml = result.html;
    if (result.added) {
      blogHtml = bumpWordCloud(blogHtml, data.category);
      blogHtml = upsertArchive(blogHtml, result.ym);
      addToSitemap(slug);
    }
    console.log(`[build-blog] ${isNew ? "Published" : "Updated"} /${slug}.html (${data.category})`);
  }

  if (changed) writeFileSync(BLOG_HTML, blogHtml);
}

main();
