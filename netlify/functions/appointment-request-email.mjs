// Cherry Sage — customer-facing confirmation that an appointment REQUEST was received.
// Real gap found 2026-09-17 (Bev's own test): request_appointment() saves the record and
// lead.mjs notifies Bev, but nothing ever emailed the customer back. This is that missing
// email. Best-effort only -- the request itself is already saved before this is called, so a
// failed send here never loses a real request.
function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function brandShell(bodyHtml) {
  return `<div style="background:#FAF6EF;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">` +
    `<div style="max-width:520px;margin:0 auto;background:#FFFDF8;border:1px solid #EDE2CF;border-radius:12px;overflow:hidden;">` +
    `<div style="background:linear-gradient(160deg,#6E1A28 0%,#4A0F19 100%);padding:28px 32px;text-align:center;">` +
    `<img src="https://cherrysage.com/assets/logo-horizontal.png" alt="Cherry Sage" style="height:40px;max-width:220px;">` +
    `</div><div style="padding:32px;color:#2b2620;font-size:15px;line-height:1.6;">${bodyHtml}</div>` +
    `<div style="padding:20px 32px;border-top:1px solid #EDE2CF;color:#8a8072;font-size:12px;text-align:center;">` +
    `Cherry Sage &middot; Honest, accurate psychic, tarot, and numerology readings by phone. Trusted since 1999.<br>` +
    `<a href="https://cherrysage.com" style="color:#A0142B;">cherrysage.com</a></div></div></div>`;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let d = {};
  try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }

  const email = String(d.email || "").trim();
  const name = String(d.name || "").trim();
  const when = String(d.when || "").trim();
  const readingType = String(d.readingType || "a reading").trim();
  if (!email || !when) return json({ error: "missing details" }, 422);

  const KEY = process.env.BREVO_KEY;
  if (!KEY) return json({ ok: true, skipped: "not configured" });

  const body =
    `<p>Hi ${esc(name || "there")},</p>` +
    `<p>Your request for a <strong>${esc(readingType)}</strong> at <strong>${esc(when)} Eastern</strong> has reached Cherry.</p>` +
    `<p>This is a request, not an instant booking, so your exact time isn't confirmed yet. Cherry reviews it and will confirm, offer an alternate time, or follow up directly by email or phone, usually within a day.</p>` +
    `<p>You can check the status of this request any time in <a href="https://cherrysage.com/account" style="color:#A0142B;">My Account</a>.</p>`;

  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Cherry Sage", email: "admin@cherrysage.com" },
        to: [{ email }],
        subject: "Your appointment request — Cherry Sage",
        htmlContent: brandShell(body),
      }),
    });
  } catch { /* non-fatal, matches lead.mjs's own pattern */ }

  return json({ ok: true });
};
