/* Cherry Sage: live/draft status inside the website editor (Bev, 2026-10-10: "I wanted to see if a post
   was a draft or live from within the editor"). Sits next to the editor (Sveltia CMS) without changing
   it: watches which post is open and shows a small coloured label at the top of the screen:
     LIVE   - on the site, no unpublished changes
     DRAFT  - has unpublished changes (Draft / In review / Ready); visitors still see the live version
     NEW    - not on the site yet
     HIDDEN - on file but "Hide from site" is ticked
   In a post list, posts with a draft get a DRAFT (or NEW) tag beside their title.
   Reads the site's public GitHub history only (open editor drafts + the live file); changes nothing. */
(function(){
  var REPO='cherrysage38/cherry-sage-website3';
  var PULLS='https://api.github.com/repos/'+REPO+'/pulls?state=open&per_page=100';
  var RAW='https://raw.githubusercontent.com/'+REPO+'/main/';
  var DIRS={blog:'content/blog',articles:'content/articles',pages:'content/pages'};
  var NOUN={blog:'post',articles:'article',pages:'page'};
  var STATUS={'sveltia-cms/draft':'Draft','sveltia-cms/pending_review':'In review','sveltia-cms/pending_publish':'Ready to publish'};
  var COLORS={live:['#1F6B3A','#E8F5EC'],draft:['#8A5A00','#FFF3D6'],'new':['#1D4E89','#E6F0FB'],hidden:['#555','#EEE'],info:['#6E1A28','#FFFDF8']};

  var bar=document.createElement('div');
  bar.id='csStatusBar'; bar.setAttribute('role','status'); bar.title='Click to check again';
  // Top of the screen by default, just under the editor's own toolbar (Bev: "It would be convenient at
  // the top"). The small arrow moves it to the bottom and back, remembered on this computer.
  var atBottom=false; try{ atBottom=localStorage.getItem('csStatusBarPos')==='bottom'; }catch(e){}
  var text=document.createElement('span'), mover=document.createElement('button');
  function place(){
    bar.style.top=atBottom?'auto':'60px'; bar.style.bottom=atBottom?'16px':'auto';
    mover.textContent=atBottom?'\u2191':'\u2193'; mover.title=atBottom?'Move this label to the top':'Move this label to the bottom';
  }
  bar.style.cssText='position:fixed;left:50%;transform:translateX(-50%);z-index:2147483000;max-width:min(640px,calc(100vw - 32px));'+
    'font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:8px 40px 8px 14px;border-radius:12px;'+
    'box-shadow:0 8px 24px -10px rgba(0,0,0,.35);border:2px solid;cursor:pointer;display:none';
  mover.type='button';
  mover.style.cssText='position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;'+
    'font:700 16px/1 system-ui,sans-serif;color:inherit;cursor:pointer;padding:4px 6px;opacity:.7';
  mover.addEventListener('click',function(e){ e.stopPropagation(); atBottom=!atBottom;
    try{ localStorage.setItem('csStatusBarPos',atBottom?'bottom':'top'); }catch(x){} place(); });
  bar.appendChild(text); bar.appendChild(mover); place();
  bar.addEventListener('click',function(){ pulls=null; titles={}; check(true); });
  function attach(){ if(!document.getElementById('csStatusBar')) document.body.appendChild(bar); }
  if(document.body) attach(); else document.addEventListener('DOMContentLoaded',attach);

  function show(kind, html){
    var c=COLORS[kind]; bar.style.color=c[0]; bar.style.background=c[1]; bar.style.borderColor=c[0];
    text.innerHTML=html; bar.style.display='block';
  }
  function hide(){ bar.style.display='none'; }

  // Open editor drafts, kept for a minute so moving between posts doesn't keep asking GitHub.
  var pulls=null, pullsAt=0;
  function drafts(){
    if(pulls && Date.now()-pullsAt<60000) return pulls;
    pullsAt=Date.now();
    pulls=fetch(PULLS,{headers:{Accept:'application/vnd.github+json'}}).then(function(r){
      if(!r.ok) throw new Error('busy'); return r.json();
    }).then(function(list){
      return list.map(function(p){ var m=/^cms\/([a-z]+)\/(.+)$/.exec(p.head&&p.head.ref||''); if(!m) return null;
        var l=(p.labels||[]).map(function(x){ return x.name; }).filter(function(n){ return STATUS[n]; })[0];
        return {kind:m[1], slug:m[2], status:STATUS[l]||'Draft'}; }).filter(Boolean);
    });
    pulls.catch(function(){ pulls=null; });
    return pulls;
  }

  var last='', seq=0;
  function check(force){
    var h=location.hash||'';
    if(!force && h===last) return; last=h;
    var my=++seq;
    var entry=/^#\/collections\/(blog|articles|pages)\/entries\/([^/?#]+)/.exec(h);
    var fresh=/^#\/collections\/(blog|articles|pages)\/new/.exec(h);
    var list=/^#\/collections\/(blog|articles|pages)\/?$/.exec(h);
    if(!list) clearTags();
    if(fresh){ show('new','NEW: this '+NOUN[fresh[1]]+' is not on your site yet. Save keeps it as a draft; it goes live only when you Publish.'); return; }
    if(list){
      show('info','Checking for drafts…');
      drafts().then(function(d){ if(my!==seq) return;
        var mine=d.filter(function(x){ return x.kind===list[1]; }), n=mine.length;
        if(n) show('draft',n+' unpublished draft'+(n===1?'':'s')+' here, tagged DRAFT or NEW beside the title. Every '+NOUN[list[1]]+' without a tag is live, exactly as shown.');
        else show('live','Every '+NOUN[list[1]]+' in this list is exactly what is live on your site. No drafts waiting.');
        tagList(list[1], mine, my);
      }).catch(function(){ if(my===seq) hide(); });
      return;
    }
    clearTags();
    if(!entry){ hide(); return; }
    var kind=entry[1], slug=decodeURIComponent(entry[2]), noun=NOUN[kind];
    show('info','Checking whether this '+noun+' is live…');
    Promise.all([
      drafts().catch(function(){ return null; }),
      fetch(RAW+DIRS[kind]+'/'+encodeURIComponent(slug)+'.md',{cache:'no-store'}).then(function(r){ return r.ok?r.text():null; }).catch(function(){ return null; })
    ]).then(function(res){ if(my!==seq) return;
      var d=res[0], live=res[1];
      var draft=d && d.filter(function(x){ return x.kind===kind&&x.slug===slug; })[0];
      var hidden=live && /^hidden:\s*["']?true/m.test(live.split(/\n---/)[0]);
      if(draft && !live) show('new','NEW, '+draft.status.toUpperCase()+': this '+noun+' is not on your site yet. It goes live when you Publish it.');
      else if(draft) show('draft','DRAFT ('+draft.status+'): this '+noun+' has unpublished changes. Visitors still see the live version until you Publish.');
      else if(hidden) show('hidden','HIDDEN: this '+noun+' is saved but "Hide from site" is ticked, so visitors cannot see it.');
      else if(live) show('live','LIVE: this '+noun+' is on your site, with no unpublished changes.'+(d?'':' (Could not check for drafts just now.)'));
      else hide();
    });
  }


  // ---- DRAFT / NEW tags beside titles in a post list ----
  // Drawn on our own see-through layer and placed next to the matching title on screen, so the editor's
  // own page is never touched. A draft's title comes from the draft's own file on its branch.
  var layer=null, tagged=[], titles={}, observer=null, tagSeq=0;
  function clearTags(){ tagSeq++; tagged=[]; if(layer) layer.innerHTML=''; if(observer){ observer.disconnect(); observer=null; } }
  function titleOf(raw){ var m=/^title:\s*(.*)$/m.exec((raw||'').split(/\n---/)[0]); return m?m[1].trim().replace(/^["']|["']$/g,''):''; }
  function draftTitle(d){
    var key=d.kind+'/'+d.slug, file=DIRS[d.kind]+'/'+encodeURIComponent(d.slug)+'.md';
    if(titles[key]) return titles[key];
    titles[key]=Promise.all([
      fetch('https://raw.githubusercontent.com/'+REPO+'/cms/'+d.kind+'/'+encodeURIComponent(d.slug)+'/'+file,{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; }),
      fetch(RAW+file,{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; })
    ]).then(function(t){ return {draft:titleOf(t[0]), live:titleOf(t[1]), isNew:!t[1]}; })
      .catch(function(){ return {draft:'',live:'',isNew:false}; });
    return titles[key];
  }
  function findTitle(str){
    if(!str) return null;
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null), node;
    while((node=walker.nextNode())){
      if((layer&&layer.contains(node))||bar.contains(node)) continue;
      var t=node.data.trim();
      if(t && (t===str || t.indexOf(str)===0)){ var el=node.parentElement, r=el&&el.getBoundingClientRect(); if(r&&r.width&&r.height) return el; }
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
      // the tag goes right after the title text itself, not at the far end of a wide row
      var range=document.createRange(); range.selectNodeContents(el); var tr=range.getBoundingClientRect();
      var right=tr.width?Math.min(tr.right,r.right):r.right;
      var b=document.createElement('span'), c=COLORS[t.isNew?'new':'draft'];
      b.textContent=t.isNew?'NEW':'DRAFT';
      b.style.cssText='position:fixed;font:700 11px/1 system-ui,sans-serif;letter-spacing:.05em;padding:4px 7px;border-radius:999px;'+
        'border:1.5px solid '+c[0]+';color:'+c[0]+';background:'+c[1]+';white-space:nowrap';
      b.style.top=Math.round(r.top+r.height/2-10)+'px'; b.style.left=Math.round(Math.min(right+8, innerWidth-70))+'px';
      layer.appendChild(b);
    });
  }
  function tagList(kind, mine, my){
    clearTags(); var me=tagSeq; if(!mine.length) return;
    Promise.all(mine.map(draftTitle)).then(function(info){ if(me!==tagSeq||my!==seq) return;
      // The list shows the live title for a changed post, and the draft's title for a brand-new one.
      tagged=info.map(function(x){ return {title:x.isNew?x.draft:(x.live||x.draft), isNew:x.isNew, el:null}; }).filter(function(t){ return t.title; });
      draw();
      var pending=0;
      observer=new MutationObserver(function(muts){
        if(pending) return;
        if(muts.every(function(m){ return layer&&layer.contains(m.target); })) return;   // our own redraws
        pending=setTimeout(function(){ pending=0; if(me===tagSeq) draw(); },250);
      });
      observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    });
  }
  window.addEventListener('scroll',function(){ if(tagged.length) draw(); },true);
  window.addEventListener('resize',function(){ if(tagged.length) draw(); });

  window.addEventListener('hashchange',function(){ check(false); });
  window.addEventListener('focus',function(){ check(true); });
  setInterval(function(){ check(false); },1000);          // the editor changes pages without always firing hashchange
  setInterval(function(){ if(bar.style.display!=='none'){ pulls=null; check(true); } },120000); // re-check after saving
})();
