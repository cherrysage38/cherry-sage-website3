/* Cherry Sage: "Drafts waiting" list (Bev, 2026-10-10: "I can't tell in a blog post in the editor if it is
   published/Live or in Draft form"). The website editor keeps every unpublished change as an open pull
   request on a "cms/<collection>/<slug>" branch, labelled with its Workflow status. This reads that list
   from the site's public GitHub history (no key needed) and draws it on the Dashboard and the Version
   history page. It only reads; it never changes anything. */
(function(){
  var API='https://api.github.com/repos/cherrysage38/cherry-sage-website3/pulls?state=open&per_page=100';
  var NOUN={blog:'Blog post',articles:'Guest article',pages:'Page'};
  var STATUS={'sveltia-cms/draft':'Draft','sveltia-cms/pending_review':'In review','sveltia-cms/pending_publish':'Ready to publish'};
  var cache=null;

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function pretty(slug){ var s=slug.replace(/-/g,' '); return s.charAt(0).toUpperCase()+s.slice(1); }
  function when(iso){ return new Date(iso).toLocaleString('en-US',{timeZone:'America/New_York',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'})+' Eastern'; }

  // Resolves to [{kind, slug, name, action, status, saved, preview, history}], newest first.
  function load(){
    if(cache) return cache;
    cache=fetch(API,{headers:{Accept:'application/vnd.github+json'}}).then(function(r){
      if(!r.ok) throw new Error(r.status===403||r.status===429?'busy':'http');
      return r.json();
    }).then(function(prs){
      return prs.map(function(p){
        var m=/^cms\/([a-z]+)\/(.+)$/.exec(p.head&&p.head.ref||''); if(!m) return null;
        var label=(p.labels||[]).map(function(l){ return l.name; }).filter(function(n){ return STATUS[n]; })[0];
        return {kind:m[1], slug:m[2], name:pretty(m[2]), noun:NOUN[m[1]]||'Item',
          action:/^Create /.test(p.title||'')?'New, not on the site yet':'Changes to a live '+(m[1]==='pages'?'page':m[1]==='articles'?'article':'post'),
          status:STATUS[label]||'Draft', saved:p.updated_at,
          preview:'https://deploy-preview-'+p.number+'--cherry-sage-website3.netlify.app/'+m[2],
          history:'/post-history.html?p='+m[1]+'/'+encodeURIComponent(m[2])};
      }).filter(Boolean).sort(function(a,b){ return a.saved<b.saved?1:-1; });
    });
    return cache;
  }

  // Draws the full list into el.
  function render(el){
    el.innerHTML='<p style="color:var(--ink-soft);font-size:.9rem">Checking for drafts…</p>';
    load().then(function(list){
      if(!list.length){ el.innerHTML='<p style="margin:0">No drafts waiting. Everything in the editor is what is live on your site (apart from anything set to Hide from site).</p>'; return; }
      el.innerHTML='<p style="margin:0 0 .8rem">'+list.length+' unpublished draft'+(list.length===1?'':'s')+'. None of these are on your site until you click Publish in the editor’s Workflow screen.</p>'+
        list.map(function(d){
          return '<div style="border:1px solid var(--gold);background:var(--cream,#fffdf7);border-radius:12px;padding:.8rem 1rem;margin:0 0 .6rem">'+
            '<div style="font-weight:600;color:var(--oxblood)">'+esc(d.name)+'</div>'+
            '<div style="font-size:.86rem;color:var(--ink-soft)">'+esc(d.noun)+' · '+esc(d.action)+' · <b>'+esc(d.status)+'</b> · saved '+esc(when(d.saved))+'</div>'+
            '<div style="font-size:.86rem;margin-top:.35rem"><a href="'+d.preview+'" target="_blank" rel="noopener">Preview the draft</a> · '+
            '<a href="/editor-preview/admin/#/workflow" target="_blank" rel="noopener">Open the Workflow screen</a>'+(d.action.indexOf('New')===0?'':' · <a href="'+d.history+'" target="_blank" rel="noopener">History of the live version</a>')+'</div></div>';
        }).join('');
    }).catch(function(e){
      el.innerHTML='<p style="color:var(--ink-soft);font-size:.9rem;margin:0">'+(e&&e.message==='busy'?'GitHub is limiting how often drafts can be checked right now. Please look again in about an hour.':'Could not check for drafts just now. Reload the page in a minute.')+'</p>';
    });
  }

  // The draft (if any) for one post: resolves to the entry or null.
  function forPost(kind, slug){ return load().then(function(list){ return list.filter(function(d){ return d.kind===kind&&d.slug===slug; })[0]||null; }); }

  window.csDrafts={load:load, render:render, forPost:forPost};
})();
