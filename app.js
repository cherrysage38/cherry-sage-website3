/* Cherry Sage — Website 3 interactions */
(function(){
  // scroll reveal — anything already on screen at load (hero included) shows immediately,
  // never waits on the observer. Below-the-fold content still fades in on scroll.
  //
  // This also has to catch elements that don't exist yet at page load. Several features
  // (tarot pull/spread results, life-path, horoscope, any Pages-builder block) insert a fresh
  // .reveal element long after load, on click, sometimes many seconds later. The original code
  // only ever scanned .reveal once at load plus a single 1200ms safety-net pass, so anything
  // created after that point got the CSS default opacity:0 and NOTHING ever added .in to it --
  // permanently invisible on a real browser, not just slow. A MutationObserver below catches
  // every .reveal added at any time, however it's added, and runs it through the exact same
  // logic, so this can't silently regress again.
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:0.12, rootMargin:'0px 0px -8% 0px'});

  function revealOne(el,i){
    el.style.transitionDelay=((i||0)%3*0.08)+'s';
    var r=el.getBoundingClientRect();
    if(r.top < window.innerHeight && r.bottom > 0){ el.classList.add('in'); }
    else { io.observe(el); }
    // per-element safety net -- never let anything stay invisible for more than a moment,
    // however/whenever it was added, on any device/browser.
    setTimeout(function(){ el.classList.add('in'); }, 1200);
  }

  document.querySelectorAll('.reveal').forEach(revealOne);

  var mo = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      m.addedNodes.forEach(function(node){
        if(node.nodeType !== 1) return;
        if(node.classList && node.classList.contains('reveal') && !node.classList.contains('in')){ revealOne(node); }
        if(node.querySelectorAll){ node.querySelectorAll('.reveal:not(.in)').forEach(revealOne); }
      });
    });
  });
  mo.observe(document.body, {childList:true, subtree:true});

  // mobile nav
  var t=document.getElementById('navToggle'), n=document.getElementById('primaryNav');
  if(t&&n){ t.addEventListener('click',function(){ var o=n.classList.toggle('open'); t.setAttribute('aria-expanded',o); }); }
  n && n.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(){ n.classList.remove('open'); }); });

  // Life Path calculator
  var LP = {
    1:"The Leader. Independent, driven, a pioneer. Your path is about standing in your own authority.",
    2:"The Peacemaker. Intuitive, sensitive, diplomatic. Your path is about connection, balance, and partnership.",
    3:"The Communicator. Creative, expressive, joyful. Your path is about sharing your voice and lifting others.",
    4:"The Builder. Grounded, loyal, disciplined. Your path is about creating something stable and lasting.",
    5:"The Free Spirit. Adventurous, adaptable, curious. Your path is about freedom, change, and experience.",
    6:"The Nurturer. Caring, responsible, devoted. Your path is about love, home, and service to others.",
    7:"The Seeker. Introspective, wise, spiritual. Your path is about truth, depth, and inner knowing.",
    8:"The Powerhouse. Ambitious, capable, abundant. Your path is about mastery, and using power with integrity.",
    9:"The Humanitarian. Compassionate, wise, giving. Your path is about healing and serving the greater good.",
    11:"A Master Number. The Intuitive. Heightened insight and spiritual awareness. You are here to inspire.",
    22:"A Master Number. The Master Builder. You can turn big dreams into real things that outlast you.",
    33:"A Master Number. The Master Teacher. Rare and devoted, here to uplift through compassion and truth."
  };
  var EXPRESSION = {
    1:"The Original. Bold, self-starting, resourceful. Your gift is initiating what others hesitate to begin.",
    2:"The Collaborator. Warm, perceptive, fair. Your gift is bringing people together and smoothing what's rough.",
    3:"The Storyteller. Expressive, witty, magnetic. Your gift is communication that lifts a room.",
    4:"The Craftsman. Precise, reliable, patient. Your gift is building things that actually hold up.",
    5:"The Explorer. Versatile, quick, unafraid of change. Your gift is adapting faster than anyone around you.",
    6:"The Caretaker. Responsible, generous, steady. Your gift is making people and places feel safe.",
    7:"The Analyst. Perceptive, private, exacting. Your gift is seeing what's underneath the surface.",
    8:"The Executive. Confident, strategic, driven. Your gift is turning ambition into real results.",
    9:"The Idealist. Generous, artistic, broad-minded. Your gift is caring about more than yourself.",
    11:"A Master Number. The Illuminator. Your gift is inspiring others through your own sensitivity.",
    22:"A Master Number. The Architect. Your gift is building something practical out of a big vision.",
    33:"A Master Number. The Healer. Your gift is compassion put directly into action."
  };
  var SOUL_URGE = {
    1:"You want to lead, and to be respected for standing on your own.",
    2:"You want closeness, harmony, and to matter to the people near you.",
    3:"You want to be heard, and to fill life with color and expression.",
    4:"You want order, security, and something solid to stand on.",
    5:"You want freedom, movement, and to never feel boxed in.",
    6:"You want to love and be loved, and to belong somewhere real.",
    7:"You want understanding, solitude enough to think, and real truth.",
    8:"You want achievement, and recognition for what you've built.",
    9:"You want to matter to something bigger than yourself.",
    11:"You want to inspire, even when it asks more of you than most.",
    22:"You want your work to outlast you.",
    33:"You want to give more than most people think is possible."
  };
  var PERSONALITY = {
    1:"You come across as capable and self-assured, someone people follow without being asked to.",
    2:"You come across as easy to talk to, calm, and genuinely fair.",
    3:"You come across as lively, warm, and a little bit magnetic.",
    4:"You come across as dependable, someone people trust to get it right.",
    5:"You come across as interesting, spontaneous, hard to predict.",
    6:"You come across as caring, someone people bring their problems to.",
    7:"You come across as thoughtful, a little private, quietly perceptive.",
    8:"You come across as confident and in control.",
    9:"You come across as generous, worldly, and a bit old-soul.",
    11:"You come across as sensitive and unusually perceptive.",
    22:"You come across as grounded, but somehow larger than the room.",
    33:"You come across as warm in a way people don't forget."
  };
  var BIRTHDAY_NUM = {
    1:"An added gift for independence and initiative.",2:"An added gift for sensitivity and partnership.",
    3:"An added gift for creativity and self-expression.",4:"An added gift for discipline and structure.",
    5:"An added gift for adaptability and curiosity.",6:"An added gift for responsibility and care.",
    7:"An added gift for depth and reflection.",8:"An added gift for ambition and practical power.",
    9:"An added gift for compassion and generosity.",11:"An added gift for intuition, sharper than most.",
    22:"An added gift for building at scale.",33:"An added gift for selfless care."
  };
  var PERSONAL_YEAR = {
    1:"A year for beginnings. New starts, planting seeds, choosing your own direction.",
    2:"A year for patience. Relationships and cooperation move to the front.",
    3:"A year for expression. A good year to create, share, and be seen.",
    4:"A year for building. Steady effort now sets up what comes later.",
    5:"A year for change. Expect movement, and let it happen instead of resisting it.",
    6:"A year for responsibility. Home, family, and commitments take center stage.",
    7:"A year for reflection. Slow down, look inward, trust what you learn.",
    8:"A year for results. Effort from past years starts paying off.",
    9:"A year for closing. Let go of what's finished so something new has room."
  };
  var KARMIC_DEBT = {
    13:"Karmic Debt 13. In a past pattern, effort was avoided or shortcuts were taken. This life asks for real, steady work, and rewards it generously when it's given.",
    14:"Karmic Debt 14. In a past pattern, freedom or excess was misused. This life asks for balance and self-control, and offers real freedom in return for it.",
    16:"Karmic Debt 16. In a past pattern, ego or trust was broken. This life asks for humility and honesty, especially with yourself, and rebuilds something truer in its place.",
    19:"Karmic Debt 19. In a past pattern, independence or power leaned only inward. This life asks you to use your strength for more than yourself."
  };
  var LETTER_VAL = {a:1,j:1,s:1,b:2,k:2,t:2,c:3,l:3,u:3,d:4,m:4,v:4,e:5,n:5,w:5,f:6,o:6,x:6,g:7,p:7,y:7,h:8,q:8,z:8,i:9,r:9};
  var VOWELS = {a:1,e:1,i:1,o:1,u:1};
  function reduce(n, allowMaster){
    allowMaster = allowMaster !== false;
    while(n>9 && !(allowMaster && (n===11||n===22||n===33))){ n=String(n).split('').reduce(function(a,d){return a+ +d;},0); }
    return n;
  }
  function nameSum(name, filter){
    var letters=name.toLowerCase().replace(/[^a-z]/g,'');
    var sum=0;
    for(var i=0;i<letters.length;i++){
      var ch=letters[i];
      if(filter==='vowels' && !VOWELS[ch]) continue;
      if(filter==='consonants' && VOWELS[ch]) continue;
      sum += LETTER_VAL[ch]||0;
    }
    return sum;
  }
  function card(title, num, meaning){
    return '<div class="card" style="padding:1.2rem 1.4rem"><div style="display:flex;align-items:baseline;gap:.8rem">'+
      '<span style="font-family:var(--font-display);font-size:2.2rem;color:var(--oxblood)">'+num+'</span>'+
      '<h4 style="margin:0">'+title+'</h4></div>'+
      '<p style="color:var(--ink-soft);margin:.5rem 0 0">'+meaning+'</p></div>';
  }
  var f=document.getElementById('lpForm');
  if(f){ f.addEventListener('submit',function(e){
    e.preventDefault();
    var v=document.getElementById('lpDate').value; if(!v) return;
    var nameEl=document.getElementById('lpName');
    var name=(nameEl && nameEl.value || '').trim();
    var parts=v.split('-'); var yr=+parts[0], mo=+parts[1], dy=+parts[2];
    var digits=v.replace(/[^0-9]/g,'');
    var DEBT_NUMS=[13,14,16,19];
    var debtsFound=[];

    var lifePathRaw=digits.split('').reduce(function(a,d){return a+ +d;},0);
    // Karmic Debts show up in the sum BEFORE it's reduced down to a single digit or master
    // number, so this has to check the raw total, not the already-reduced result below.
    if(DEBT_NUMS.indexOf(lifePathRaw)>=0) debtsFound.push(lifePathRaw);
    var lifePath=reduce(lifePathRaw);
    var birthday=reduce(dy);
    if(DEBT_NUMS.indexOf(dy)>=0) debtsFound.push(dy);

    var out=[card('Life Path', lifePath, LP[lifePath]||'')];
    if(name){
      var expressionRaw=nameSum(name), soulUrgeRaw=nameSum(name,'vowels');
      if(DEBT_NUMS.indexOf(expressionRaw)>=0) debtsFound.push(expressionRaw);
      if(DEBT_NUMS.indexOf(soulUrgeRaw)>=0) debtsFound.push(soulUrgeRaw);
      var expression=reduce(expressionRaw);
      var soulUrge=reduce(soulUrgeRaw);
      var personality=reduce(nameSum(name,'consonants'));
      out.push(card('Expression (Destiny)', expression, EXPRESSION[expression]||''));
      out.push(card('Soul Urge (Heart\'s Desire)', soulUrge, SOUL_URGE[soulUrge]||''));
      out.push(card('Personality', personality, PERSONALITY[personality]||''));
    }
    out.push(card('Birthday Number', birthday, BIRTHDAY_NUM[birthday]||''));
    var currentYear=new Date().getFullYear();
    var personalYear=reduce(mo+dy+currentYear, false);
    out.push(card('Personal Year ('+currentYear+')', personalYear, PERSONAL_YEAR[personalYear]||''));
    // Not everyone has one, only shown when a real debt number actually turns up.
    debtsFound.filter(function(d,i){return debtsFound.indexOf(d)===i;}).forEach(function(d){
      out.push(card('Karmic Debt', d, KARMIC_DEBT[d]));
    });
    out.push('<div style="text-align:center;margin-top:.4rem"><a class="btn btn-primary" href="/shop">Go deeper with Cherry</a></div>');

    var resultEl=document.getElementById('lpResult');
    resultEl.innerHTML=out.join('');
    resultEl.hidden=false;
  }); }

  // chat widget (front-end stub for concept)
  var cw=document.getElementById('chatWidget');
  cw && cw.addEventListener('click',function(){ window.location.hash='#book'; });
})();

