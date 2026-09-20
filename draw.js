/* Cherry Sage — home Draw-a-card: shuffle on scroll, fan, pick. For reflection only. */
(function(){
  var DECK=[
    {n:"The Fool",g:"✦",k:"New beginnings · a leap of faith",r:"A fresh chapter is opening. Trust the first step even before you can see the whole staircase."},
    {n:"The Magician",g:"✷",k:"Power · manifestation",r:"You already have what you need. This is a moment to act, not to wait."},
    {n:"The High Priestess",g:"☾",k:"Intuition · inner knowing",r:"The answer is quieter than the noise around it. Listen to what you already sense."},
    {n:"The Empress",g:"❀",k:"Nurturing · abundance",r:"Tend to what you love and it will grow. Softness is a strength here, not a weakness."},
    {n:"The Emperor",g:"◆",k:"Structure · stability",r:"A little order brings a lot of peace. Build the frame, and the rest can settle into it."},
    {n:"The Hierophant",g:"⌂",k:"Tradition · guidance",r:"There is wisdom in asking for help. The path you seek has been walked before."},
    {n:"The Lovers",g:"♡",k:"Connection · a choice",r:"A real choice of the heart is near. Choose from love, not from fear of loss."},
    {n:"The Chariot",g:"➤",k:"Willpower · momentum",r:"Hold your direction. You are closer than the doubt is telling you."},
    {n:"Strength",g:"∞",k:"Courage · gentle power",r:"You are stronger than the thing you are afraid of. Meet it with calm, not force."},
    {n:"The Hermit",g:"✦",k:"Reflection · wisdom",r:"A pause is not a step backward. Time alone is showing you something worth knowing."},
    {n:"Wheel of Fortune",g:"◍",k:"Cycles · a turning point",r:"Things are moving again. What felt stuck is beginning to turn in your favor."},
    {n:"Justice",g:"⚖",k:"Truth · balance",r:"Be honest with yourself first, and the right path becomes clear. Fairness finds you."},
    {n:"The Hanged Man",g:"⸙",k:"Surrender · new perspective",r:"Seeing this differently changes everything. Let go of the grip, just a little."},
    {n:"Death",g:"❖",k:"Transformation · rebirth",r:"An ending is making room for who you are becoming. This is renewal, not loss."},
    {n:"Temperance",g:"⚗",k:"Balance · healing",r:"Gentle and steady wins here. Blend the pieces slowly and let things heal."},
    {n:"The Star",g:"★",k:"Hope · clarity",r:"After a hard stretch, a little light returns. Keep your face toward it."},
    {n:"The Moon",g:"☽",k:"Intuition · the unseen",r:"Not everything is clear yet, and that is okay. Trust your feelings while the fog lifts."},
    {n:"The Sun",g:"☀",k:"Joy · success",r:"Warmth and good news are close. Let yourself feel hopeful again."},
    {n:"Judgement",g:"❋",k:"Awakening · a calling",r:"Something is asking you to rise to it. You are ready for the next version of your life."},
    {n:"The World",g:"◉",k:"Completion · wholeness",r:"A cycle is coming full circle. Honor how far you have come before the next one begins."},
    {n:"The Tower",g:"⚡",k:"Sudden change · truth",r:"A shake-up clears away what was not built to last. What remains is real and yours."},
    {n:"The Devil",g:"⛓",k:"Attachment · release",r:"Notice what quietly holds you. You have more freedom here than it wants you to believe."}
  ];
  var HEAVY=/(suicide|kill myself|self.?harm|\bdie\b|dying|death of|cancer|diagnos|pregnan|lawsuit|court|custody|overdose)/i;
  var deck=document.getElementById('drawDeck'); if(!deck) return;
  var qEl=document.getElementById('drawQ'), res=document.getElementById('drawResult');
  var N=7, reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards=[];

  function geom(){ var w=deck.clientWidth, mob=w<540;
    return {step:mob?40:60, lift:mob?11:15, rot:mob?6:8, mid:(N-1)/2}; }
  function fanT(i){ var g=geom(), d=i-g.mid;
    return 'translateX('+(d*g.step)+'px) translateY('+(Math.abs(d)*g.lift)+'px) rotate('+(d*g.rot)+'deg)'; }

  function build(){
    deck.innerHTML=''; cards=[];
    for(var i=0;i<N;i++){
      var el=document.createElement('button'); el.type='button'; el.className='draw-card';
      el.setAttribute('aria-label','Pick this card');
      el.innerHTML='<span class="dc-inner"><span class="dc-face dc-back">✦</span>'+
        '<span class="dc-face dc-front"><span class="dcf-glyph"></span><span class="dcf-name"></span></span></span>';
      el.style.setProperty('--t','translateX(0) translateY(0) rotate(0deg)');
      el.style.zIndex=i+1;
      (function(c){ c.addEventListener('click',function(){ pick(c); }); })(el);
      deck.appendChild(el); cards.push(el);
    }
  }
  function fan(){
    deck.classList.remove('shuffling'); deck.classList.add('ready');
    cards.forEach(function(c,i){
      c.style.setProperty('--t',fanT(i));
      c.style.transitionDelay=(i*0.04)+'s';
      var inner=c.querySelector('.dc-inner'); if(inner) inner.style.animationDelay=(i*0.35)+'s';
      setTimeout(function(){ c.style.transitionDelay=''; }, 720+i*40);
    });
  }
  function shuffle(){
    if(reduce){ fan(); return; }
    deck.classList.add('shuffling');
    var steps=3, s=0;
    (function step(){
      cards.forEach(function(c){
        c.style.setProperty('--t','translateX('+((Math.random()-0.5)*80)+'px) translateY('+((Math.random()-0.5)*22)+'px) rotate('+((Math.random()-0.5)*26)+'deg)');
      });
      s++;
      if(s<steps) setTimeout(step,210); else setTimeout(fan,240);
    })();
  }
  function sparkAt(el){
    if(window.CSMagic && window.CSMagic.burstEl) window.CSMagic.burstEl(el);
  }
  function pick(c){
    if(!deck.classList.contains('ready')||deck.classList.contains('done')) return;
    var question=(qEl&&qEl.value||'').trim();
    if(HEAVY.test(question)){ heavy(); return; }
    deck.classList.add('done');
    var card=DECK[Math.floor(Math.random()*DECK.length)];
    sparkAt(c);
    cards.forEach(function(o){ if(o!==c) o.classList.add('gone'); });
    c.classList.add('picked');
    c.querySelector('.dcf-glyph').textContent=card.g;
    c.querySelector('.dcf-name').textContent=card.n;
    c.style.setProperty('--t','translateX(0) translateY(-8px) scale(1.14)');
    setTimeout(function(){ c.classList.add('flip'); },150);
    setTimeout(function(){ reveal(card,question); },660);
  }
  function reveal(card,question){
    res.hidden=false;
    var lead=question? 'On what you asked, the card that came up is ' : 'Your card is ';
    var optin=(window.CSFunnel? window.CSFunnel.optinHTML('weekly-tips-draw',card.n) : '');
    res.innerHTML='<p class="eyebrow">Your card</p><p class="pull-name">'+card.n+'</p><p class="pull-keys">'+card.k+'</p>'+
      '<p class="pull-refl">'+lead+'<strong>'+card.n+'</strong>. '+card.r+'</p>'+
      '<p class="pull-note">For reflection only. A real reading with Cherry goes far beyond a single card.</p>'+
      '<div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="/book-appointment">Book a real reading</a> '+
      '<button class="btn btn-ghost" id="drawAgain" type="button">Pull another card</button></div>'+optin;
    document.getElementById('drawAgain').onclick=reset;
    if(window.CSFunnel&&window.CSFunnel.wireOptin) window.CSFunnel.wireOptin(res);
    res.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function heavy(){
    res.hidden=false;
    res.innerHTML='<p class="pull-name">A gentle pause</p><p class="pull-refl">That sounds heavy, and it deserves more than a card. This little tool is just for reflection. For something real and caring, please talk it through with Cherry, or reach someone who can help.</p><a class="btn btn-primary" href="/shop.html">Book a reading with Cherry</a>';
  }
  function reset(){ res.hidden=true; res.innerHTML=''; deck.classList.remove('done'); build(); requestAnimationFrame(fan); }

  build();
  var fired=false;
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(en){ en.forEach(function(e){
      if(e.isIntersecting && !fired){ fired=true; setTimeout(shuffle,180); io.disconnect(); }
    }); },{threshold:0.35});
    io.observe(deck);
  } else { shuffle(); }
  var rt; window.addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(function(){
    if(deck.classList.contains('ready')&&!deck.classList.contains('done')) fan();
  },220); });
})();
