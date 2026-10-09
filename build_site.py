# -*- coding: utf-8 -*-
# Cherry Sage Website 3 — full-site generator. Shared shell + real content.
import os, html as _H, json as _J
ROOT=r"C:\BBC\cherry-sage-website3"

# When the domain moves to her real site, change SITE_URL to https://cherrysage.com and rebuild.
SITE_URL="https://cherry-sage-website3.netlify.app"
# Account / registration is handled by her WooCommerce (accounts, passwords live there, not here).
ACCOUNT_URL="https://cherrysage.com/my-account/"
def _a(s):  # escape for an HTML attribute
    return _H.escape(str(s or ""), quote=True)
# Site-wide structured data: Organization + WebSite (helps Google + AI search understand the brand)
ORG_JSONLD='<script type="application/ld+json">'+_J.dumps({
  "@context":"https://schema.org","@graph":[
    {"@type":["ProfessionalService","Organization"],"@id":SITE_URL+"/#org","name":"Cherry Sage",
     "url":SITE_URL+"/","description":"Honest, accurate psychic, tarot, and numerology readings by phone since 1999.",
     "logo":SITE_URL+"/assets/logo.png","image":SITE_URL+"/assets/bev_portrait.jpg",
     "founder":{"@type":"Person","name":"Cherry Sage"},"foundingDate":"1999",
     "areaServed":"Worldwide","priceRange":"$$",
     "sameAs":["https://cherrysage.com"],
     "aggregateRating":{"@type":"AggregateRating","ratingValue":"4.9","reviewCount":"390","bestRating":"5"}},
    {"@type":"WebSite","@id":SITE_URL+"/#website","url":SITE_URL+"/","name":"Cherry Sage",
     "publisher":{"@id":SITE_URL+"/#org"},
     "potentialAction":{"@type":"SearchAction","target":SITE_URL+"/blog.html?q={search_term_string}","query-input":"required name=search_term_string"}}
  ]},ensure_ascii=False)+'</script>'

NAV=[("meet.html","About"),("psychic-reading.html","Psychic"),("tarot.html","Tarot"),
     ("numerology.html","Numerology"),("shop.html","Shop"),("testimonials.html","Testimonials"),
     ("blog.html","Blog"),("articles.html","Articles"),("contact.html","Contact")]

def header(active=""):
    links="".join(f'<li><a href="{h}"{" class=cur" if h==active else ""}>{t}</a></li>' for h,t in NAV)
    return f'''<header class="site-header">
  <div class="wrap nav-row">
    <a class="brand" href="index.html" aria-label="Cherry Sage home"><img src="assets/logo-horizontal.png" alt="Cherry Sage — Psychic, Tarot, Numerology"></a>
    <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">&#9776;</button>
    <nav class="primary-nav" id="primaryNav" aria-label="Primary">
      <ul>{links}<li><a href="account.html">My Account</a></li></ul>
      <a class="btn btn-primary" href="shop.html">Buy Minutes</a>
    </nav>
  </div>
</header>'''

FOOTER='''<footer class="footer">
  <div class="wrap footer-grid">
    <div>
      <div class="footer-brand"><img src="assets/mark-clean.png" alt=""><span>Cherry Sage</span></div>
      <p style="font-size:.9rem">Honest, accurate psychic, tarot, and numerology readings by phone. Trusted since 1999.</p>
    </div>
    <div><h4>Readings</h4><ul><li><a href="psychic-reading.html">Psychic Reading</a></li><li><a href="tarot.html">Tarot Card Reading</a></li><li><a href="numerology.html">Numerology</a></li><li><a href="how-it-works.html">How It Works</a></li></ul></div>
    <div><h4>Explore</h4><ul><li><a href="meet.html">Meet Cherry</a></li><li><a href="blog.html">Blog</a></li><li><a href="articles.html">Guest Articles</a></li><li><a href="testimonials.html">Testimonials</a></li></ul></div>
    <div><h4>Free</h4><ul><li><a href="tarot-pull.html">Free Tarot Pull</a></li><li><a href="life-path.html">Life Path Calculator</a></li><li><a href="free-karmic-reading.html">Karmic Accumulation</a></li><li><a href="horoscope.html">Daily Horoscope</a></li><li><a href="feedback.html">Leave Feedback</a></li></ul></div>
  </div>
  <div class="wrap footer-bottom">© Cherry Sage. Serving clients worldwide since 1999. · Concept build by Balay ni Bruno &amp; Co. — not the live site.</div>
</footer>
<div class="chat-widget" id="chatWidget" role="button" tabindex="0" aria-label="Chat with Ivy, Cherry's assistant — click to open">
  <span class="cw-hint" id="cwHint">Click to chat with Ivy</span>
  <span class="cw-status"><span class="status-dot"></span>Cherry is Online</span>
  <span class="cw-bubble"><img src="assets/mark-clean.png" alt=""></span>
</div>
<script src="app.js?v=5"></script>
<script src="embers.js?v=5"></script>
<script src="magic.js?v=1"></script>
<script src="funnel.js?v=5"></script>
<script src="chat.js?v=4"></script>
<script src="status.js?v=1"></script>'''

