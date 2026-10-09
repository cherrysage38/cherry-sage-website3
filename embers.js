/* Cherry Sage — floating amber embers across every section. Warm on dark, soft gold on light.
   Speed (Bev, 2026-10-09: "I can barely scroll my site"): each section's canvas used to be the full
   height of the section and was redrawn every frame with a canvas blur, which on the tall blog list
   meant repainting ~60 million pixels per frame. Now each canvas is at most one screen tall and
   slides to the part of the section in view, the glow is a pre-drawn sprite instead of shadowBlur,
   it draws 30 times a second at normal resolution, it holds still while the page is scrolling,
   and it stops entirely while no section is on screen. Same look. */
(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function isDark(sec){
    if(sec.classList.contains('section-dark')||sec.classList.contains('cta')) return true;
    // fallback: sample background luminance
    var bg=getComputedStyle(sec).backgroundColor||'';
    var m=bg.match(/rgba?\(([^)]+)\)/);
    if(m){ var p=m[1].split(',').map(parseFloat); var lum=0.2126*p[0]+0.7152*p[1]+0.0722*p[2];
      if(p[3]!==0 && lum<110) return true; }
    return false;
  }

  // soft round glow, drawn once per colour and stamped under each ember
  function glowSprite(rgb, blur){
    var R=Math.ceil(blur)+2, s=document.createElement('canvas'); s.width=s.height=R*2;
    var g=s.getContext('2d'), gr=g.createRadialGradient(R,R,0,R,R,R);
    gr.addColorStop(0,'rgba('+rgb+',0.55)'); gr.addColorStop(0.3,'rgba('+rgb+',0.22)'); gr.addColorStop(1,'rgba('+rgb+',0)');
    g.fillStyle=gr; g.fillRect(0,0,R*2,R*2);
    return {img:s, R:R};
  }

  // embers are soft glows, so normal resolution looks the same as retina at a quarter of the work
  var DPR=1, VH=window.innerHeight, fx=[], raf=0, odd=false, scrolling=0;
  // hold the embers still while the page is moving, so scrolling gets the computer's full attention
  window.addEventListener('scroll',function(){ clearTimeout(scrolling); scrolling=setTimeout(function(){ scrolling=0; },140); },{passive:true});

  var secs=[].slice.call(document.querySelectorAll('main section, .hero, .draw-section'));
  // de-dupe
  var seen=[]; secs=secs.filter(function(s){ if(seen.indexOf(s)>-1) return false; seen.push(s); return true; });

  secs.forEach(function(sec){
    var dark=isDark(sec);
    if(getComputedStyle(sec).position==='static') sec.style.position='relative';
    var c=document.createElement('canvas'); c.className='embers-canvas'; c.setAttribute('aria-hidden','true');
    sec.insertBefore(c, sec.firstChild);
    var f={sec:sec, c:c, ctx:c.getContext('2d'), es:[], W:0, H:0, CH:0, off:-1, vis:false,
      fill: dark ? '233,173,74' : '198,142,52',
      maxA: dark ? 0.72 : 0.52,
      dens: dark ? 26 : 32,   // lower = more embers
      glow: glowSprite(dark ? '226,140,46' : '214,158,70', dark ? 10 : 7)};
    fx.push(f);
    init(f);
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(en){ en.forEach(function(x){ f.vis=x.isIntersecting; }); start(); },{rootMargin:'120px'}).observe(sec);
    } else { f.vis=true; }
  });

  function spawn(f){ return {x:Math.random()*f.W, y:f.H+Math.random()*40,
    r:Math.random()*1.8+0.7, vy:-(Math.random()*0.34+0.14), vx:(Math.random()-0.5)*0.22,
    life:0, drift:Math.random()*6.28}; }
  function size(f){
    f.W=f.sec.clientWidth; f.H=f.sec.clientHeight; f.CH=Math.min(f.H, VH+40);
    f.c.width=Math.round(f.W*DPR); f.c.height=Math.round(f.CH*DPR); f.c.style.height=f.CH+'px';
    f.ctx.setTransform(DPR,0,0,DPR,0,0); f.off=-1;
  }
  function init(f){ size(f); var N=Math.max(18,Math.min(64,Math.round((f.W*f.H)/(f.dens*900)))); f.es=[];
    for(var i=0;i<N;i++){ var e=spawn(f); e.y=Math.random()*f.H; e.life=Math.random()*120; f.es.push(e); } }

  function draw(f){
    var top=f.sec.getBoundingClientRect().top, H=f.sec.clientHeight;
    if(Math.abs(H-f.H)>2) size(f);   // section grew or shrank (blog filter, late images)
    // slide the canvas over whatever part of the section is on screen
    var off=Math.max(0, Math.min(f.H-f.CH, -top-20));
    if(off!==f.off){ f.off=off; f.c.style.transform='translateY('+off+'px)'; }
    var ctx=f.ctx, g=f.glow, es=f.es;
    ctx.clearRect(0,0,f.W,f.CH);
    for(var i=0;i<es.length;i++){ var e=es[i];
      // drawn 30 times a second, so each step moves twice as far as the old 60-a-second version
      e.drift+=0.04; e.x+=2*(e.vx+Math.sin(e.drift)*0.12); e.y+=2*e.vy; e.vx+=(Math.random()-0.5)*0.03; e.life+=2;
      // ember rises the full height; fades in near the bottom, fades out only near the top
      var a=f.maxA;
      if(e.life<46) a*=e.life/46;                         // gentle fade-in at birth
      if(e.y < f.H*0.16) a*=Math.max(0, e.y/(f.H*0.16));  // fade out as it reaches the top
      if(e.y<-14){ es[i]=spawn(f); continue; }             // respawn only after reaching the top
      var y=e.y-off;
      if(y<-g.R || y>f.CH+g.R) continue;                   // off screen: move it, skip drawing
      ctx.globalAlpha=a; ctx.drawImage(g.img, e.x-g.R, y-g.R);
      ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(e.x,y,e.r,0,6.2832);
      ctx.fillStyle='rgba('+f.fill+','+a.toFixed(3)+')'; ctx.fill();
    }
  }
  function tick(){
    raf=0; var any=false; odd=!odd;
    for(var i=0;i<fx.length;i++){ if(fx[i].vis){ any=true; if(odd && !scrolling) draw(fx[i]); } }
    if(any) raf=requestAnimationFrame(tick);   // nothing on screen: stop until a section returns
  }
  function start(){ if(!raf) raf=requestAnimationFrame(tick); }
  start();

  var t; window.addEventListener('resize',function(){ clearTimeout(t); t=setTimeout(function(){
    VH=window.innerHeight; fx.forEach(init); start(); },220); });
})();
