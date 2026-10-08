# -*- coding: utf-8 -*-
# Migrate all WordPress posts -> full static pages at original slugs. Rebuild blog + articles.
import json, os, re, html as H
import build_site as B

SP=r"C:\Users\GT\AppData\Local\Temp\claude\G--Shared-drives-BBC-Drive\a4016963-7403-46d2-b23a-0dd187ead902\scratchpad"
ROOT=r"C:\BBC\cherry-sage-website3"
posts=json.load(open(os.path.join(SP,"wp_posts.json"),encoding="utf-8"))
cats={c["id"]:H.unescape(c["name"]) for c in json.load(open(os.path.join(SP,"wp_cats.json"),encoding="utf-8"))}

KNOWN_SLUGS={p["slug"] for p in posts}

def clean(content):
    c=content
    c=re.sub(r'<script[\s\S]*?</script>','',c,flags=re.I)
    c=re.sub(r'<style[\s\S]*?</style>','',c,flags=re.I)
    c=re.sub(r'<link[^>]*>','',c,flags=re.I)
    # internal cherrysage links -> local slug pages
    def rl(m):
        slug=m.group(1)
        return f'href="/{slug}.html"' if slug in KNOWN_SLUGS else f'href="/"'
    c=re.sub(r'href="https?://(?:www\.)?cherrysage\.com/([a-z0-9\-]+)/?"', rl, c, flags=re.I)
    c=re.sub(r'href="https?://(?:www\.)?cherrysage\.com/?"', 'href="/"', c, flags=re.I)
    return c

def cat_name(ids):
    for i in ids:
        n=cats.get(i,"")
        if n and n not in ("Uncategorized",): return n
    return "Reading"

# index by category
by_cat={}
featured=[]
for p in posts:
    p["_title"]=re.sub(r'&#8211;|&ndash;','-',H.unescape(p["title"]["rendered"])).replace('&amp;','&').strip()
    p["_cat"]=cat_name(p.get("categories",[]))
    p["_date"]=p.get("date","")[:10]
    names=[cats.get(i,"") for i in p.get("categories",[])]
    if "Featured Articles" in names:
        featured.append(p)
    else:
        by_cat.setdefault(p["_cat"],[]).append(p)

# ---- generate a page per post ----
def related_links(p):
    same=[q for q in by_cat.get(p["_cat"],[]) if q["slug"]!=p["slug"]][:3]
    if not same: return ""
    items="".join(f'<li><a class="post-link" href="/{q["slug"]}.html">{q["_title"]}</a></li>' for q in same)
    return f'<div class="post-related"><h3>More on {p["_cat"]}</h3><ul class="post-list">{items}</ul></div>'

for p in posts:
    body=f'''<section class="page-hero post-head"><div class="wrap reveal">
  <p class="eyebrow">{p["_cat"]} · {p["_date"]}</p>
  <h1>{p["_title"]}</h1>
</div></section>
<section class="section"><div class="wrap post-wrap">
  <article class="post-content reveal">{clean(p["content"]["rendered"])}</article>
  <div class="post-cta reveal">
    <p class="eyebrow">Ready for the real thing?</p>
    <h3>Talk it through with Cherry</h3>
    <p>An honest reading goes far beyond an article. First-timers get 5 free minutes.</p>
    <a class="btn btn-primary" href="/shop.html">Buy Minutes Now</a>
  </div>
  {related_links(p)}
</div></section>'''
    desc=re.sub(r'<[^>]+>','',p.get("excerpt",{}).get("rendered",""))
    desc=re.sub(r'\s+',' ',H.unescape(desc)).strip()[:160]
    B.page(f'{p["slug"]}.html', p["_title"], desc or "Honest psychic insight from Cherry Sage.", body, "blog.html")

print("generated", len(posts), "post pages")

# ---- rebuild BLOG index from real categories ----
order=["Numerology","Psychic Readings","Online Psychic Readings","Tarot Card Readings","Astrology","Predicting Dates or Timelines","Karma & Past Lives","Dreams","Divination","divination methods","Spiritual Healing","Self Improvement","Gypsy Scams","Other World"]
seen=set(); sections=""
def block(cat, items):
    lis="".join(f'<li><a class="post-link" href="/{q["slug"]}.html">{q["_title"]}</a></li>' for q in items)
    return f'<div class="blog-cat reveal"><h3>{cat}</h3><ul class="post-list">{lis}</ul></div>'
for cat in order:
    if cat in by_cat:
        sections+=block(cat, by_cat[cat]); seen.add(cat)
for cat,items in by_cat.items():
    if cat not in seen: sections+=block(cat, items)
blog=B.page_hero("The Cherry Sage blog","Insight, honesty, and a little wonder",
  "Real writing on numerology, love, accuracy, predictions, and the spiritual path, since 1999.")+f'''
<section class="section"><div class="wrap"><div class="blog-grid">{sections}</div></div></section>'''+B.cta()
B.page("blog.html","Blog","Honest writing on numerology, love, accuracy, predictions and the spiritual path from Cherry Sage.",blog,"blog.html")

# ---- rebuild ARTICLES (Featured Articles = guest/portfolio) ----
if featured:
    lis="".join(f'<li><a class="post-link" href="/{q["slug"]}.html">{q["_title"]}</a></li>' for q in featured)
    abody=B.page_hero("Guest &amp; featured articles","Voices we've shared the page with",
      "Featured pieces from Cherry Sage, separate from the everyday blog.")+f'''
<section class="section"><div class="wrap" style="max-width:760px"><ul class="post-list">{lis}</ul></div></section>'''+B.cta()
else:
    abody=B.page_hero("Guest &amp; featured articles","Voices we've shared the page with","Featured pieces from Cherry Sage.")+B.cta()
B.page("articles.html","Guest Articles","Featured and guest articles from Cherry Sage.",abody,"articles.html")
print("blog + articles rebuilt. featured:",len(featured))

# ---- SEO redirects ----
# Removed 2026-10-06: this used to overwrite _redirects, which now holds the full
# hand-checked redirect map (755 rules). Edit _redirects directly instead.
