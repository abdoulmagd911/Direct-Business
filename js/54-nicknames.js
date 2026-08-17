/* ===== Show people by the name colleagues use (chapter, 2026-08-16) =====

   Owner's direction: Team & Access keeps the full official name — that is the record of
   truth and nothing here changes it. But everywhere the app shows a person as an owner, an
   assignee, or greets them, it should use their nickname: the English one when the app is in
   English, the Arabic one when it is in Arabic. Assem Alsweed is Abu Nasser to everyone who
   works with him, and a screen full of legal names reads like a payroll file.

   HOW, AND WHY THIS WAY. Owner names are written straight into the markup by a dozen
   different renderers — table cells, key-fact rows, dropdowns, chips, the greeting. Rewriting
   all of them would mean touching a dozen files for a cosmetic change. Instead this swaps the
   text after each render, and only ever the visible text:

     · <option> labels change, their value never does, so saving still writes the real name
       and "Mine" still matches on the full name
     · the Team & Access screen is skipped entirely — it must show official names
     · nothing else in the record is touched; this is display only

   If a person has no nickname on file, their full name shows, unchanged.                    */
(function(){try{
  var MAP=null, loading=false;

  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar')||document.documentElement.getAttribute('data-lang')==='ar'; }catch(_){ return false; } }

  function load(){
    if(MAP||loading) return; loading=true;
    try{
      var c=(window.fc?fc():null)||(window.supabase&&window.supabase.createClient&&window.supabase.createClient());
      if(!c){loading=false;return;}
      c.from('app_users').select('full_name,nickname,nickname_ar').then(function(r){
        loading=false;
        if(!r||r.error||!r.data) return;
        var m={};
        r.data.forEach(function(u){
          if(!u.full_name) return;
          var en=(u.nickname||'').trim(), ar=(u.nickname_ar||'').trim();
          if(!en && !ar) return;
          m[u.full_name]={en:en||u.full_name, ar:ar||en||u.full_name};
        });
        MAP=m;
        try{ window.__nickMap=m; }catch(_){}
        paint();
      });
    }catch(_){ loading=false; }
  }

  /* the nickname for a full name, in the language on screen */
  window.nickOf=function(fullName){
    try{
      var k=String(fullName||'').trim(); if(!k||!MAP) return fullName;
      var hit=MAP[k]; if(!hit) return fullName;
      return (isAr()? hit.ar : hit.en) || fullName;
    }catch(_){ return fullName; }
  };

  /* Team & Access shows official names — never rewrite inside it. */
  function inTeamScreen(node){
    try{
      var el=node.parentNode;
      while(el && el.nodeType===1){
        var id=el.id||'', cls=String(el.className||'');
        if(/v48|team|access/i.test(id) || /v48|team-screen/i.test(cls)) return true;
        el=el.parentNode;
      }
      return false;
    }catch(_){ return false; }
  }

  function swapIn(root){
    if(!MAP||!root) return;
    var names=Object.keys(MAP); if(!names.length) return;
    var walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n, jobs=[];
    while((n=walker.nextNode())){
      var t=n.nodeValue; if(!t || t.length<3) continue;
      for(var i=0;i<names.length;i++){
        if(t.indexOf(names[i])>=0){ jobs.push(n); break; }
      }
    }
    jobs.forEach(function(node){
      if(inTeamScreen(node)) return;
      var v=node.nodeValue;
      names.forEach(function(full){
        if(v.indexOf(full)>=0) v=v.split(full).join(window.nickOf(full));
      });
      if(v!==node.nodeValue) node.nodeValue=v;
    });
  }

  function paint(){
    try{
      if(!MAP) { load(); return; }
      /* the working area and the top-bar identity chip; the Team screen is filtered out inside */
      var view=document.getElementById('view'); if(view) swapIn(view);
      var chip=document.getElementById('v68me'); if(chip) swapIn(chip);
      var side=document.querySelector('.sidebar-foot,.side-foot'); if(side) swapIn(side);
    }catch(e){ if(window.console) console.warn('[nicknames] paint',e); }
  }
  try{ window.__nickPaint=paint; }catch(_){}

  /* run after every render, once the app knows who is signed in */
  try{
    var iv=setInterval(function(){
      if(typeof render!=='function') return;
      clearInterval(iv);
      var _r=render;
      render=function(){
        var out=_r.apply(this,arguments);
        try{ setTimeout(paint,0); setTimeout(paint,260); }catch(_){}
        return out;
      };
      load(); setTimeout(paint,600);
    },200);
    setTimeout(function(){ load(); paint(); }, 2500);
  }catch(_){}

  console.info('%c[nicknames] people shown by the name colleagues use','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[nicknames] init',e);}})();