/* 2026-09-02: scale Bev's fixed 1600x480 page headers to fit width (keeps real text + SVG animations) */
(function(){
  function scaleHeaders(){
    document.querySelectorAll('.cs-hdr').forEach(function(h){
      var inner=h.querySelector('.cs-hdr-in'); if(!inner) return;
      var s=h.clientWidth/1600;
      inner.style.transform='scale('+s+')';
      inner.style.transformOrigin='top left';
      h.style.height=(480*s)+'px';
    });
  }
  window.addEventListener('resize',scaleHeaders,{passive:true});
  window.addEventListener('load',scaleHeaders);
  if(document.readyState!=='loading') scaleHeaders(); else document.addEventListener('DOMContentLoaded',scaleHeaders);
})();

/* 2026-09-11: shared multi-item cart (localStorage) + floating cart widget.
   Lives here (app.js, already loaded sitewide) instead of a new <script> tag so adding a real
   cart didn't require touching the nav/footer chrome on 180+ static pages. Any page can call
   window.CSCart.add({...}) to add an item; the widget below renders itself automatically. */
window.CSCart = (function(){
  var KEY = 'cs_cart';
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } }
  function write(items){ try{ localStorage.setItem(KEY, JSON.stringify(items)); }catch(e){} renderWidget(); }
  function add(item){
    var items = read();
    items.push({
      readingProductId: item.readingProductId, name: item.name, priceCents: item.priceCents,
      details: item.details || null, lineId: 'l'+Date.now()+Math.random().toString(36).slice(2,7)
    });
    write(items);
    return items;
  }
  function remove(lineId){ write(read().filter(function(it){ return it.lineId!==lineId; })); }
  function clear(){ write([]); }
  function get(){ return read(); }
  function count(){ return read().length; }
  function total(){ return read().reduce(function(s,it){ return s+(it.priceCents||0); },0); }

  function renderWidget(){
    var items = read();
    var el = document.getElementById('csCartWidget');
    if(!items.length){ if(el) el.remove(); return; }
    if(!el){
      el = document.createElement('a');
      el.id = 'csCartWidget';
      el.href = '/cart.html';
      el.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:900;display:flex;align-items:center;gap:.5rem;'+
        'background:#6E1A28;color:#FFFDF8;font-family:Lora,Georgia,serif;font-size:.85rem;font-weight:600;'+
        'padding:.7rem 1.1rem;border-radius:999px;box-shadow:0 8px 26px -12px rgba(74,15,25,.5);text-decoration:none;'+
        'transition:transform .15s ease';
      el.onmouseenter=function(){ el.style.transform='translateY(-2px)'; };
      el.onmouseleave=function(){ el.style.transform='none'; };
      document.body.appendChild(el);
    }
    var money = '$'+(total()/100).toFixed(2);
    el.innerHTML = '<span aria-hidden="true">&#128715;</span> Cart ('+items.length+') &middot; '+money;
  }

  if(document.readyState!=='loading') renderWidget(); else document.addEventListener('DOMContentLoaded', renderWidget);

  return { add: add, remove: remove, clear: clear, get: get, count: count, total: total };
})();
