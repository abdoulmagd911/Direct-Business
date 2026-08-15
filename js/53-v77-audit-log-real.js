/* v77 — make the log actually log (2026-08-15).

   A real browser test found Activity & Audit showing "0 events today" after a morning of
   signing in, adding companies and editing invoices. It was right. Two reasons:

     1. `logAudit` stamped every entry with the name **'Abdelrahman'**, hard-coded. Whoever
        did the thing, the log said Abdelrahman did it. For a log whose whole job is telling
        you who did what, that is worse than empty.
     2. Almost nothing called it. Archiving and restoring wrote entries; signing in, adding a
        company, editing one, changing a stage, converting to a client and touching an invoice
        all wrote nothing at all.

   The owner asked for the admin and the manager to see the logs. This makes there be
   something to see. It records the ordinary working day — who signed in, and who created,
   changed, converted or deleted what — and nothing else: no keystrokes, no reading.        */
(function(){try{

  function whoAmI(){
    try{
      if(window.__userName && String(window.__userName).trim()) return String(window.__userName).trim();
      if(window.__userEmail) return String(window.__userEmail).split('@')[0];
      if(typeof meName==='function'){ var n=meName(); if(n) return n; }
    }catch(_){}
    return 'unknown';
  }

  /* 1 — every entry carries the person who actually did it */
  try{
    if(typeof window.logAudit==='function' && !window.logAudit.__v77){
      var orig=window.logAudit;
      var fixed=function(entity,entityId,action,detail){
        try{
          DB.audit=DB.audit||[];
          DB.audit.unshift({
            id:'a_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
            ts:Date.now(), user:whoAmI(), entity:entity, entityId:entityId,
            action:action, detail:detail||''
          });
          if(DB.audit.length>800) DB.audit=DB.audit.slice(0,800);
        }catch(_){ try{ return orig.apply(this,arguments); }catch(__){} }
      };
      fixed.__v77=1; window.logAudit=fixed;
    }
  }catch(_){}

  function note(entity,id,action,detail){
    try{ if(typeof logAudit==='function') logAudit(entity,id,action,detail||''); }catch(_){}
  }
  try{ window.__note=note; }catch(_){}

  /* 2 — signing in. Recorded once per session, when the app learns who you are. */
  try{
    var signedIn=false;
    setInterval(function(){
      try{
        if(signedIn) return;
        if(window.__roleKnown!==true) return;
        signedIn=true;
        note('session', (window.__userEmail||whoAmI()), 'sign in', (window.__userRole||''));
        if(typeof save==='function') save();
      }catch(_){}
    }, 2000);
  }catch(_){}

  /* 3 — the working day. Watch the lead list itself rather than every button that touches it:
     buttons come and go with each layer, but a company appearing, changing stage, becoming a
     client or leaving the list is the same event however it was triggered. */
  try{
    var seen=null;                       // id → {name, stage, isClient}
    function snapshot(){
      var m={};
      try{ (DB.businesses||[]).forEach(function(b){ if(b&&b.id!=null) m[b.id]={name:b.name||'', stage:b.stage||'', isClient:!!b.isClient}; }); }catch(_){}
      return m;
    }
    function sweep(){
      try{
        /* DB is a top-level `const`, NOT a property of window — `window.DB` is undefined and
           a guard written that way is always false, which is how this sweep sat silent while
           looking like it was running. Reference it by name. */
        if(typeof DB==='undefined' || !DB || !Array.isArray(DB.businesses)) return;
        if(window.__roleKnown!==true) return;          // don't log the loading phase
        var now=snapshot();
        if(seen===null){ seen=now; return; }           // first look: just remember
        var k;
        for(k in now){
          if(!seen[k]){ note('lead',k,'create',now[k].name); continue; }
          if(seen[k].stage!==now[k].stage) note('lead',k,'stage',now[k].name+': '+seen[k].stage+' → '+now[k].stage);
          if(!seen[k].isClient && now[k].isClient) note('lead',k,'convert to client',now[k].name);
          if(seen[k].name!==now[k].name) note('lead',k,'rename',seen[k].name+' → '+now[k].name);
        }
        for(k in seen){ if(!now[k]) note('lead',k,'delete',seen[k].name); }
        seen=now;
      }catch(_){}
    }
    setInterval(sweep, 4000);
  }catch(_){}

  /* 4 — money. The finance screen saves through its own helpers, so wrap those by name. */
  try{
    ['finSaveInvoice','finSaveRow','xpSave','finImportApply'].forEach(function(fn){
      try{
        var o=window[fn]; if(typeof o!=='function'||o.__v77) return;
        var w=function(){
          var r=o.apply(this,arguments);
          try{ note('finance', String(arguments[0]!=null?arguments[0]:''), fn==='xpSave'?'expense saved':'invoice saved',''); }catch(_){}
          return r;
        };
        w.__v77=1; window[fn]=w;
      }catch(_){}
    });
  }catch(_){}

  /* 5 — people. Adding, removing and re-levelling colleagues belongs in the log above all. */
  try{
    if(typeof window.__callAdmin==='function' && !window.__callAdmin.__v77){
      var ca=window.__callAdmin;
      var wrapped=function(p){
        var out=ca.apply(this,arguments);
        try{
          var a=(p&&p.action)||'';
          if(a==='create')             note('team', (p.email||''), 'add person', p.role||'');
          else if(a==='set_role')      note('team', (p.id||''), 'change level', p.role||'');
          else if(a==='set_active')    note('team', (p.id||''), p.active?'switch on':'switch off', '');
          else if(a==='reset_password')note('team', (p.id||''), 'reset password', '');
          if(a && a!=='list' && typeof save==='function') setTimeout(save, 400);
        }catch(_){}
        return out;
      };
      wrapped.__v77=1; window.__callAdmin=wrapped;
    }
  }catch(_){}

  console.info('%c[v77] the log records who did what','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v77] init',e);}})();
