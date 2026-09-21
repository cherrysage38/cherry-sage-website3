/* Cherry Sage — report order forms driven by the database (2026-09-21).
   Bev asked where to manage "the attributes needed for the numerology reports" and what the product
   description says. Each report page still carries its original form as a safe fallback; when the
   database answers, this script rewrites the description and price, rebuilds the form from the
   questions Bev set in Manage Products, and adds the order to the cart with the same answer keys
   (fullname, dob, email ...) the order emails and Clover receipts already use. */
(function () {
  var form = document.getElementById('reportForm');
  if (!form) return;
  // The six original report pages carry their product id in the markup. Reports added later in Manage
  // Products all use the one page /report?p=<product id>, which is filled in entirely from the database.
  var generic = form.hasAttribute('data-generic');
  var pid = form.getAttribute('data-pid') || (generic ? new URLSearchParams(location.search).get('p') : '');
  if (!pid) { if (generic) showGone(); return; }

  var SUPABASE_URL = 'https://ctoeuikxoqlhnebgsygp.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0b2V1aWt4b3FsaG5lYmdzeWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODM4NTMsImV4cCI6MjA5NjA1OTg1M30.Cy0uf8hm-Biea7a1V3bLQBz70f1oyhP83vHDjefTce8';
  var FIELD_STYLE = 'padding:.85rem 1rem;border:1px solid var(--line-strong);border-radius:12px;font-family:var(--font-body);font-size:1rem;width:100%;box-sizing:border-box';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showGone(text) {
    if (!generic) return;
    var lede = document.querySelector('.page-hero .lede');
    if (lede) lede.textContent = '';
    var msg = el('p', { style: 'margin:0;color:var(--cherry)' }, text || 'We could not find that report.');
    var link = el('a', { href: '/shop', class: 'btn btn-primary', style: 'display:inline-block;margin-top:.8rem' }, 'Back to the shop');
    form.innerHTML = ''; form.appendChild(msg); form.appendChild(link);
  }
  function money(cents) { return '$' + ((cents || 0) / 100).toFixed(2).replace(/\.00$/, ''); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }

  fetch(SUPABASE_URL + '/rest/v1/reading_products?select=id,name,price_cents,active,description,report_fields,duration_minutes&id=eq.' + encodeURIComponent(pid), {
    headers: { apikey: SUPABASE_ANON, 'Accept-Profile': 'cherry_sage' }
  }).then(function (r) { return r.json(); }).then(function (rows) {
    var p = rows && rows[0];
    if (!p) { showGone(); return; }
    if (generic) {
      if (p.duration_minutes != null) { location.replace('/shop'); return; }      // a phone reading, not a report
      var h1 = document.querySelector('.page-hero h1'); if (h1) h1.textContent = p.name;
      var crumb = document.getElementById('rfCrumb'); if (crumb) crumb.textContent = p.name;
      document.title = p.name + ' — Numerology Report — Cherry Sage';
    }

    // description and price shown on this page
    var lede = document.querySelector('.page-hero .lede');
    var infoCard = form.closest('.section') ? form.closest('.section').querySelector('.card') : null;
    var infoP = infoCard ? infoCard.querySelector('p') : null;
    var priceEl = infoCard ? infoCard.querySelector('strong') : null;
    if (p.description) { if (lede) lede.textContent = p.description; if (infoP) infoP.textContent = p.description; }
    if (priceEl) priceEl.textContent = money(p.price_cents);

    if (p.active === false) {
      var note = el('p', { style: 'margin:0;color:var(--cherry)' }, 'This report is not available right now. Please check back soon.');
      form.parentNode.replaceChild(note, form);
      return;
    }

    var fields = p.report_fields;
    if (!Array.isArray(fields) || !fields.length) { if (generic) showGone('This report is not ready to order yet.'); return; }      // the static pages keep their built-in form

    // brand-new form element: drops the old page's submit handler, which only knows the old fields
    var nf = form.cloneNode(false);
    fields.forEach(function (f) {
      var wrap = el('label', { style: 'display:grid;gap:.35rem;font-size:.92rem;color:var(--ink-soft)' }, f.label + (f.required ? '' : ' (optional)'));
      var input = f.type === 'textarea'
        ? el('textarea', { name: f.key, rows: '4', style: FIELD_STYLE })
        : el('input', { name: f.key, type: f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text', style: FIELD_STYLE });
      if (f.required) input.setAttribute('required', '');
      wrap.appendChild(input);
      nf.appendChild(wrap);
    });
    nf.appendChild(el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', style: 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0' }));
    var btn = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Add to Cart');
    var msg = el('p', { id: 'rfNote', style: 'margin:0;color:var(--cherry);font-size:.9rem', hidden: '' });
    nf.appendChild(btn); nf.appendChild(msg);
    form.parentNode.replaceChild(nf, form);

    nf.addEventListener('submit', function (e) {
      e.preventDefault();
      if (nf.elements['website'] && nf.elements['website'].value) return;      // bot
      var details = {};
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i], v = String((nf.elements[f.key] || {}).value || '').trim();
        if (f.required && !v) { msg.hidden = false; msg.textContent = 'Please fill in: ' + f.label; return; }
        if (v && f.type === 'email' && !EMAIL.test(v)) { msg.hidden = false; msg.textContent = 'Please enter a valid email.'; return; }
        if (v) details[f.key] = v;
      }
      msg.hidden = true; btn.disabled = true; btn.textContent = 'Adding...';
      window.CSCart.add({ readingProductId: p.id, name: p.name, priceCents: p.price_cents, details: details });
      location.href = '/cart.html';
    });
  }).catch(function () { if (generic) showGone('We could not load this report. Please try again in a moment.'); /* the static pages keep their built-in form */ });
})();
