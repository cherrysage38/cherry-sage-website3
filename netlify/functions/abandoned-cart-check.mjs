// Cherry Sage — scheduled sweep for abandoned carts. Runs every 30 minutes. A cart counts as
// abandoned once cart-start.mjs recorded it and cart-charge.mjs never cleared it (payment never
// completed) for at least an hour. Sends one branded reminder, then deletes the record so it
// only ever fires once per cart.
import { getStore } from "@netlify/blobs";

const ABANDON_AFTER_MS = 60 * 60 * 1000; // 1 hour

function brandShell(bodyHtml) {
  return `<div style="background:#FAF6EF;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:520px;margin:0 auto;background:#FFFDF8;border:1px solid #EDE2CF;border-radius:12px;overflow:hidden;">` +
    `<div style="height:5px;background-color:#C0972F;background:linear-gradient(90deg,#C0972F,#D9B25E,#C0972F);font-size:0;line-height:0;">&nbsp;</div>` +
    `<div style="padding:30px 32px 6px;text-align:center;background-color:#FFFDF8;">` +
    `<img src="https://cherrysage.com/assets/logo-email.png" alt="Cherry Sage" width="200" height="56" style="height:56px;width:200px;max-width:220px;border:0;outline:none;text-decoration:none;display:block;margin:0 auto;">` +
    `</div><div style="padding:32px;color:#2b2620;font-size:15px;line-height:1.6;">${bodyHtml}</div>` +
    `<div style="padding:20px 32px;border-top:1px solid #EDE2CF;color:#8a8072;font-size:12px;text-align:center;">` +
    `Cherry Sage &middot; Honest, accurate psychic, tarot, and numerology readings by phone. Trusted since 1999.<br>` +
    `<a href="https://cherrysage.com" style="color:#A0142B;">cherrysage.com</a></div></div></div>`;
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sendAbandonedCartEmail(email, name) {
  const KEY = process.env.BREVO_KEY;
  if (!KEY || !email) return;
  const firstName = esc((name || "").split(" ")[0] || "there");
  const body =
    `<p>Hi ${firstName},</p>` +
    `<p>It looks like you started checking out but didn't finish. Your reading minutes are still waiting whenever you're ready.</p>` +
    `<p><a href="https://cherrysage.com/shop" style="display:inline-block;background:#6E1A28;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">Complete your purchase</a></p>` +
    `<p>Warmly,<br>Cherry Sage</p>`;
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Cherry Sage", email: "admin@cherrysage.com" },
        to: [{ email }],
        subject: "You left something in your cart",
        htmlContent: brandShell(body),
      }),
    });
  } catch { /* non-fatal, next sweep will retry since the record stays until send succeeds */ }
}

export default async (req) => {
  const store = getStore("abandoned-carts");
  const now = Date.now();
  let cursor;
  do {
    const page = await store.list({ cursor });
    for (const { key } of page.blobs) {
      const rec = await store.get(key, { type: "json" });
      if (!rec || !rec.startedAt) continue;
      if (now - rec.startedAt < ABANDON_AFTER_MS) continue;
      await sendAbandonedCartEmail(rec.email, rec.name);
      await store.delete(key);
    }
    cursor = page.cursor;
  } while (cursor);
};

export const config = { schedule: "*/30 * * * *" };