def page(slug,title,desc,body,active="",head_extra="",og_type="website",og_image="assets/bev_portrait.jpg"):
    canon = SITE_URL + ("/" if slug=="index.html" else "/"+slug)
    ttl = _a(f"{title} — Cherry Sage"); d=_a(desc)
    img = og_image if str(og_image).startswith("http") else SITE_URL+"/"+og_image
    html=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{ttl}</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{_a(canon)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Cherry Sage">
<meta property="og:title" content="{ttl}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{_a(canon)}">
<meta property="og:image" content="{_a(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{ttl}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{_a(img)}">
<meta name="theme-color" content="#6E1A28">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css?v=19">
<link rel="icon" href="assets/favicon.ico" sizes="any">
<link rel="icon" href="assets/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/icon-180.png">
{ORG_JSONLD}
{head_extra}
</head>
<body>
{header(active)}
<main>
{body}
</main>
{FOOTER}
</body>
</html>'''
    open(os.path.join(ROOT,slug),"w",encoding="utf-8").write(html)
    print("wrote",slug)

# ---------- shared bits ----------
def page_hero(eyebrow,h1,sub):
    return f'''<section class="page-hero"><div class="ph-glow" aria-hidden="true"></div><div class="wrap reveal"><p class="eyebrow">{eyebrow}</p><h1>{h1}</h1><p class="lede">{sub}</p></div></section>'''
def hero_banner(eyebrow,h1,sub):
    # richer image-style header (celestial banner) — used where a page wants a stronger top
    return f'''<section class="page-hero banner"><div class="ph-glow" aria-hidden="true"></div><div class="ph-stars" aria-hidden="true"></div><div class="wrap reveal"><p class="eyebrow">{eyebrow}</p><h1>{h1}</h1><p class="lede">{sub}</p></div></section>'''
def cta(h="Ready for clarity?",p="Your first step is a quiet one. Book your reading and let the answers you're seeking find their way to you."):
    return f'''<section class="section section-dark cta" id="book"><div class="wrap reveal"><h2>{h}</h2><p>{p}</p><a class="btn btn-gold" href="shop.html">Buy Minutes Now</a></div></section>'''

# ---------- MEET CHERRY ----------
meet=hero_banner("Reading since 1999 · 27 years in practice","Meet Cherry Sage",
  "A clairvoyant, clairaudient, empath, and numerologist known for honesty over fantasy.")+'''
<section class="section"><div class="wrap story-grid">
  <div class="reveal">
    <p class="eyebrow">A sacred gift</p>
    <h2>The Intuitive Connection</h2>
    <p>There was a time, many years ago, when the whispers of the universe first called me to serve. I remember sitting alone under the glow of the moon, gazing at the stars, when a single tarot card fell from the deck. The world seemed to pause, and I understood the answers were always here, hidden in the cards, in the numbers, in the quiet moments of reflection.</p>
    <p>Hi. I'm glad you're here. I am Cherry Sage. I provide psychic advice and professional psychic readings. Spin Magazine found my site in 1999 and invited me to be their "Ask the Expert" guest.</p>
  </div>
  <div class="reveal"><img src="assets/bev_portrait.jpg" alt="Cherry Sage" style="border-radius:var(--r-lg);box-shadow:var(--shadow)"></div>
</div></section>
<section class="section section-tint"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">How I read</p><h2>Honest, and human</h2></div>
  <div class="grid grid-3">
    <div class="card reveal"><h3>Clairvoyant &amp; clairaudient</h3><p>I see and hear the energies around a question, then tell you plainly what I sense, and check that it resonates for you.</p></div>
    <div class="card reveal"><h3>Empath &amp; numerologist</h3><p>I feel the emotional truth beneath a situation, and I read the numbers that shape your path, from Life Path to Karmic Debt.</p></div>
    <div class="card reveal"><h3>Honest over fantasy</h3><p>90% of my clients are repeat callers. I offer the truth with compassion and responsibility, never fear, never a script.</p></div>
  </div>
</div></section>'''+cta("Let's talk soon","When you're ready, a real reading with me is a phone call away.")

# ---------- service template ----------
def service(eyebrow,h1,sub,whatis,points,note):
    lis="".join(f'<div class="card reveal"><h3>{t}</h3><p>{d}</p></div>' for t,d in points)
    return hero_banner(eyebrow,h1,sub)+f'''
<section class="section"><div class="wrap story-grid">
  <div class="reveal"><p class="eyebrow">What it is</p><h2>{h1}</h2><p>{whatis}</p><a class="btn btn-primary" href="shop.html">Buy Minutes Now</a></div>
  <div class="story-card reveal"><p class="pull" style="border:none;margin:0;padding:0">"I offer the truth with compassion and responsibility."</p><cite>— Cherry Sage</cite></div>
</div></section>
<section class="section section-tint"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">What you can expect</p><h2>{h1.split("—")[0].strip()}, done right</h2></div>
  <div class="grid grid-3">{lis}</div>
  <p class="center reveal" style="margin-top:2rem;color:var(--ink-soft)">{note}</p>
</div></section>'''+cta()

psychic=service("Psychic Reading","Live &amp; Online Psychic Reading",
  "Honest, in-depth phone readings on love, career, and family. No fantasy answers, ever.",
  "A reading with me is a real conversation. You bring what's on your heart, and I read the energy around it, clairvoyantly, clairaudiently, and as an empath, then tell you honestly what I sense. Phone is neither more nor less powerful than in person; it simply lets us connect from anywhere in the world.",
  [("Love &amp; relationships","Will they come back, is this real, should you wait or walk. We look at what's truly there, not just the fear."),
   ("Career &amp; decisions","When you keep almost quitting, or can't see the next chapter, a reading helps you find the path, not just the worry."),
   ("Honest guidance","No guaranteed timelines, no curses to remove, no dependency. Just the truth, with compassion, and your free will intact.")],
  "First-timers get 5 free minutes on their first call. Cherry's status shows live, so you always know when to call.")

tarot=hero_banner("Tarot &middot; a mirror for what's moving in your life","Tarot Card Reading",
  "Welcome dear soul, to my gentle guidance at Cherry Sage, where the mystical realm meets the clarity of insight, and the mysteries of life unfold with clarity and love.")+'''
<section class="section"><div class="wrap story-grid">
  <div class="reveal">
    <p class="eyebrow">Reading tarot since 1999</p>
    <h2>Wisdom of the Tarot, read with love</h2>
    <p>For over two decades I have been honored to help thousands of people unveil their potential, understand their lives, and see the hidden truths that lie ahead. My blend of clairvoyance, intuition, and deep psychic wisdom sheds light on the deepest parts of your love life and more. Whether you seek answers about love, career, or your spiritual path, I am here to provide the gentle guidance you need.</p>
    <p>With every spread I tune into the vibrations of your current situation, connecting with the energies of the cards to reveal hidden truths and future possibilities. Each reading is a personal experience, designed to illuminate the path ahead, offering clarity and reassurance for your next steps.</p>
    <a class="btn btn-primary" href="shop.html">Book a tarot reading</a>
  </div>
  <div class="story-card reveal"><p class="pull" style="border:none;margin:0;padding:0">"I don't just read the cards. I feel their energies, connecting with your soul and its journey."</p><cite>&mdash; Cherry Sage</cite></div>
</div></section>
<section class="section section-tint"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">What a reading holds</p><h2>More than a glimpse of the future</h2></div>
  <div class="grid grid-3">
    <div class="card reveal"><h3>Love &amp; relationships</h3><p>Relationships are complex, but the Tarot reveals the energy dynamics between you and others, uncovering what is truly going on beneath the surface, and offering clarity about your emotional connections.</p></div>
    <div class="card reveal"><h3>A deeply intuitive approach</h3><p>What sets me apart is that I feel the cards, not just read them. My insights are grounded in years of experience and a real understanding of the spiritual world. They bring peace, offer clarity, and guide you toward your highest potential.</p></div>
    <div class="card reveal"><h3>A quiet space, wherever you are</h3><p>The distance between us does not matter. Your energy, your story, and your journey are all that matter. Together we uncover the wisdom you seek, with nothing but peace, compassion, and love guiding the way.</p></div>
  </div>
  <p class="center reveal" style="margin-top:2rem;color:var(--ink-soft)">Want a light, free card to reflect on first? Try the <a href="tarot-pull.html">Free Tarot Card Pull</a>.</p>
</div></section>'''+cta("Ready when you are","If you are ready to transform your life, a tarot reading with me can be the first step toward clarity and purpose.")

def num_element(title, desc, link=None, linktext=None):
    cta=f'<a class="card-link" href="{link}">{linktext} &rarr;</a>' if link else '<a class="card-link" href="shop.html">Get your full report &rarr;</a>'
    return f'<div class="card reveal"><h3>{title}</h3><p>{desc}</p>{cta}</div>'
_ELEMENTS=[
 ("Life Path","Drawn from your full birth date, this is the central number in numerology, the path and the lessons your life is built around.","life-path.html","Try it free"),
 ("Karmic Accumulation","A free reading drawn from your full birth name, the energy you have carried and gathered across this lifetime.","free-karmic-reading.html","Try it free"),
 ("Expression","Drawn from every letter of your full birth name, this is what you are here to build and express in this lifetime.",None,None),
 ("Soul Urge","Drawn from the vowels in your name, this is what your heart most deeply wants, beneath the surface.",None,None),
 ("Birthday Number","The day of the month you were born, a specific gift or talent you carry with you.",None,None),
 ("Basic Number Meanings","The core meaning of each number, one through nine and the master numbers, the alphabet that numerology speaks in.",None,None),
 ("Karmic Lessons","The numbers missing from your name, pointing to the lessons your soul came here to learn.",None,None),
 ("Karmic Debts","Carried energy shown by the numbers thirteen, fourteen, sixteen and nineteen, asking to be balanced in this life.",None,None),
]
numerology=hero_banner("Numerology &middot; the map in your name and birth date","Numerology Reports",
  "Your birth date and the name you were given hold a real map. These are the elements I read, with free tools to begin.")+'''
<section class="section"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">The numerology elements</p><h2>Every number I read</h2>
  <p>Start with the free tools, then go deeper with a full personal report or a live reading.</p></div>
  <div class="grid grid-3">'''+"".join(num_element(*e) for e in _ELEMENTS)+'''</div>
</div></section>
<section class="section section-tint"><div class="wrap center reveal" style="max-width:660px">
  <p class="eyebrow">Coming soon</p><h2>A Numerology School</h2>
  <p style="color:var(--ink-soft)">Cherry is building a place to learn numerology properly, and to work alongside other trusted advisors. These elements are its foundation.</p>
</div></section>'''+cta()

# ---------- HOW IT WORKS ----------
how=hero_banner("How it works","Book and pay in one pass",
  "No separate registration, no checking out twice. Watch the status light, pick your time, and you're booked.")+'''
<section class="section section-dark" id="book"><div class="wrap">
  <div class="steps">
    <div class="step reveal"><h3>Check availability</h3><p>Watch the status light, or check open times directly. Green means Cherry is online now.</p></div>
    <div class="step reveal"><h3>Pick your time &amp; minutes</h3><p>Choose your day, time, and reading length in the same flow.</p></div>
    <div class="step reveal"><h3>Pay &amp; you're booked</h3><p>Pay right there. No separate registration step, no checking out twice.</p></div>
  </div>
  <p class="center reveal" style="margin-top:2rem;color:rgba(255,253,248,.85)">First-timers get 5 free minutes on their first call.</p>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head reveal"><p class="eyebrow">Good to know</p><h2>Common questions</h2></div>
  <div class="grid grid-2">
    <div class="card reveal"><h3>Can you really read over the phone?</h3><p>Yes. Phone readings are neither more nor less powerful than in person. Many clients feel more open without face to face.</p></div>
    <div class="card reveal"><h3>Do you guarantee timelines?</h3><p>No honest reader can. I give you what I sense clearly, and I'm honest about what I don't. Your free will always comes first.</p></div>
    <div class="card reveal"><h3>What if I don't have a question?</h3><p>That's fine. Just start where you are. The reading will meet you there.</p></div>
    <div class="card reveal"><h3>How do I pay?</h3><p>You buy minutes and pay in one pass, right when you book. Simple and secure.</p></div>
  </div>
</div></section>'''+cta()

# ---------- TESTIMONIALS ----------
tst=page_hero("What clients say","Real testimonials, real people",
  "90% of my clients are repeat callers. Here is a little of what they say.")+'''
<section class="section"><div class="wrap"><div class="grid grid-3">
  <div class="quote-card reveal"><p>"Cherry is incredibly connected and honest. Nothing was pretentious or generic. She tells it like it is."</p><cite>Kevin Moore</cite></div>
  <div class="quote-card reveal"><p>"Cherry will not disappoint. She is beyond spiritually gifted. Nothing was generic or sugar coated."</p><cite>Kandy Nichole Shah</cite></div>
  <div class="quote-card reveal"><p>"Ms. Cherry is nothing short of amazing. She has helped me grow so much."</p><cite>Daishaun Allen</cite></div>
</div></div></section>'''+cta()

# ---------- BLOG ----------
CATS=[("🔢 Numerology",["How to Calculate Your Personal Year","What Your Life Path Number Tells You About Numerology Health","What Is Numerology, The Short Version","Numerology Reading, Understanding Number 1","Numerology Reading, Understanding Number 2","Numerology Reading, What Is the Meaning of Number 3","I'm in a 9 Personal Year, What Now?","Discover Your Personal Year in Numerology"]),
 ("💕 Love, Relationships &amp; Compatibility",["Astrology, Your Cancer Male's Character Traits","Aquarius Female Compatibility","Surprising Benefits of Being Single","Psychic Readings and the Mystery of Who Really Is Your Soul Mate","Do Psychics Really Have the Power to Bring a Lover Back?","Align With the Universe, Let Your Soul Guide You to Love"]),
 ("✅ Trust, Accuracy &amp; Spotting Fakes",["Why It's Not So Easy to Find an Authentic Psychic","Why Do Psychics Say Different Things? I'm So Confused","What Is a Professional Psychic Reading?","How to Tell If Your Psychic Is Really Accurate, Or Just Selling You a Dream","Get Accurate Psychic Readings From a Real Psychic Source","How to Not Fall Prey to Psychic Scams","Psychic Integrity, How Genuine Readings Empower Your Free Will","My Reading Was Accurate, the Dates Were Wrong"]),
 ("🔮 Predictions, Timing &amp; the Future",["The Unknown Truth About Getting Accurate Psychic Predictions","Can a Psychic Really Read a Person Over the Phone?","The Baffling Mystery Why Your Future Predictions May Not Be Accurate","Are There Any Authentic Psychics With Accurate Timelines?","How Far Ahead Into the Future Can a Psychic See?","How to Ask the Right Questions During Your Psychic Readings","From Waiting to Manifestation, Why the Flow of Time Is Key","How Accurate Psychic Predictions Empower Your Life Decisions","Unveiling the Mystical Path, How Psychics See the Future","The Art of Psychic Perception","Why Do Psychics Connect With Some People But Not Others?"]),
 ("🌙 Spiritual &amp; Metaphysical",["Self-Hypnosis and Mental Imagery, How to Use Them","About Auras, What We Know About the Human Energy Field","The Practice of Meditation","What Are the Akashic Records?","Divination Methods, Different Strokes for Different Folks","Karma and Past Lives","Dreams of the Future, Dreams Meaning","The Auric Energy Field, What Is It?","A Superconscious Journey Beyond","What Is Karma?","Does Tarot Align With Biblical Prophecy?"]),
 ("🌱 Empowerment &amp; Healing",["Psychic Readings and the Profound Wisdom of Spiritual Guidance","The Universe Is Whispering, Tap Into Your Spirit Guides","Trapped in Career Limbo","Clear the Fog, Spiritual Energy Cleansing","From Turmoil to Tranquility","Your Inner Compass Awaits","Finding Solace in a Restless World","Intuition as a Healing Tool","How Authentic Psychic Readings Guide You Through Life's Major Changes","How Psychic Readings Heal Your Shadow Self","5 Signs You've Had a Real Psychic Connection by Phone","The Easy Way to Rejuvenate and Transform Yourself"])]
blog_sections=""
for cat,posts in CATS:
    items="".join(f'<li><a class="post-link" href="#">{p}</a></li>' for p in posts)
    blog_sections+=f'<div class="blog-cat reveal"><h3>{cat}</h3><ul class="post-list">{items}</ul></div>'
blog=page_hero("The Cherry Sage blog","Insight, honesty, and a little wonder",
  "Real writing on numerology, love, accuracy, and the spiritual path. New posts as we grow.")+f'''
<section class="section"><div class="wrap"><div class="blog-grid">{blog_sections}</div></div></section>'''+cta()

# ---------- ARTICLES (guest / portfolio) ----------
articles=page_hero("Guest articles","Voices we've shared the page with",
  "Separate from the blog, these are featured guest pieces from Cherry's Portfolio, being migrated here.")+'''
<section class="section"><div class="wrap">
  <div class="card reveal" style="max-width:720px;margin:0 auto;text-align:center">
    <span class="chip">Portfolio</span>
    <h3>Guest articles are on their way</h3>
    <p>Cherry's guest and featured articles live in a separate section of the old site. We're carrying them over here so they keep their place and their search history. Check back soon, or ask Cherry about a specific piece.</p>
    <a class="card-link" href="contact.html">Ask about an article →</a>
  </div>
</div></section>'''+cta()

# ---------- CONTACT ----------
contact=hero_banner("Get in touch","Reach Cherry Sage",
  "The best way to connect is a reading by phone. Here's how to reach out.")+'''
<section class="section"><div class="wrap story-grid">
  <div class="reveal">
    <h2>Ready when you are</h2>
    <p>Watch the status light at the corner of the site. When Cherry is online, it's a good moment to call. First-timers get 5 free minutes on their first reading.</p>
    <p>For questions before you book, send a note and Cherry will get back to you personally.</p>
    <a class="btn btn-primary" href="shop.html">Buy Minutes Now</a>
  </div>
  <form id="contactForm" class="story-card reveal" style="display:grid;gap:.8rem">
    <input type="text" name="name" placeholder="Your name" required style="padding:.8rem 1rem;border:1px solid var(--line-strong);border-radius:12px;font-family:var(--font-body)">
    <input type="email" name="email" placeholder="Your email" required style="padding:.8rem 1rem;border:1px solid var(--line-strong);border-radius:12px;font-family:var(--font-body)">
    <textarea name="message" rows="4" placeholder="How can Cherry help?" style="padding:.8rem 1rem;border:1px solid var(--line-strong);border-radius:12px;font-family:var(--font-body)"></textarea>
    <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
    <button class="btn btn-primary" type="submit">Send message</button>
    <p id="contactNote" style="margin:0;color:var(--cherry);font-size:.9rem" hidden></p>
  </form>
  <script>
  (function(){var f=document.getElementById('contactForm');if(!f)return;var t0=Date.now();
    f.addEventListener('submit',function(e){e.preventDefault();
      var note=document.getElementById('contactNote'),btn=f.querySelector('button');
      var email=(f.email.value||'').trim();
      if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){note.hidden=false;note.textContent='Please enter a valid email address.';return;}
      btn.disabled=true;btn.textContent='Sending...';
      fetch('/.netlify/functions/lead',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email,name:f.name.value.trim(),message:f.message.value.trim(),source:'contact',website:f.website.value,t:t0})})
      .then(function(r){return r.ok;}).catch(function(){return false;})
      .then(function(ok){ f.innerHTML='<p style="margin:0;color:var(--oxblood);font-weight:600">Thank you. Your message reached Cherry Sage, and she will be in touch soon.</p>'; });
    });})();
  </script>
