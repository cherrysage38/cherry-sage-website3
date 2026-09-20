/* Cherry Sage — live availability. Reads the schedule and sets the "Cherry is Online/Away/Offline"
   status automatically, in Cherry's own time zone. Falls back to "online" if anything is unavailable. */
(function(){
  function nowIn(tz){
    try{
      var parts={}; new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour:'numeric',hour12:false,year:'numeric',month:'2-digit',day:'2-digit'})
        .formatToParts(new Date()).forEach(function(p){parts[p.type]=p.value;});
      var wd={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[parts.weekday];
      return {day:wd, hour:parseInt(parts.hour,10)%24, date:parts.year+'-'+parts.month+'-'+parts.day};
    }catch(e){ var d=new Date(); return {day:d.getDay(), hour:d.getHours(), date:''}; }
  }
  function compute(s){
    if(!s) return {k:'online',label:'Cherry is Online'};
    var n=nowIn(s.tz||'America/New_York');
    // A one-tap manual state from the Dashboard beats everything, since Bev set it on
    // purpose for right now. Next: away / holiday. A real confirmed appointment happening
    // right now comes after that, ahead of the plain online/offline hours check, since
    // it's a live fact about this exact moment.
    if(s.manualState==='not_available') return {k:'offline',label:'Cherry is not available right now'};
    if(s.manualState==='brb') return {k:'brb',label:'Cherry will be right back'};
    if(s.manualState==='available') return {k:'online',label:'Cherry is Online'};
    if(s.away) return {k:'offline',label:'Cherry is away'};
    if(s.holidays && s.holidays.indexOf(n.date)>=0) return {k:'offline',label:'Cherry is away today'};
    if(s.busyNow) return {k:'brb',label:'Cherry is on a call right now'};
    if(s.always) return {k:'online',label:'Cherry is Online'};
    var h=(s.hours||{})[n.day];
    if(h && n.hour>=h[0] && n.hour<h[1]) return {k:'online',label:'Cherry is Online'};
    return {k:'offline',label:'Cherry is Offline'};
  }
  // Short wording for the small line under "Chat with Ivy"; the full sentence stays in the hover title.
  function shortLabel(st){
    var m={'Cherry is Online':'Cherry is online','Cherry is Offline':'Cherry is offline','Cherry is away today':'Cherry is away today',
           'Cherry is on a call right now':'Cherry is on a call','Cherry is not available right now':'Cherry is unavailable',
           'Cherry will be right back':'Cherry is back soon'};
    return m[st.label]||st.label;
  }
  function paint(st){
    var dotColors={online:'#54c46b',brb:'#d99b2e',offline:'#b33'};
    document.querySelectorAll('.cw-status').forEach(function(el){
      // Widget text always says "Chat with Ivy" so it never reads as a live line to
      // Cherry; the dot color carries her real phone-availability status, and the
      // full label ("Cherry is Online", etc) is still available on hover via title.
      // Two lines: "Chat with Ivy" stays the headline (so it never reads as a live line to Cherry),
      // and a small line under it says in words what the dot means. Phones have no hover, so the
      // words are the only way a phone visitor sees Cherry's status (Bev, 2026-09-20).
      el.innerHTML='<span class="cw-ivy">Chat with Ivy</span><span class="cw-cherry"><span class="status-dot"></span><span class="cw-cherry-text"></span></span>';
      el.setAttribute('title', st.label);
      el.querySelector('.cw-cherry-text').textContent=shortLabel(st);
      var dot=el.querySelector('.status-dot'); if(dot){ dot.style.background=dotColors[st.k]; if(st.k!=='online') dot.style.animation='none'; }
    });
    var w=document.getElementById('chatWidget'); if(w){ w.setAttribute('data-status',st.k); w.setAttribute('title', st.label); }
  }
  fetch('/.netlify/functions/schedule').then(function(r){return r.ok?r.json():null;})
    .then(function(s){ paint(compute(s)); })
    .catch(function(){ paint({k:'online',label:'Cherry is Online'}); });
})();
