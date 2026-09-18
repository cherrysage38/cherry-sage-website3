// Turns content/pages/*.md (written through the Pages editor at /editor-preview/admin)
// into real, fully-styled pages on the live site, and lists them in sitemap.xml.
// Runs automatically on every Netlify deploy (see netlify.toml build command). Safe to run with
// an empty content/pages/ folder — it just does nothing.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import yaml from "js-yaml";
import sanitizeHtml from "sanitize-html";
const { load: loadYaml } = yaml;

// Content here comes from the Pages CMS, which will eventually be editable by anyone with
// login access to it (not just BBC). marked() renders raw HTML straight through with zero
// sanitization by default, so anything typed into a Text/Image+Text field could otherwise land
// on the live site as real, executing markup. Strip it down to a safe prose subset instead.
const BLOCK_TAGS = ["p", "br", "strong", "em", "b", "i", "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "code", "pre", "img"];
const BLOCK_ATTRS = { a: ["href", "title", "target", "rel"], img: ["src", "alt", "title"] };
const SAFE_SCHEMES = ["http", "https", "mailto"];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = join(ROOT, "content", "pages");
const SITEMAP = join(ROOT, "sitemap.xml");
const GENERATED_MARKER = "<!-- cs-generated:pages -->";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  return { data: loadYaml(m[1]) || {}, body: m[2] };
}

function mdBlock(s) {
  // Renders a full markdown body (paragraphs, links, basic formatting) for a Text block.
  const raw = marked.parse(String(s || "").trim());
  return sanitizeHtml(raw, { allowedTags: BLOCK_TAGS, allowedAttributes: BLOCK_ATTRS, allowedSchemes: SAFE_SCHEMES });
}

function renderBlock(block, i) {
  switch (block.type) {
    case "text": {
      const heading = block.heading
        ? `<div class="section-head reveal"><h2>${esc(block.heading)}</h2></div>`
        : "";
      return `<section class="section"><div class="wrap">${heading}<div class="blk-prose reveal">${mdBlock(block.body)}</div></div></section>`;
    }
    case "image_text": {
      const side = block.image_position === "right" ? " right" : "";
      const heading = block.heading ? `<h2>${esc(block.heading)}</h2>` : "";
      const body = esc(block.body).replace(/\n/g, "<br>");
      return `<section class="section"><div class="wrap"><div class="blk-imgtext${side} reveal">
        <div><img src="${esc(block.image)}" alt="${esc(block.heading || "")}"></div>
        <div>${heading}<p>${body}</p></div>
      </div></div></section>`;
    }
    case "quote": {
      const role = block.role ? `<br><span>${esc(block.role)}</span>` : "";
      return `<section class="section section-tint"><div class="wrap"><figure class="blk-quote reveal">
        <blockquote>${esc(block.quote)}</blockquote>
        <figcaption><strong>${esc(block.name)}</strong>${role}</figcaption>
      </figure></div></section>`;
    }
    case "cta_text": {
      const body = block.body ? `<p>${esc(block.body)}</p>` : "";
      return `<section class="section section-dark cta"><div class="wrap reveal"><h2>${esc(block.heading)}</h2>${body}<a class="btn btn-gold" href="${esc(block.button_link || "/book-appointment")}">${esc(block.button_label || "Book a Reading")}</a></div></section>`;
    }
    case "cta_image": {
      return `<a class="img-banner dark" href="${esc(block.link || "/shop")}"><img src="${esc(block.image)}" alt="${esc(block.alt_text || "")}"></a>`;
    }
    case "faq": {
      const items = (block.items || [])
        .map((it) => `<div class="blk-faq-item"><h3>${esc(it.question)}</h3><p>${esc(it.answer)}</p></div>`)
        .join("");
      return `<section class="section"><div class="wrap"><div class="section-head reveal"><h2>${esc(block.heading || "Frequently Asked Questions")}</h2></div><div class="reveal">${items}</div></div></section>`;
    }
    case "gallery": {
      const heading = block.heading ? `<div class="section-head reveal"><h2>${esc(block.heading)}</h2></div>` : "";
      const figs = (block.images || [])
        .map((im) => `<figure><img src="${esc(im.image)}" alt="${esc(im.caption || "")}" loading="lazy">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}</figure>`)
        .join("");
      return `<section class="section section-tint"><div class="wrap">${heading}<div class="blk-gallery reveal">${figs}</div></div></section>`;
    }
    default:
      console.warn(`[build-pages] Unknown block type "${block.type}" at position ${i} — skipped.`);
      return "";
  }
}