</div></section>'''+cta()

# ---------- LIFE PATH / FREE TOOLS ----------
life='''<section class="page-hero banner"><div class="ph-glow" aria-hidden="true"></div><div class="ph-stars" aria-hidden="true"></div><div class="wrap reveal"><p class="eyebrow">Try something free first</p><h1>Free tools, from Cherry's own methods</h1><p class="lede">No pressure. Feel what a reading is like before you book.</p></div></section>
<section class="section" id="tools"><div class="wrap">
  <div class="card reveal" style="max-width:640px;margin:0 auto 2rem;text-align:center">
    <span class="chip">Free · Cherry's method</span>
    <h3>Life Path Calculator</h3>
    <p>Enter your birth date and get the number Cherry uses to open every reading.</p>
    <form id="lpForm" style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap;margin:.6rem 0">
      <input type="date" id="lpDate" required aria-label="Your birth date" style="padding:.7rem 1rem;border:1px solid var(--line-strong);border-radius:999px;font-family:var(--font-body);font-size:1rem">
      <button class="btn btn-gold" type="submit">Reveal my Life Path</button>
    </form>
    <div id="lpResult" hidden style="margin-top:1rem">
      <div style="font-family:var(--font-display);font-size:3rem;color:var(--oxblood)" id="lpNum"></div>
      <p id="lpMeaning" style="color:var(--ink-soft)"></p>
      <a class="btn btn-primary" href="shop.html">Go deeper with Cherry</a>
    </div>
    <p style="font-size:.78rem;color:var(--ink-soft);margin:.4rem 0 0">For reflection. A full reading with Cherry goes far beyond a single number.</p>
  </div>
  <div class="grid grid-3">
    <div class="card reveal"><span class="free-tag">Free</span><span class="chip">Tarot</span><h3>Tarot Card Pull</h3><p>Type your question, pull a card. Warm and personal, just for reflection.</p><a class="card-link" href="tarot-pull.html">Pull a free card →</a></div>
    <div class="card reveal"><span class="free-tag">Free</span><span class="chip">Numerology</span><h3>Karmic Accumulation Reading</h3><p>Cherry's own lead-in reading, a real look at what's following you into this chapter.</p><a class="card-link" href="numerology.html">About numerology →</a></div>
    <div class="card reveal"><span class="free-tag">Free</span><span class="chip">Daily</span><h3>Your Horoscope</h3><p>Yesterday, today, and tomorrow. A quiet daily check-in, back by popular request.</p><a class="card-link" href="#tools">Read today's →</a></div>
  </div>
