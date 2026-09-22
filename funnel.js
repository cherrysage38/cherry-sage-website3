/* Cherry Sage — lead funnel. Cards give the answer first, then invite a weekly-reading
   opt-in (email -> questionnaire -> Cherry's weekly tips). Captures to a Netlify form.
   For reflection only. */
(function(){
  var HERO={
    "☾":{n:"The Moon",k:"Intuition · the unseen",r:"Not everything is clear yet, and that is okay. Trust your feelings while the fog lifts. A truth is surfacing in its own time."},
    "✦":{n:"The Star",k:"Hope · clarity",r:"After a hard stretch, a little light returns. Keep your face toward it. What you are hoping for is closer than it feels."},
    "★":{n:"The Sun",k:"Joy · success",r:"Warmth and good news are near. Let yourself feel hopeful again. This is a season to step into, not shrink from."},
    "◉":{n:"The World",k:"Completion · wholeness",r:"A cycle is coming full circle. Honor how far you have come. Something is being completed so a new chapter can begin."}
  };
  var EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function submitLead(email, source, card){
    try{ var k='cs-leads', a=JSON.parse(localStorage.getItem(k)||'[]');
      a.push({email:email,source:source,card:card||'',t:Date.now()}); localStorage.setItem(k,JSON.stringify(a)); }catch(e){}
    return fetch('/.netlify/functions/lead',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email, source:source, card:card||''})})
      .then(function(r){ return r.ok; }).catch(function(){ return false; });
  }

  // weekly-reading opt-in block (shown AFTER the answer is revealed)
  function optinHTML(source,card){
    return '<div class="cs-optin" data-source="'+source+'" data-card="'+(card||'')+'">'+
      '<p class="cs-optin-h">Want a weekly reading from Cherry?</p>'+
      '<p class="cs-optin-sub">Leave your email and Cherry will send a few quick questions to get to know you, then honest weekly tips made just for you. No spam, ever.</p>'+
      '<form class="cs-optin-form" novalidate>'+
        '<input type="email" name="email" placeholder="Enter your email address" aria-label="Your email" required>'+
        '<button class="btn btn-primary" type="submit">Send me weekly readings</button>'+
      '</form><p class="cs-optin-note" hidden></p></div>';
  }
  function wireOptin(root){
    var box=root.querySelector('.cs-optin'); if(!box) return;
    var form=box.querySelector('.cs-optin-form'), note=box.querySelector('.cs-optin-note');
    form.addEventListener('submit',function(e){ e.preventDefault();
      var email=form.email.value.trim();
      if(!EMAIL.test(email)){ note.hidden=false; note.textContent='Please enter a valid email address.'; return; }
      var btn=form.querySelector('button'); btn.disabled=true; btn.textContent='Sending…';
      submitLead(email, box.getAttribute('data-source'), box.getAttribute('data-card')).then(function(){
        box.innerHTML='<p class="cs-optin-h">Wonderful.</p><p class="cs-optin-sub">Check your inbox soon for a few gentle questions from Cherry, so she can make your weekly tips truly yours.</p>';
      });
    });
  }
  window.CSFunnel={ submit:submitLead, valid:function(e){ return EMAIL.test((e||'').trim()); }, optinHTML:optinHTML, wireOptin:wireOptin };

  // ---- modal (built once) ----
  var overlay;
  function build(){
    overlay=document.createElement('div'); overlay.className='cs-modal'; overlay.hidden=true;
    overlay.innerHTML='<div class="cs-modal-card" role="dialog" aria-modal="true" aria-label="Your card">'+
      '<button class="cs-modal-x" aria-label="Close">&times;</button><div class="cs-modal-body"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',function(e){ if(e.target===overlay) close(); });
    overlay.querySelector('.cs-modal-x').addEventListener('click',close);
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!overlay.hidden) close(); });
  }
  function close(){ if(overlay){
      if(overlay.dataset.popup==='shuffle' && overlay.dataset.submitted!=='1'){
        try{ localStorage.setItem('cs-popup-shuffle-dismissed', String(Date.now())); }catch(e){}
      }
      overlay.hidden=true;
      var y=-parseInt(document.body.style.top||'0',10);
      document.body.style.position=''; document.body.style.top=''; document.body.style.width='';
      document.body.style.overflow='';
      window.scrollTo(0,y);
    } }
  function open(html){ if(!overlay) build(); overlay.querySelector('.cs-modal-body').innerHTML=html;
    // iOS Safari keeps rubber-band/momentum scrolling going even after overflow:hidden, so a
    // popup opened mid-scroll visibly jumps around under the user (this is what Bev saw on her
    // iPad). Pinning body to a fixed position at the current scroll offset stops it outright.
    var y=window.scrollY||window.pageYOffset||0;
    document.body.style.position='fixed'; document.body.style.top=(-y)+'px'; document.body.style.width='100%';
    overlay.hidden=false; document.body.style.overflow='hidden'; return overlay.querySelector('.cs-modal-body'); }

  function glyphOf(card){ for(var g in HERO){ if(HERO[g]===card) return g; } return '✦'; }

  function openCard(card){
    var body=open(
      '<div class="cs-reveal-card"><span class="cs-reveal-glyph">'+glyphOf(card)+'</span><span class="cs-reveal-name">'+card.n+'</span></div>'+
      '<p class="eyebrow">Your card</p><h3>'+card.n+'</h3>'+
      '<p class="cs-modal-keys">'+card.k+'</p>'+
      '<p class="cs-modal-refl">'+card.r+'</p>'+
      '<p class="cs-modal-fine">For reflection only. A real reading with Cherry goes far beyond a single card.</p>'+
      '<a class="btn btn-gold cs-modal-cta" href="/book-appointment">Book a real reading with Cherry</a>'+
      optinHTML('weekly-tips-hero', card.n)
    );
    wireOptin(body);
  }

  document.querySelectorAll('.float-card').forEach(function(fc){
    var g=(fc.querySelector('.fc-face')||{}).textContent||'✦';
    var card=HERO[g]||HERO['✦'];
    fc.addEventListener('click',function(e){ e.preventDefault();
      if(window.CSMagic&&window.CSMagic.burstEl) window.CSMagic.burstEl(fc);
      openCard(card);
    });
  });

  // ---- scroll-triggered "quick shuffle" email popup, homepage only ----
  // Quickly flickers through random glyphs (like a fast shuffle), lands on a real card
  // drawn from the full 78-card deck (window.CSTarotDeck, set by pull.js), then shows the
  // same weekly-reading email opt-in as the hero float-cards. Fires once per visit at ~25%
  // scroll depth; closing it without an email hides it for ~14 days, submitting hides it
  // for good.
  var GLYPHS=['✦','✷','☾','❀','◆','⌂','♡','➤','∞','◍','⚖','⸙','❖','⚗','★','☽','☀','❋','◉','⚡','⛓','△','❧','✧','◈'];
  function openShufflePopup(){
    var body=open('<div class="cs-reveal-card" id="cspCard"><span class="cs-reveal-glyph" id="cspGlyph">✦</span></div>'+
      '<p class="eyebrow">Shuffling…</p><h3 id="cspTitle">Finding your card</h3><div id="cspArea"></div>');
    overlay.dataset.popup='shuffle'; overlay.dataset.submitted='0';
    var box=body.querySelector('#cspCard'), glyphEl=body.querySelector('#cspGlyph');
    var n=0, ticks=9;
    var timer=setInterval(function(){
      n++;
      box.classList.remove('cs-reveal-card'); void box.offsetWidth; box.classList.add('cs-reveal-card');
      glyphEl.textContent=GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
      if(n>=ticks){
        clearInterval(timer);
        var deck=window.CSTarotDeck||[];
        var d=deck.length?deck[Math.floor(Math.random()*deck.length)]:null;
        finishShuffleReveal(body, d?{n:d.n,k:d.k,r:d.r,g:d.g}:null);
      }
    },110);
  }
  function finishShuffleReveal(body, card){
    if(!card){ close(); return; }
    var titleEl=body.querySelector('#cspTitle');
    body.querySelector('.eyebrow').textContent='Your card';
    if(titleEl) titleEl.outerHTML='<h3>'+card.n+'</h3>';
    body.querySelector('#cspGlyph').textContent=card.g;
    body.querySelector('#cspArea').innerHTML=
      '<p class="cs-modal-keys">'+card.k+'</p>'+
      '<p class="cs-modal-refl">'+card.r+'</p>'+
      '<p class="cs-modal-fine">For reflection only. A real reading with Cherry goes far beyond a single card.</p>'+
      '<a class="btn btn-gold cs-modal-cta" href="/book-appointment">Book a real reading with Cherry</a>'+
      optinHTML('popup-shuffle', card.n);
    wireOptin(body);
    var form=body.querySelector('.cs-optin-form');
    if(form) form.addEventListener('submit',function(){
      var email=(form.email.value||'').trim();
      if(EMAIL.test(email)){
        overlay.dataset.submitted='1';
        try{ localStorage.setItem('cs-popup-shuffle-submitted','1'); }catch(e){}
      }
    });
  }
  (function(){
    if(!/^\/(index\.html)?$/.test(location.pathname)) return;
    var DISMISS_KEY='cs-popup-shuffle-dismissed', SUBMIT_KEY='cs-popup-shuffle-submitted';
    var TWO_WEEKS=14*24*60*60*1000, fired=false;
    try{
      if(localStorage.getItem(SUBMIT_KEY)) return;
      var last=parseInt(localStorage.getItem(DISMISS_KEY)||'0',10);
      if(Date.now()-last < TWO_WEEKS) return;
    }catch(e){}
    function onScroll(){
      if(fired) return;
      var scrollable=document.documentElement.scrollHeight-window.innerHeight;
      if(scrollable<=40) return;
      if((window.scrollY/scrollable) >= .25){
        fired=true; window.removeEventListener('scroll',onScroll);
        if(!overlay || overlay.hidden) openShufflePopup();
      }
    }
    window.addEventListener('scroll',onScroll,{passive:true});
  })();

})();

