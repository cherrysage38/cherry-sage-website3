// The one place the site's footer content lives. Every page generator (build-blog.js,
// build-articles.js, build-pages.js, build-home.js) and the static-page sync (sync-footer.js)
// render from this same content/footer.yml through renderFooter() below, so changing the
// footer once and rebuilding updates every page on the site. No page should hand-type its own
// footer HTML anymore.
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function loadFooterData() {
  return yaml.load(readFileSync(join(ROOT, "content", "footer.yml"), "utf8"));
}

// withNewsletter: false skips the newsletter signup box, used on checkout-flow pages
// (cart, login, payment) where BBC and Bev deliberately keep the page free of distractions.
export function renderFooter(data, { withNewsletter = true } = {}) {
  const columns = (data.columns || [])
    .map((col) => {
      const links = (col.links || []).map((l) => `<li><a href='${esc(l.url)}'>${esc(l.label)}</a></li>`).join("");
      return `<div><h4>${esc(col.heading)}</h4><ul>${links}</ul></div>`;
    })
    .join("\n    ");
  const signup = withNewsletter
    ? `\n  <div class="wrap footer-signup"><h4>${esc(data.newsletter_heading)}</h4><p class="nl-lede">${esc(data.newsletter_text)}</p><form class="nl-form" novalidate><input type="email" placeholder="Your email" aria-label="Your email address" required><input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0"><button type="submit">Subscribe</button></form><p class="nl-note" aria-live="polite"></p></div>`
    : "";
  return `<footer class="footer">
  <div class="wrap footer-grid">
    <div>
      <div class="footer-brand"><img src="assets/mark-clean.png" alt=""><span>Cherry Sage</span></div>
      <p style="font-size:.9rem">${esc(data.tagline)}</p>
    </div>
    ${columns}
  </div>${signup}
  <div class="wrap footer-bottom">${esc(data.copyright)}</div>
</footer>`;
}