</div></section>'''+cta()

page("meet.html","Meet Cherry Sage","Clairvoyant, clairaudient, empath and numerologist, reading honestly by phone since 1999.",meet,"meet.html")
page("psychic-reading.html","Psychic Reading","Honest, in-depth psychic phone readings on love, career and family. No fantasy answers.",psychic,"psychic-reading.html")
page("tarot.html","Tarot Card Reading","Clairvoyant, empathic tarot guidance through the cards' symbolism, grounded and honest.",tarot,"tarot.html")
page("numerology.html","Numerology Reports","Life Path, Expression, Soul Urge and Karmic Debt, calculated precisely and read honestly.",numerology,"numerology.html")
page("how-it-works.html","How It Works","Book and pay in one pass. First-timers get 5 free minutes.",how,"")
# testimonials.html owned by build_testimonials.py (all 390 reviews) — do not generate here
# blog.html + articles.html owned by build_blog.py (image cards) — do not generate here
page("contact.html","Contact","Reach Cherry Sage. Readings by phone, first-timers get 5 free minutes.",contact,"contact.html")
page("life-path.html","Free Tools","Free Life Path calculator and reflection tools from Cherry's own methods.",life,"life-path.html")

# ---------- FREE KARMIC ACCUMULATION READING ----------
karmic=hero_banner("Free · A reading you won't find elsewhere","Free Karmic Accumulation Reading",
  "This is not your typical numerology element. Your Karmic Accumulation is drawn from the full name you were given at birth.")+'''
