/* Cherry Sage — Ivy, the on-site assistant. Helps visitors find their way, book, and
   opt in for weekly tips. Ivy is an assistant: she does NOT give readings or speak as
   Cherry. Client-side, scripted, no keys. Real reading is always by phone with Cherry. */
(function(){
  var btn=document.getElementById('chatWidget'); if(!btn) return;

  // ---- panel ----
  var panel=document.createElement('div');
  panel.className='cs-chat'; panel.hidden=true;
  panel.innerHTML=
    '<div class="cs-chat-head">'+
      '<span class="cs-chat-id"><span class="cs-chat-dot"></span> Ivy · Cherry Sage\'s assistant</span>'+
      '<button class="cs-chat-x" aria-label="Close chat">&times;</button>'+
    '</div>'+
    '<div class="cs-chat-log" aria-live="polite"></div>'+
    '<div class="cs-chat-quick"></div>'+
    '<form class="cs-chat-form"><input type="text" autocomplete="off" placeholder="Type your message…" aria-label="Message Ivy"><button type="submit" aria-label="Send">➤</button></form>';
  document.body.appendChild(panel);
  var log=panel.querySelector('.cs-chat-log'),
      quick=panel.querySelector('.cs-chat-quick'),
      form=panel.querySelector('.cs-chat-form'),
      input=form.querySelector('input');

  var QUICK=[['Readings & pricing','pricing'],['How it works','how'],['Book a reading','book'],
             ['Free card','free'],['Weekly tips','weekly']];
  function renderQuick(){
    quick.innerHTML='';
    QUICK.forEach(function(q){ var b=document.createElement('button'); b.type='button'; b.className='cs-chip';
      b.textContent=q[0]; b.onclick=function(){ user(q[0]); setTimeout(function(){ ivy(answer(q[1])); },220); };
      quick.appendChild(b); });
  }
  function bubble(who,html){ var d=document.createElement('div'); d.className='cs-msg cs-'+who; d.innerHTML=html;
    log.appendChild(d); log.scrollTop=log.scrollHeight; return d; }
  function user(t){ bubble('user',esc(t)); }
  function typing(){ return bubble('ivy','<span class="cs-typing"><i></i><i></i><i></i></span>'); }
  function ivy(html){ var t=typing(); setTimeout(function(){ t.innerHTML=html; log.scrollTop=log.scrollHeight; },420); }
  function esc(s){ return (s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  // ---- answers (from Cherry's real info) ----
  function cta(href,label){ return '<a class="cs-cta" href="'+href+'">'+label+'</a>'; }
  var _dc=0;
  var DEFAULTS=[
    "I want to point you the right way. Are you asking about a reading, pricing, how it works, or a free card?",
    "Cherry is the one who reads for you, one to one by phone. I can help you book, or answer how it works. What would help most?",
    "Good question. I am Ivy, Cherry's assistant, so I help with booking and finding your way around, not the reading itself. Want me to help you book, or show you a free card?",
    "For something that personal, Cherry reads it with you herself by phone. I can get you booked, or point you to a free tool to try first. Which sounds good?",
    "Happy to help. I can share pricing, how a reading works, get you booked, or send you to a free card pull. Where would you like to start?"
  ];
  function defaultReply(){ return DEFAULTS[_dc++ % DEFAULTS.length]+' '+cta('/book-appointment','Book with Cherry'); }
  function answer(key){
    switch(key){
      case 'thanks': return 'You are so welcome. Whenever you are ready, Cherry is here for you. '+cta('/book-appointment','Book a reading');
      case 'pricing': return 'Cherry reads by phone, one to one. First-time callers get a special rate (10 minutes for $24), and sessions run from 15 up to 60 minutes. There are also written numerology reports. '+cta('/shop.html','See all readings & pricing');
      case 'how': return 'It is simple: check availability, pick your time and how many minutes, and pay in one pass. No separate sign-up, no checking out twice. '+cta('/how-it-works.html','See how it works');
      case 'book': return 'Lovely. Choose a time that works for you and send Cherry a request. She confirms it directly, and at your time you call her for your reading. '+cta('/book-appointment','Book a reading');
      case 'free': return 'Yes! There is a free card you can pull, just for reflection. Want me to take you to it?'+cta('#draw','Draw a free card');
      case 'numerology': return 'Cherry reads Life Path, Expression, Soul Urge, and Karmic Debt. You can try the free Life Path calculator, or get a full written profile. '+cta('/life-path.html','Try free numerology');
      case 'weekly': return 'I can set that up. Leave your email and Cherry will send a few quick questions to get to know you, then honest weekly tips made just for you.'+
        '<form class="cs-chat-optin"><input type="email" placeholder="Enter your email address" required><button type="submit">Send me weekly tips</button></form><p class="cs-chat-note"></p>';
      case 'reading': return 'Cherry gives the readings herself, by phone, so they are truly personal. I am just her assistant here to help you find your way. Want to book, or pull a free card for reflection?'+cta('/book-appointment','Book with Cherry');
      case 'about': return 'Cherry has been reading since 1999, that is 27 years, and about 90% of her clients are repeat callers. She is honest over fantasy, always. '+cta('/meet.html','Meet Cherry');
      case 'available': return 'Cherry reads by phone. Choose a time that works for you and she will confirm it, then you call her at that time. '+cta('/book-appointment','Check times & book');
      case 'hi': return 'Hello, I am so glad you are here. I am Ivy, Cherry\'s assistant. I can help you book a reading, find pricing, or pull a free card. What would you like?';
      default: return defaultReply();
    }
  }
  function intent(t){ t=(t||'').toLowerCase();
    // "is Cherry free/available right now" is about availability, not the free card
    if(/\bfree\b.*(to talk|to chat|to call|to reach|right now|\brn\b|now|today)/.test(t)) return 'available';
    if(/\b(is|are|was|were|when'?s|whens|will)\s+(cherry|she|you)\b/.test(t) && /\b(free|available|around|online|there|here|now|today|open|reachable|to talk)\b/.test(t)) return 'available';
    if(/pric|cost|how much|rate|\$|expensive|cheap/.test(t)) return 'pricing';
    if(/book|appoint|schedul|call me|sign up|buy|minutes/.test(t)) return 'book';
    if(/how.*work|process|step|what happens/.test(t)) return 'how';
    if(/free|pull a card|tarot pull|draw/.test(t)) return 'free';
    if(/numerolog|life path|number|soul urge|karmic/.test(t)) return 'numerology';
    if(/weekly|tip|newsletter|subscribe|email|updates/.test(t)) return 'weekly';
    if(/who are you|are you cherry|are you real|ivy|bot|human/.test(t)) return 'reading';
    if(/reading|psychic|love|career|future|ex|relationship|money|job/.test(t)) return 'reading';
    if(/about|experience|years|since|trust|review/.test(t)) return 'about';
    if(/hour|open|online|available|time|when/.test(t)) return 'available';
    if(/thank|thanks|appreciate|grateful/.test(t)) return 'thanks';
    if(/^(hi|hey|hello|yo|good (morning|evening|afternoon))/.test(t)) return 'hi';
    return 'default';
  }

  // ---- interactions ----
  log.addEventListener('click',function(e){
    var a=e.target.closest('.cs-cta'); if(!a) return;
    if(a.getAttribute('href')==='#draw'){ e.preventDefault(); toggle(false);
      var d=document.getElementById('draw'); if(d) d.scrollIntoView({behavior:'smooth',block:'center'}); }
  });
  log.addEventListener('submit',function(e){
    var f=e.target.closest('.cs-chat-optin'); if(!f) return; e.preventDefault();
    var email=f.querySelector('input').value.trim(), note=f.parentElement.querySelector('.cs-chat-note');
    if(!(window.CSFunnel&&window.CSFunnel.valid(email))){ note.textContent='Please enter a valid email.'; return; }
    var b=f.querySelector('button'); b.disabled=true; b.textContent='…';
    (window.CSFunnel?window.CSFunnel.submit(email,'chat-weekly',''):Promise.resolve()).then(function(){
      f.parentElement.innerHTML='Wonderful. Check your inbox soon for a few gentle questions from Cherry, so she can make your weekly tips truly yours.';
    });
  });
  var convo=[]; // running history for the AI
  function scripted(t){ ivy(answer(intent(t))); }
  // turn Ivy's [[shop]]/[[free]]/[[contact]]/[[numerology]] tags into real CTA links
  function linkify(s){
    var map={shop:['/book-appointment','Book a reading'],free:['#draw','Draw a free card'],
             contact:['/contact.html','Reach Cherry'],numerology:['/life-path.html','Try free numerology']};
    return esc(s).replace(/\[\[(shop|free|contact|numerology)\]\]/g,function(_,k){
      return '<a class="cs-cta" href="'+map[k][0]+'">'+map[k][1]+'</a>'; });
  }
  function ivyText(html){ var t=typing(); setTimeout(function(){ t.innerHTML=html; log.scrollTop=log.scrollHeight; },420); }
  function ask(t){
    convo.push({role:'user',content:t});
    fetch('/.netlify/functions/ivy',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:convo})})
      .then(function(r){ return r.ok?r.json():{fallback:true}; })
      .then(function(d){
        if(d && d.reply){ convo.push({role:'assistant',content:d.reply}); ivyText(linkify(d.reply)); }
        else { scripted(t); }
      })
      .catch(function(){ scripted(t); });
  }
  form.addEventListener('submit',function(e){ e.preventDefault();
    var t=input.value.trim(); if(!t) return; input.value='';
    user(t); ask(t);
  });

  var greeted=false;
  function toggle(open){
    if(open===undefined) open=panel.hidden;
    panel.hidden=!open;
    btn.classList.add('hide-hint');
    btn.setAttribute('aria-expanded',String(open));
    if(open){ input.focus();
      if(!greeted){ greeted=true; renderQuick();
        ivy('Hello, I am so glad you are here. I am Ivy, Cherry\'s assistant. I can help you book a reading, find pricing, or pull a free card, just for reflection. What would you like?'); }
    }
  }
  btn.addEventListener('click',function(){ toggle(); });
  setTimeout(function(){ btn.classList.add('hide-hint'); },9000); // hint fades after a bit
  btn.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } });
  panel.querySelector('.cs-chat-x').addEventListener('click',function(){ toggle(false); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!panel.hidden) toggle(false); });
})();
