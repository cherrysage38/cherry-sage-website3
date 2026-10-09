# -*- coding: utf-8 -*-
# sitemap.xml + robots.txt for Cherry Sage Site 2
import os, glob, datetime
import build_site as B
ROOT=r"C:\BBC\cherry-sage-website3"
today=datetime.date(2026,8,28).isoformat()  # date.today() unavailable in some sandboxes; stamp explicitly

# priority hints
PRIORITY={"index.html":"1.0","shop.html":"0.9","testimonials.html":"0.8","meet.html":"0.7",
          "psychic-reading.html":"0.8","tarot.html":"0.8","numerology.html":"0.8","blog.html":"0.7",
          "articles.html":"0.6","contact.html":"0.6","life-path.html":"0.7","how-it-works.html":"0.7",
          "feedback.html":"0.5","horoscope.html":"0.6","tarot-pull.html":"0.6"}
pages=sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT,"*.html")) if os.path.basename(p)!="set-hours.html")
urls=[]
for pg in pages:
    loc = B.SITE_URL + ("/" if pg=="index.html" else "/"+pg)
    if pg=="psychic-reading.html": loc = B.SITE_URL + "/psychic-reading"  # canonical address, no .html or trailing slash
    pr = PRIORITY.get(pg,"0.5")
    urls.append(f"  <url><loc>{loc}</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>{pr}</priority></url>")
xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+"\n".join(urls)+"\n</urlset>\n"
open(os.path.join(ROOT,"sitemap.xml"),"w",encoding="utf-8").write(xml)
open(os.path.join(ROOT,"robots.txt"),"w",encoding="utf-8").write(
  "User-agent: *\nAllow: /\n\n# AI search crawlers welcome\nUser-agent: GPTBot\nAllow: /\nUser-agent: OAI-SearchBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\n\nSitemap: "+B.SITE_URL+"/sitemap.xml\n")
print("sitemap.xml:",len(pages),"urls + robots.txt")