<section class="section"><div class="wrap" style="max-width:720px">
  <div class="card reveal" style="margin-bottom:1.6rem;text-align:left">
    <p style="margin:0">For an accurate result, enter your <strong>full name exactly as it was recorded on your birth certificate</strong>. If you have more than four names, use the first three and then the last. If you were adopted as an infant, use your adoptive parents' names. Name changes will not give you an accurate reading.</p>
  </div>
  <form id="karmicForm" class="card reveal" style="display:grid;gap:1rem;text-align:left">
    <label style="display:grid;gap:.35rem;font-size:.9rem;color:var(--ink-soft)">Your full birth-certificate name
      <input type="text" name="fullname" placeholder="e.g. Mary Elizabeth Anne Smith" required autocomplete="off" style="padding:.85rem 1rem;border:1px solid var(--line-strong);border-radius:12px;font-family:var(--font-body);font-size:1rem"></label>
    <label style="display:grid;gap:.35rem;font-size:.9rem;color:var(--ink-soft)">Your date of birth
      <input type="date" name="dob" style="padding:.85rem 1rem;border:1px solid var(--line-strong);border-radius:12px;font-family:var(--font-body);font-size:1rem"></label>
    <button class="btn btn-primary" type="submit">Reveal my Karmic Accumulation</button>
    <p id="karmicNote" style="margin:0;color:var(--cherry);font-size:.9rem" hidden></p>
  </form>
  <div id="karmicResult" hidden style="margin-top:1.6rem"></div>
  <p class="center" style="margin-top:2rem;color:var(--ink-soft);font-size:.82rem">Karmic Accumulation method credited to Lynn Buess, <em>Numerology For The New Age</em>.</p>
