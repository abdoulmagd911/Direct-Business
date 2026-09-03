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
      /* Only ever use a client that already exists. Calling supabase's createClient, called with nothing passed in, with no
     arguments looks harmless — the v44a memoiser is meant to hand back the shared client — but
     if it happens to be the FIRST call on the page it builds a client with no project URL and
     no key, and memoises that broken thing for everything that follows: sign-in, Finance, the
     roster. That is a page-wide outage caused by a convenience fallback. So: wait for the real
     client rather than risk creating a hollow one. */
      var c=(window.fc?fc():null); if(!c){ loading=false; return; }
      if(!c){loading=false;return;}
      /* Read through team_nicknames() rather than app_users directly. A non-admin may only
         read their own row of app_users, so reading the table gave a manager a nickname list
         of one person and left every other name on screen as the legal one. The function
         returns display names only — no email, no role — so anyone signed in may call it. */
      c.rpc('team_nicknames').then(function(r){
        loading=false;
        if(!r||r.error||!Array.isArray(r.data)) return;
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

  /* Swap a person's full name for their nickname, but ONLY where a text node is WHOLLY that
     name (an owner cell, a dropdown option, the greeting line, the identity chip). Two bugs
     the old substring swap had, both found by the 2026-09-02 alias-collision audit:
       1. it corrupted any text that merely CONTAINED a name — a company literally called
          "Abu Faris Trading" became "Faris Trading", because "Abu Faris" is also a person.
       2. it was not idempotent and cascaded on a name collision: when one person's nickname
          equals another's FULL name (Salem's nickname is "Abu Faris"; "Abu Faris" is also a
          real full name), Salem's cell was swapped to "Abu Faris" and then a LATER paint
          re-swapped that to "Faris" — Salem shown under a third person's nickname.
     Whole-cell matching fixes (1). Marking each localized cell (data-nsw) and skipping it on
     later paints fixes (2): the cell is localized exactly once per render, the mark is wiped
     when render() rebuilds #view, so a language switch or reload re-localizes correctly. */
  function swapIn(root){
    if(!MAP||!root) return;
    var names=Object.keys(MAP); if(!names.length) return;
    var walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n, jobs=[];
    while((n=walker.nextNode())){
      var p=n.parentNode; if(!p||p.nodeType!==1) continue;
      if(p.getAttribute && p.getAttribute('data-nsw')==='1') continue;   // already localized this render
      var key=(n.nodeValue||'').trim();
      if(key && MAP[key]) jobs.push(n);                                  // WHOLE-cell match only
    }
    jobs.forEach(function(node){
      if(inTeamScreen(node)) return;
      var key=node.nodeValue.trim();
      var nick=window.nickOf(key);
      if(nick && nick!==key) node.nodeValue=node.nodeValue.replace(key,nick);  // keep surrounding whitespace
      try{ if(node.parentNode&&node.parentNode.setAttribute) node.parentNode.setAttribute('data-nsw','1'); }catch(_){}
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

    /* The Leads table redraws itself without going through render() — drawLeads() rebuilds the
       rows on every filter, sort and page change — so hooking render alone left the Owner
       column showing legal names. Watching the working area covers every redraw whatever
       triggered it. Only added and removed elements are watched, not text changes, so the
       swap this makes cannot set the watcher off again. */
    var target=document.getElementById('view');
    if(target && window.MutationObserver){
      var pending=null;
      new MutationObserver(function(){
        if(pending) return;
        pending=setTimeout(function(){ pending=null; paint(); }, 120);
      }).observe(target,{childList:true,subtree:true});
    }
  }catch(_){}

  console.info('%c[nicknames] people shown by the name colleagues use','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[nicknames] init',e);}})();
