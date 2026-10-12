/* Cherry Sage — report order forms driven by the database (2026-09-21).
   Bev asked where to manage "the attributes needed for the numerology reports" and what the product
   description says. Each report page still carries its original form as a safe fallback; when the
   database answers, this script rewrites the description and price and swaps the form for an
   "Add to Cart" button; since 2026-10-12 the questions Bev set in Manage Products are answered at
   checkout (cart.html). If the database cannot be reached, the page's built-in form still works. */
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
    // A phone reading uses this page only when Bev gave it questions (2026-10-12: the phone numerology
    // reading asks for birth details first). Its wording talks about the call, not a report.
    var phone = p.duration_minutes != null;
    if (generic) {
      if (phone && !(Array.isArray(p.report_fields) && p.report_fields.length)) { location.replace('/shop'); return; }
      var h1 = document.querySelector('.page-hero h1'); if (h1) h1.textContent = p.name;
      var crumb = document.getElementById('rfCrumb'); if (crumb) crumb.textContent = p.name;
      document.title = p.name + (phone ? ' — Phone Reading' : ' — Numerology Report') + ' — Cherry Sage';
      if (phone) { var eyebrow = document.querySelector('.page-hero .eyebrow'); if (eyebrow) eyebrow.textContent = 'Phone reading'; }
    }

    // description and price shown on this page
    var lede = document.querySelector('.page-hero .lede');
    var infoCard = form.closest('.section') ? form.closest('.section').querySelector('.card') : null;
    var infoP = infoCard ? infoCard.querySelector('p') : null;
    var priceEl = infoCard ? infoCard.querySelector('strong') : null;
    if (p.description) { if (lede) lede.textContent = p.description; if (infoP) infoP.textContent = p.description; }
    if (priceEl) priceEl.textContent = money(p.price_cents);

    if (p.active === false) {
      var note = el('p', { style: 'margin:0;color:var(--cherry)' }, 'This ' + (phone ? 'reading' : 'report') + ' is not available right now. Please check back soon.');
      form.parentNode.replaceChild(note, form);
      return;
    }

    var fields = p.report_fields;
    if (!Array.isArray(fields) || !fields.length) { if (generic) showGone('This report is not ready to order yet.'); return; }      // the static pages keep their built-in form

    // The questions are answered at checkout, under the item in the cart (Bev, 2026-10-12): some
    // browsers with privacy add-ons could not use the form that used to be here. This page now only
    // says what will be asked and adds the item; an empty "details" marks it as needing answers.
    var card = form.closest('.card');
    var head = card ? card.querySelector('h3') : null;
    var intro = head ? head.nextElementSibling : null;
    if (head) head.textContent = phone ? 'Book this reading' : 'Order this report';
    if (intro && intro.tagName === 'P') {
      intro.textContent = (phone ? 'Before your call, Cherry needs a few details. ' : '') +
        'You will answer these at checkout: ' + fields.map(function (f) {
          return String(f.label || '').replace(/\s*\([^()]*\)\s*$/, '');
        }).join(', ') + '.';
    }
    var box = el('div', { id: 'reportForm', style: 'display:grid;gap:.9rem' });
    var btn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Add to Cart');
    var msg = el('p', { id: 'rfNote', style: 'margin:0;color:var(--cherry);font-size:.9rem', hidden: '' });
    box.appendChild(btn); box.appendChild(msg);
    form.parentNode.replaceChild(box, form);

    btn.addEventListener('click', function () {
      function fail(text) { msg.hidden = false; msg.textContent = text; btn.disabled = false; btn.textContent = 'Add to Cart'; }
      btn.disabled = true; btn.textContent = 'Adding...';
      try {
        var before = window.CSCart.count();
        window.CSCart.add({ readingProductId: p.id, name: p.name, priceCents: p.price_cents, details: {} });
        if (window.CSCart.count() <= before) {
          return fail('Your browser is not letting this site keep your cart. Please allow cookies and site data for cherrysage.com, or pause privacy add-ons for this site, or try another browser.');
        }
      } catch (e) {
        return fail('Something went wrong. Please try again, or call or email Cherry and she will help you order.');
      }
      location.href = '/cart.html';
    });
  }).catch(function () { if (generic) showGone('We could not load this report. Please try again in a moment.'); /* the static pages keep their built-in form */ });
})();