/* nl-form-handler
   2026-09-23: this form had no bot protection at all (Bev found her signup list was mostly bots).
   The honeypot field is in the markup now; this just wires it up the same way the contact form's
   already does -- a hidden field real people never fill, plus how long the form sat open, both
   sent to lead.mjs, which already knows how to reject them. */
(function(){
  document.querySelectorAll('.nl-form').forEach(function(f){
    var openedAt=Date.now();
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var input=f.querySelector('input[type=email]');
      var hp=f.querySelector('input[name=website]');
      var note=f.parentNode.querySelector('.nl-note');
      var email=(input && input.value || '').trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ if(note)note.textContent='Please enter a valid email.'; return; }
      if(hp && hp.value){ if(note)note.textContent='Thank you, you are on the list.'; if(input)input.value=''; return; }
      var btn=f.querySelector('button'); if(btn)btn.disabled=true; if(note)note.textContent='Signing you up...';
      fetch('/.netlify/functions/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,source:'newsletter',website:hp?hp.value:'',t:openedAt})})
        .then(function(r){return r.json().catch(function(){return {};});})
        .then(function(){ if(note)note.textContent='Thank you, you are on the list.'; if(input)input.value=''; })
        .catch(function(){ if(note)note.textContent='Something went wrong, please try again.'; })
        .then(function(){ if(btn)btn.disabled=false; });
    });
  });
})();
