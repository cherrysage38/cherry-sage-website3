/* Cherry Sage: Align left / center / right buttons on the Blog Posts editor toolbar (Bev, 2026-10-11).
   Each button adds a box to the post; whatever is typed in the box (text, bold, links, pictures) is lined
   up that way. It is saved in the post as
       <div class="align-center">

       the text

       </div>
   and scripts/build-blog.js turns that into centered (or left/right) text on the published post.
   Only the Blog Posts "Post" field offers these (see editor_components in config.yml), because the
   articles and pages builders do not understand them yet. */
(function(){
  if(!window.CMS) return;
  var SIDES=[
    {side:'left',   label:'Align left',   icon:'format_align_left'},
    {side:'center', label:'Align center', icon:'format_align_center'},
    {side:'right',  label:'Align right',  icon:'format_align_right'}
  ];
  SIDES.forEach(function(s){
    var open='<div class="align-'+s.side+'">';
    CMS.registerEditorComponent({
      id:'align-'+s.side,
      label:s.label,
      icon:s.icon,
      trigger:'button',
      fields:[{ label:'Text ('+s.side+'-aligned)', name:'text', widget:'markdown',
                required:false, editor_components:['image'], hint:'Type or paste the text to line up '+(s.side==='center'?'in the center':'on the '+s.side)+'.' }],
      // the text between the opening and closing tags, with the blank lines around it
      pattern:new RegExp('^'+open+'\\n([\\s\\S]*?)\\n</div>$','m'),
      fromBlock:function(m){ return { text:(m[1]||'').trim() }; },
      toBlock:function(p){ return open+'\n\n'+String((p&&p.text)||'').trim()+'\n\n</div>'; },
      toPreview:function(p){
        var el=document.createElement('div');
        el.style.textAlign=s.side;
        if(p&&p.text) CMS.renderRichText(el,String(p.text));
        return el;
      }
    });
  });
})();
