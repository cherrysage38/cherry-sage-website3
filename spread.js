/* Cherry Sage — Free Three-Card Tarot Spread (Past · Present · Future). For reflection only. */
(function(){
  // Shared 78-card deck (tarot-deck.js), same one tarot-pull.html uses, instead of this
  // page's own separate 22-card Major-Arcana-only copy, which had already drifted in
  // wording and missed the 56 Minor Arcana cards entirely.
  var DECK=window.CSTarotDeck||[];
  var HEAVY=/(suicide|kill myself|self.?harm|dying|death of|cancer|diagnos|pregnan|lawsuit|court|custody|medical|overdose)/i;
  var POS=[
    {key:"Past",    sub:"Where you are coming from", lead:"In what led here"},
    {key:"Present", sub:"Where you are right now",   lead:"Right now"},
    {key:"Future", sub:"Where this is heading",     lead:"Where this is leaning"}
  ];
  var q=document.getElementById('sQ'),
      s1=document.getElementById('sStep1'), s2=document.getElementById('sStep2'),
      spread=document.getElementById('sSpread'), result=document.getElementById('sResult'),
      dealBtn=document.getElementById('sDeal');
  if(!dealBtn) return;

  function esc(s){return (s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function lc(s){ return s.charAt(0).toLowerCase()+s.slice(1); }
  var picks=[], revealed=0;

  dealBtn.addEventListener('click',function(){
    var question=(q.value||'').trim();
    if(!question){ note("Take a breath and ask the cards a question first."); return; }
    if(HEAVY.test(question)){ gentle(); return; }
    // Dismiss the keyboard on our terms before we scroll -- its close animation racing our
    // own scrollIntoView is a known way for the page to jump unexpectedly on some phones.
    q.blur();
    var idx=[]; while(idx.length<3){ var r=Math.floor(Math.random()*DECK.length); if(idx.indexOf(r)<0) idx.push(r); }
    picks=idx.map(function(i){return {card:DECK[i], reversed:Math.random()<0.35};}); revealed=0;
    s1.hidden=true; s2.hidden=false; result.hidden=true;
    spread.innerHTML='';
    POS.forEach(function(pos,i){
      var col=document.createElement('div'); col.className='sp-col';
      col.innerHTML='<p class="sp-pos">'+pos.key+'</p><p class="sp-sub">'+pos.sub+'</p>';
      var c=document.createElement('button'); c.className='sp-card-back sp-card'; c.type='button';
      c.setAttribute('aria-label','Turn your '+pos.key+' card'); c.innerHTML='<span>✦</span>';
      c.addEventListener('click',function(){ flip(c,i); });
      col.appendChild(c); spread.appendChild(col);
    });
    setTimeout(function(){ s2.scrollIntoView({behavior:'auto',block:'start'}); },150);
  });

  function flip(btn,i){
    if(btn.classList.contains('chosen')) return;
    btn.classList.add('chosen'); btn.disabled=true;
    var pick=picks[i], c=pick.card, pos=POS[i], reversed=pick.reversed;
    btn.innerHTML='<span class="t-glyph"'+(reversed?' style="display:inline-block;transform:rotate(180deg)"':'')+'>'+c.g+'</span>';
    var card=document.createElement('div'); card.className='card sp-reveal reveal';
    var body=reversed ? lc(c.rv) : (lc(c.r)+' '+c.p);
    card.innerHTML='<h3 class="pull-name">'+c.n+(reversed?' <span style="font-size:.65em;color:var(--ink-soft);font-style:italic">(reversed)</span>':'')+'</h3><p class="t-keys">'+c.k+'</p>'+
      '<p class="pull-refl">'+pos.lead+', '+body+'</p>';
    btn.parentNode.appendChild(card);
    revealed++;
    if(revealed===3) setTimeout(summary,650);
  }

  function summary(){
    result.hidden=false;
    var question=(q.value||'').trim();
    result.innerHTML='<div class="card reveal" style="border-color:var(--gold);text-align:center">'+
      '<p class="eyebrow">Your spread</p>'+
      (question?'<p class="pull-q">Holding your question, '+esc(question.replace(/[.?!]+$/,''))+'…</p>':'')+
      '<p class="pull-refl">Three cards show the shape of a story: where it has been, where it stands, and where it is leaning. It is a spark for reflection, not the whole picture. Cherry reads the full story with you, one to one.</p>'+
      '<div class="t-actions"><a class="btn btn-gold" href="/book-appointment">Book a reading with Cherry</a> <button class="btn btn-ghost" id="sAgain" type="button">New spread</button></div>'+
      (window.CSFunnel?window.CSFunnel.optinHTML('tarot-spread',''):'')+
    '</div>';
    if(window.CSFunnel&&window.CSFunnel.wireOptin) window.CSFunnel.wireOptin(result);
    document.getElementById('sAgain').onclick=reset;
    result.scrollIntoView({behavior:'auto',block:'start'});
  }

  function note(t){ var n=document.getElementById('sQNote');
    if(!n){ n=document.createElement('p'); n.id='sQNote'; n.style.cssText='color:var(--cherry);font-size:.95rem;font-weight:600;margin:.7rem 0 0;transition:opacity .15s'; q.parentNode.appendChild(n); }
    n.textContent=t;
    n.scrollIntoView({behavior:'smooth',block:'center'});
    n.style.opacity='0';
    setTimeout(function(){ n.style.opacity='1'; q.focus(); },200);
  }
  function gentle(){ s1.hidden=true; s2.hidden=true; result.hidden=false;
    result.innerHTML='<div class="card"><p class="eyebrow">A gentle pause</p><h3>Let\'s slow down a moment</h3>'+
      '<p class="pull-refl">That sounds heavy, and it deserves far more than cards. This little tool is only for reflection. For something real and caring, please talk it through with Cherry, or reach a professional who can truly help.</p>'+
      '<a class="btn btn-primary" href="/book-appointment">Book a reading with Cherry</a></div>'; }
  function reset(){ result.hidden=true; s2.hidden=true; s1.hidden=false; s1.scrollIntoView({behavior:'smooth',block:'center'}); }
})();