function renderPage({ slug, title, description, hero_eyebrow, hero_lede, blocksHtml }) {
  const url = `https://cherrysage.com/${slug}.html`;
  const eyebrow = hero_eyebrow ? `<p class="eyebrow">${esc(hero_eyebrow)}</p>` : "";
  const lede = hero_lede ? `<p class="lede">${esc(hero_lede)}</p>` : "";
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
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cherry Sage">
<meta property="og:title" content="${esc(title)} — Cherry Sage">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta name="theme-color" content="#6E1A28">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css?v=45">
<link rel="icon" href="assets/favicon.ico?v=2" sizes="any">
<link rel="icon" href="assets/icon-32.png?v=2" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/icon-180.png?v=2">
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
<section class="page-hero banner"><div class="ph-glow" aria-hidden="true"></div><div class="ph-stars" aria-hidden="true"></div><div class="wrap reveal">${eyebrow}<h1>${esc(title)}</h1>${lede}</div></section>
${blocksHtml}
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
  <div class="wrap footer-signup"><h4>Cherry's Newsletter</h4><p class="nl-lede">Honest insight on the psychic path, numerology, and tarot, straight to your inbox, no spam, unsubscribe any time.</p><form class="nl-form" novalidate><input type="email" placeholder="Your email" aria-label="Your email address" required><button type="submit">Subscribe</button></form><p class="nl-note" aria-live="polite"></p></div>
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
</body>
</html>
`;
}

function addToSitemap(slug) {
  let xml = readFileSync(SITEMAP, "utf8");
  const url = `https://cherrysage.com/${slug}.html`;
  if (xml.includes(`<loc>${url}</loc>`)) return;
  const today = new Date().toISOString().slice(0, 10);
  const entry = `  <url><loc>${url}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>\n`;
  xml = xml.replace("</urlset>", `${entry}</urlset>`);
  writeFileSync(SITEMAP, xml);
}

function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.log("[build-pages] No content/pages folder — nothing to build.");
    return;
  }
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.log("[build-pages] No page drafts found — nothing to build.");
    return;
  }

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const raw = readFileSync(join(CONTENT_DIR, file), "utf8");
    const { data } = parseFrontMatter(raw);

    if (!data.title || !data.description) {
      console.warn(`[build-pages] Skipping ${file}: missing title or description.`);
      continue;
    }

    const outPath = join(ROOT, `${slug}.html`);
    if (existsSync(outPath)) {
      const existing = readFileSync(outPath, "utf8");
      if (!existing.includes(GENERATED_MARKER)) {
        console.warn(
          `[build-pages] Skipping ${file}: /${slug}.html already exists and was not created by this pipeline.`
        );
        continue;
      }
    }

    const isNew = !existsSync(outPath);
    const blocksHtml = (data.blocks || []).map((b, i) => renderBlock(b, i)).join("\n");

    const page = renderPage({
      slug,
      title: data.title,
      description: data.description,
      hero_eyebrow: data.hero_eyebrow,
      hero_lede: data.hero_lede,
      blocksHtml,
    });
    writeFileSync(outPath, page);
    if (isNew) addToSitemap(slug);
    console.log(`[build-pages] ${isNew ? "Published" : "Updated"} /${slug}.html`);
  }
}

main();
