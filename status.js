/* Cherry Sage — live availability. The server decides what to say (her scheduled hours, holidays, an
   appointment happening now, Away/Vacation, and her one-tap status) and this script only paints it under
   "Chat with Ivy". Falls back to "online" if anything is unavailable. */
(function(){
  var LABELS={
    away:['offline','Cherry is away','Cherry is away'],
    holiday:['offline','Cherry is away today','Cherry is away today'],
    manual_unavailable:['offline','Cherry is not available right now','Cherry is unavailable'],
    manual_busy:['busy','Cherry is busy right now','Cherry is busy'],
    manual_brb:['busy','Cherry will be right back','Cherry is back soon'],
    appointment:['busy','Cherry is busy right now','Cherry is busy'],
    manual_online:['online','Cherry is Online','Cherry is online'],
    hours_open:['online','Cherry is Online','Cherry is online'],
    hours_closed:['offline','Cherry is Offline','Cherry is offline']
  };
  var DOT={online:'#54c46b',busy:'#d99b2e',offline:'#b33'};
  function describe(s){
    var c=s&&s.computed, l=c&&LABELS[c.reason];
    return l?{k:l[0],label:l[1],short:l[2]}:{k:'online',label:'Cherry is Online',short:'Cherry is online'};
  }
  function paint(st){
    document.querySelectorAll('.cw-status').forEach(function(el){
      // "Chat with Ivy" stays the headline so it never reads as a live line to Cherry; the small line
      // under it says in words what the dot means (phones have no hover, Bev 2026-09-20).
      el.innerHTML='<span class="cw-ivy">Chat with Ivy</span><span class="cw-cherry"><span class="status-dot"></span><span class="cw-cherry-text"></span></span>';
      el.setAttribute('title', st.label);
      el.querySelector('.cw-cherry-text').textContent=st.short;
      var dot=el.querySelector('.status-dot'); if(dot){ dot.style.background=DOT[st.k]; if(st.k!=='online') dot.style.animation='none'; }
    });
    var w=document.getElementById('chatWidget'); if(w){ w.setAttribute('data-status',st.k==='busy'?'brb':st.k); w.setAttribute('title', st.label); }
  }
  fetch('/.netlify/functions/schedule').then(function(r){return r.ok?r.json():null;})
    .then(function(s){ paint(describe(s)); })
    .catch(function(){ paint(describe(null)); });
})();
