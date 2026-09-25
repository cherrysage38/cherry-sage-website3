// Applies the one shared footer (content/footer.yml, rendered by footer.js) to every .html file
// in the site, including the plain static/utility pages (account, cart, login, dashboards,
// book-appointment, etc.) that no content-driven builder regenerates. Runs every deploy, right
// after the content builders, so there is never a second place to edit the footer by hand again.
// Preserves each page's existing choice of whether to show the newsletter signup box (a few
// checkout-flow pages deliberately skip it to avoid distracting someone mid-purchase).
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadFooterData, renderFooter } from "./footer.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FOOTER_RE = /<footer class="footer">[\s\S]*?<\/footer>/;

function main() {
  const data = loadFooterData();
  const withNewsletter = renderFooter(data, { withNewsletter: true });
  const withoutNewsletter = renderFooter(data, { withNewsletter: false });

  const files = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  let updated = 0;
  for (const file of files) {
    const path = join(ROOT, file);
    const html = readFileSync(path, "utf8");
    const m = html.match(FOOTER_RE);
    if (!m) continue; // admin/internal pages that intentionally have no public footer
    const hadNewsletter = m[0].includes("footer-signup");
    const next = hadNewsletter ? withNewsletter : withoutNewsletter;
    if (m[0] === next) continue;
    writeFileSync(path, html.replace(FOOTER_RE, next));
    updated++;
  }
  console.log(`[sync-footer] Footer synced from content/footer.yml on ${updated} page(s) that needed it.`);
}

main();
