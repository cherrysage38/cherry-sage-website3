/* Cherry Sage: DRAFT tags in the website editor's post lists (Bev, 2026-10-10: "I wanted to see if a post
   was a draft or live from within the editor ... Most editors have that info visible just on the list next
   to the title"). In the Blog Posts, Guest Articles and Pages lists, any post with unpublished work (a new
   post, or changes to a live one) gets a yellow DRAFT tag beside its title. No tag means it is live,
   exactly as shown. (A message bar at the top was tried first; Bev found the tags enough.)
   Sits beside the editor (Sveltia CMS) without changing it: the tags are drawn on our own see-through
   layer next to the title. Reads the site's public GitHub history only (open editor drafts and their
   files); changes nothing. */
(function(){
  var REPO='cherrysage38/cherry-sage-website3';
  var PULLS='https://api.github.com/repos/'+REPO+'/pulls?state=open&per_page=100';
  var RAW='https://raw.githubusercontent.com/'+REPO+'/';
  var DIRS={blog:'content/blog',articles:'content/articles',pages:'content/pages'};

  // Open editor drafts, kept for a minute so moving around doesn't keep asking GitHub.
  var pulls=null, pullsAt=0;
  function drafts(){
    if(pulls && Date.now()-pullsAt<60000) return pulls;
    pullsAt=Date.now();
    pulls=fetch(PULLS,{headers:{Accept:'application/vnd.github+json'}}).then(function(r){
      if(!r.ok) throw new Error('busy'); return r.json();
    }).then(function(list){
      return list.map(function(p){ var m=/^cms\/([a-z]+)\/(.+)$/.exec(p.head&&p.head.ref||'');
        return m?{kind:m[1], slug:m[2]}:null; }).filter(Boolean);
    });
    pulls.catch(function(){ pulls=null; });
    return pulls;
  }

  // The title the list shows: the live title for a changed post, the draft's own title for a new one.
  var titles={};
  function titleOf(raw){ var m=/^title:\s*(.*)$/m.exec((raw||'').split(/\n---/)[0]); return m?m[1].trim().replace(/^["']|["']$/g,''):''; }
  function listTitle(d){
    var key=d.kind+'/'+d.slug, file=DIRS[d.kind]+'/'+encodeURIComponent(d.slug)+'.md';
    if(titles[key]) return titles[key];
    titles[key]=Promise.all([
      fetch(RAW+'main/'+file,{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; }),
      fetch(RAW+'cms/'+d.kind+'/'+encodeURIComponent(d.slug)+'/'+file,{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; })
    ]).then(function(t){ return titleOf(t[0])||titleOf(t[1]); }).catch(function(){ return ''; });
    return titles[key];
  }

  var layer=null, tagged=[], observer=null, seq=0;
  function clearTags(){ seq++; tagged=[]; if(layer) layer.innerHTML=''; if(observer){ observer.disconnect(); observer=null; } }
  function findTitle(str){
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null), node;
    while((node=walker.nextNode())){
      if(layer&&layer.contains(node)) continue;
      var t=node.data.trim();
      // the list shows "Title — Topic" (pages: just "Title"), sometimes after "HIDDEN · ": match that exactly,
      // so a short title like "test" never lands on other words that merely start the same way
      if(t && (t===str || t.indexOf(str+' \u2014 ')===0 || t==='HIDDEN \u00b7 '+str || t.indexOf('HIDDEN \u00b7 '+str+' \u2014 ')===0)){ var el=node.parentElement, r=el&&el.getBoundingClientRect(); if(r&&r.width&&r.height) return el; }
    }
    return null;
  }
  function draw(){
    if(!layer){ layer=document.createElement('div'); layer.setAttribute('aria-hidden','true');
      layer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147482999'; document.body.appendChild(layer); }
    layer.innerHTML='';
    tagged.forEach(function(t){
      var el=(t.el&&document.contains(t.el))?t.el:findTitle(t.title); t.el=el; if(!el) return;
      var r=el.getBoundingClientRect(); if(!r.width||r.bottom<0||r.top>innerHeight) return;
      // right after the title text itself, not at the far end of a wide row
      var range=document.createRange(); range.selectNodeContents(el); var tr=range.getBoundingClientRect();
      var right=tr.width?Math.min(tr.right,r.right):r.right;
      var b=document.createElement('span');
      b.textContent='DRAFT';
      b.style.cssText='position:fixed;font:700 11px/1 system-ui,sans-serif;letter-spacing:.05em;padding:4px 7px;border-radius:999px;'+
        'border:1.5px solid #8A5A00;color:#8A5A00;background:#FFF3D6;white-space:nowrap';
      b.style.top=Math.round(r.top+r.height/2-10)+'px'; b.style.left=Math.round(Math.min(right+8, innerWidth-70))+'px';
      layer.appendChild(b);
    });
  }
  function tagList(kind){
    clearTags(); var me=seq;
    drafts().then(function(d){
      var mine=d.filter(function(x){ return x.kind===kind; });
      return Promise.all(mine.map(listTitle));
    }).then(function(found){ if(me!==seq) return;
      tagged=found.filter(Boolean).map(function(title){ return {title:title, el:null}; });
      if(!tagged.length) return;
      draw();
      var pending=0;
      observer=new MutationObserver(function(muts){
        if(pending) return;
        if(muts.every(function(m){ return layer&&layer.contains(m.target); })) return;   // our own redraws
        pending=setTimeout(function(){ pending=0; if(me===seq) draw(); },250);
      });
      observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    }).catch(function(){});
  }

  var last='';
  function check(force){
    var h=location.hash||''; if(!force && h===last) return; last=h;
    var list=/^#\/collections\/(blog|articles|pages)\/?(\?.*)?$/.exec(h);
    if(list) tagList(list[1]); else clearTags();
  }
  window.addEventListener('hashchange',function(){ check(false); });
  window.addEventListener('focus',function(){ pulls=null; check(true); });   // e.g. after saving in another tab
  window.addEventListener('scroll',function(){ if(tagged.length) draw(); },true);
  window.addEventListener('resize',function(){ if(tagged.length) draw(); });
  setInterval(function(){ check(false); },1000);          // the editor changes screens without always firing hashchange
  setInterval(function(){ if(/^#\/collections\//.test(location.hash)){ pulls=null; check(true); } },60000); // pick up new saves
})();
