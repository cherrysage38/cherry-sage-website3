/* Cherry Sage — Free Tarot Card Pull (for reflection only). Deck is always visible and
   shuffleable for fun; drawing an actual card + reading needs a question first. */
(function(){
  var DECK=window.CSTarotDeck||[];
  var HEAVY=/(suicide|kill myself|self.?harm|dying|death of|cancer|diagnos|pregnan|lawsuit|court|custody|medical|overdose)/i;
  // All 78 cards are in play for the actual draw (pick() below always chooses randomly
  // from the full DECK). The fan only ever shows a smaller number of card-backs at once —
  // fanning all 78 individually made the spread absurdly wide and over-rotated.
  var SPREAD=Math.min(DECK.length,22);

  // Support multiple copies of this widget on one page (e.g. homepage + its own page),
  // each scoped by a data-scope attribute on a wrapping element, falling back to the
  // original unscoped ids so the existing tarot-pull.html markup keeps working untouched.
  var widgets=document.querySelectorAll('[data-tarot-widget]');
  if(widgets.length===0 && document.getElementById('tShuffle')) widgets=[document.body];

  widgets.forEach(function(scope){ initWidget(scope); });

  function initWidget(scope){
    var q=scope.querySelector('#tQ'),
        spread=scope.querySelector('#tSpread'), result=scope.querySelector('#tResult'),
        shuffleBtn=scope.querySelector('#tShuffle');
    if(!shuffleBtn||!spread) return;
    shuffleBtn.textContent='Shuffle the deck';

    function esc(s){return (s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

    // Bev's call (2026-09-08): a static fan you click directly to pick a card. The button
    // only re-shuffles/re-fans the deck; it never picks anything by itself.
    function buildDeck(){
      result.hidden=true;
      spread.hidden=false;
      spread.innerHTML='';
      spread.style.setProperty('--n',SPREAD);
      spread.classList.remove('fanned');
      spread.classList.add('shuffling');
      for(var i=0;i<SPREAD;i++){
        var c=document.createElement('button');
        c.className='t-card-back'; c.type='button'; c.setAttribute('aria-label','Pick this card');
        c.style.setProperty('--i',i); c.style.setProperty('--n',SPREAD);
        c.style.setProperty('--d',Math.abs(i-(SPREAD-1)/2));
        c.style.setProperty('--shuffleDir',i%2===0?1:-1);
        c.innerHTML='<span>✦</span>';
        c.addEventListener('click',pick);
        spread.appendChild(c);
      }
      setTimeout(function(){
        spread.classList.remove('shuffling'); spread.classList.add('fanned');
      },900);
    }

    // Deck is visible and re-shufflable right away, no question required for this part.
    buildDeck();
    shuffleBtn.addEventListener('click',buildDeck);

    function pick(e){
      var question=(q&&q.value||'').trim();
      if(!question){
        var n=scope.querySelector('#tQNote');
        if(!n){ n=document.createElement('p'); n.id='tQNote'; n.style.cssText='color:var(--cherry);font-size:.95rem;font-weight:600;margin:.7rem 0 0;text-align:center;transition:opacity .15s'; (q?q.parentNode:spread.parentNode).appendChild(n); }
        n.textContent='Take a breath and ask the cards a question first, then choose your card.';
        n.scrollIntoView({behavior:'smooth',block:'center'});
        n.style.opacity='0';
        setTimeout(function(){ n.style.opacity='1'; if(q) q.focus(); },200);
        return;
      }
      if(HEAVY.test(question)){ gentle(); return; }

      // Dismiss the keyboard right away, on our terms. Otherwise its close animation and our
      // own scroll-into-view below can fire at nearly the same moment and fight each other,
      // which on some phones shows up as the page suddenly jumping and the reveal landing
      // off-screen, looking like nothing happened.
      if(q) q.blur();

      var chosen=e.currentTarget;
      [].slice.call(spread.querySelectorAll('.t-card-back')).forEach(function(b){ if(b!==chosen) b.classList.add('dim'); b.disabled=true; });
      chosen.classList.add('chosen');
      var c=DECK[Math.floor(Math.random()*DECK.length)];
      // Reversed about a third of the time, matching how most real readers use it: upright
      // is still the more common draw, reversed is the exception worth noticing.
      var reversed=Math.random()<0.35;
      var qline='<p class="pull-q">Holding your question, '+esc(question.replace(/[.?!]+$/,''))+'…</p>';
      setTimeout(function(){
        spread.hidden=true;
        result.hidden=false;
        result.innerHTML='<div class="card reveal t-reveal" style="border-color:var(--gold)">'+
          '<div class="t-face"><span class="t-glyph"'+(reversed?' style="display:inline-block;transform:rotate(180deg)"':'')+'>'+c.g+'</span></div>'+
          '<p class="eyebrow">Your card'+(reversed?', reversed':'')+'</p><h2 class="pull-name">'+c.n+(reversed?' <span style="font-size:.6em;color:var(--ink-soft);font-style:italic">(reversed)</span>':'')+'</h2>'+
          '<p class="t-keys">'+c.k+'</p>'+
          qline+
          '<p class="pull-refl">'+(reversed?c.rv:(c.r+' '+c.p))+'</p>'+
          '<p class="t-forreflection">A single card is a spark, not the whole story. Cherry reads the full picture with you, one to one.</p>'+
          '<div class="t-actions"><a class="btn btn-gold" href="/book-appointment">Book a reading with Cherry</a> <button class="btn btn-ghost" id="tAgain" type="button">Pull again</button></div>'+
          (window.CSFunnel?window.CSFunnel.optinHTML('tarot-pull',''):'')+
        '</div>';
        if(window.CSFunnel&&window.CSFunnel.wireOptin) window.CSFunnel.wireOptin(result);
        var again=scope.querySelector('#tAgain');
        if(again) again.onclick=function(){ if(q)q.value=''; buildDeck(); };
        result.scrollIntoView({behavior:'auto',block:'start'});
      },650);
    }

    function gentle(){
      spread.hidden=true;
      result.hidden=false;
      result.innerHTML='<div class="card t-reveal"><p class="eyebrow">A gentle pause</p><h2>Let\'s slow down a moment</h2>'+
        '<p class="pull-refl">That sounds heavy, and it deserves far more than a card. This little tool is only for reflection. For something real and caring, please talk it through with Cherry, or reach a professional who can truly help.</p>'+
        '<a class="btn btn-primary" href="/book-appointment">Book a reading with Cherry</a> <button class="btn btn-ghost" id="tAgain" type="button">Start over</button></div>';
      var again=scope.querySelector('#tAgain');
      if(again) again.onclick=function(){ if(q)q.value=''; buildDeck(); };
    }
  }

})();
