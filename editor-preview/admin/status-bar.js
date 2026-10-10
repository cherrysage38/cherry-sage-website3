/* Cherry Sage: live/draft status inside the website editor (Bev, 2026-10-10: "I wanted to see if a post
   was a draft or live from within the editor"). Sits next to the editor (Sveltia CMS) without changing
   it: watches which post is open and shows a small coloured label in the bottom-left corner:
     LIVE   - on the site, no unpublished changes
     DRAFT  - has unpublished changes (Draft / In review / Ready); visitors still see the live version
     NEW    - not on the site yet
     HIDDEN - on file but "Hide from site" is ticked
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
  bar.style.cssText='position:fixed;left:16px;bottom:16px;z-index:2147483000;max-width:min(520px,calc(100vw - 32px));'+
    'font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:10px 14px;border-radius:12px;'+
    'box-shadow:0 8px 24px -10px rgba(0,0,0,.35);border:2px solid;cursor:pointer;display:none';
  bar.addEventListener('click',function(){ pulls=null; check(true); });
  function attach(){ if(!document.getElementById('csStatusBar')) document.body.appendChild(bar); }
  if(document.body) attach(); else document.addEventListener('DOMContentLoaded',attach);

  function show(kind, html){
    var c=COLORS[kind]; bar.style.color=c[0]; bar.style.background=c[1]; bar.style.borderColor=c[0];
    bar.innerHTML=html; bar.style.display='block';
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
    if(fresh){ show('new','NEW: this '+NOUN[fresh[1]]+' is not on your site yet. Save keeps it as a draft; it goes live only when you Publish.'); return; }
    if(list){
      show('info','Checking for drafts…');
      drafts().then(function(d){ if(my!==seq) return;
        var n=d.filter(function(x){ return x.kind===list[1]; }).length;
        if(n) show('draft',n+' unpublished draft'+(n===1?'':'s')+' here. Posts in this list show their live version; drafts are on the Workflow screen.');
        else show('live','Every '+NOUN[list[1]]+' in this list is exactly what is live on your site. No drafts waiting.');
      }).catch(function(){ if(my===seq) hide(); });
      return;
    }
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

  window.addEventListener('hashchange',function(){ check(false); });
  window.addEventListener('focus',function(){ check(true); });
  setInterval(function(){ check(false); },1000);          // the editor changes pages without always firing hashchange
  setInterval(function(){ if(bar.style.display!=='none'){ pulls=null; check(true); } },120000); // re-check after saving
})();
