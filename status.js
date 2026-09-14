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
    if(s.away) return {k:'offline',label:'Cherry is away'};
    if(s.holidays && s.holidays.indexOf(n.date)>=0) return {k:'offline',label:'Cherry is away today'};
    if(s.always) return {k:'online',label:'Cherry is Online'};
    var h=(s.hours||{})[n.day];
    if(h && n.hour>=h[0] && n.hour<h[1]) return {k:'online',label:'Cherry is Online'};
    return {k:'offline',label:'Cherry is Offline'};
  }
  function paint(st){
    var dotColors={online:'#54c46b',brb:'#d99b2e',offline:'#b33'};
    document.querySelectorAll('.cw-status').forEach(function(el){
      // Widget text always says "Chat with Ivy" so it never reads as a live line to
      // Cherry; the dot color carries her real phone-availability status, and the
      // full label ("Cherry is Online", etc) is still available on hover via title.
      el.innerHTML='<span class="status-dot"></span>Chat with Ivy';
      el.setAttribute('title', st.label);
      var dot=el.querySelector('.status-dot'); if(dot){ dot.style.background=dotColors[st.k]; if(st.k!=='online') dot.style.animation='none'; }
    });
    var w=document.getElementById('chatWidget'); if(w){ w.setAttribute('data-status',st.k); w.setAttribute('title', st.label); }
  }
  fetch('/.netlify/functions/schedule').then(function(r){return r.ok?r.json():null;})
    .then(function(s){ paint(compute(s)); })
    .catch(function(){ paint({k:'online',label:'Cherry is Online'}); });
})();