</div></section>
<script>
(function(){
  var MAP={a:1,j:1,s:1,b:2,k:2,t:2,c:3,l:3,u:3,d:4,m:4,v:4,e:5,n:5,w:5,f:6,o:6,x:6,g:7,p:7,y:7,h:8,q:8,z:8,i:9,r:9};
  function reduce(n){var master=[11,22,33];while(n>9&&master.indexOf(n)<0){n=(''+n).split('').reduce(function(a,b){return a+ +b;},0);}return n;}
  var f=document.getElementById('karmicForm'),out=document.getElementById('karmicResult'),note=document.getElementById('karmicNote');
  f.addEventListener('submit',function(e){e.preventDefault();
    var name=(f.fullname.value||'').trim();
    var letters=name.toLowerCase().replace(/[^a-z]/g,'');
    if(letters.length<2){note.hidden=false;note.textContent='Please enter your full name.';return;}
    note.hidden=true;
    var total=0;for(var i=0;i<letters.length;i++){total+=MAP[letters[i]]||0;}
    var red=reduce(total);
    out.hidden=false;
    out.innerHTML='<div class="card reveal" style="text-align:center;border-color:var(--gold)">'+
      '<p class="eyebrow">Your Karmic Accumulation</p>'+
      '<div style="font-family:var(--font-display);font-size:3.4rem;color:var(--oxblood);line-height:1">'+total+'</div>'+
      '<p style="color:var(--ink-soft);margin:.3rem 0 0">reduces to <strong style="color:var(--cherry)">'+red+'</strong></p>'+
      '<p style="max-width:52ch;margin:1rem auto 0">Your Karmic Accumulation is the sum of every letter in your birth name, the energy you have carried and gathered across this lifetime. The number itself is only the doorway. What it means for <em>you</em>, and how it is shaping your path right now, is what Cherry reads with you, one to one.</p>'+
      '<a class="btn btn-gold" href="/shop.html" style="margin-top:1.2rem">Explore your number with Cherry</a>'+
      (window.CSFunnel?window.CSFunnel.optinHTML('karmic',''):'')+
    '</div>';
    if(window.CSFunnel&&window.CSFunnel.wireOptin) window.CSFunnel.wireOptin(out);
    out.scrollIntoView({behavior:'smooth',block:'center'});
  });
})();
</script>'''+cta()
page("free-karmic-reading.html","Free Karmic Accumulation Reading",
     "A free numerology reading from Cherry Sage. Your Karmic Accumulation, calculated from your full birth name.",karmic,"")

# ---------- MY ACCOUNT / REGISTRATION (hands off to WooCommerce) ----------
account=hero_banner("Your account","Sign in or create an account",
  "Your account keeps your details and your order history in one place, so booking again is quick and simple.")+f'''
<section class="section"><div class="wrap" style="max-width:720px">
  <div class="grid grid-2">
    <div class="card reveal" style="text-align:center">
      <span class="chip">Returning</span>
      <h3>Sign in</h3>
      <p>Welcome back. Sign in to see your readings, reports, and order history.</p>
      <a class="btn btn-primary" href="{ACCOUNT_URL}" target="_blank" rel="noopener">Sign in to my account</a>
    </div>
    <div class="card reveal" style="text-align:center">
      <span class="chip">New here</span>
      <h3>Create an account</h3>
      <p>Register in a moment to save your details, track your reports, and check out faster next time.</p>
      <a class="btn btn-gold" href="{ACCOUNT_URL}" target="_blank" rel="noopener">Create my account</a>
    </div>
  </div>
  <p class="center reveal" style="margin-top:2rem;color:var(--ink-soft);font-size:.9rem">Your account and password are kept securely in Cherry's booking system. You do not need an account to book, it just makes it easier.</p>
</div></section>'''+cta()
page("account.html","My Account","Sign in or create your Cherry Sage account to track your readings and orders.",account,"")
print("DONE")
