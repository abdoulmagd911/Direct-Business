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

  /* 2 — signing in. RETIRED 2026-09-09 (live test N2). This used to append a "sign in" entry to
     DB.audit and call save() the moment the role was known — so every reload of the app sent a
     cloud write with nothing changed (the owner watched "Saving…" appear on a plain page open).
     Nobody reads that entry any more: js/63 replaced Activity & Audit with the database's own
     record_history, and DB.audit is a dead array that this line kept growing (capped at 800) and
     re-uploading with every session. Sign-ins are the auth system's record, not the workspace
     blob's. Kept as a comment so the next reader knows why there is no "signed in" line here. */

  /* 3 — the working day. Watch the lead list itself rather than every button that touches it:
     buttons come and go with each layer, but a company appearing, changing stage, becoming a
     client or leaving the list is the same event however it was triggered.

     RETIRED 2026-09-17 (fire #80). This sweep is what grew DB.audit, and DB.audit is the most
     expensive dead weight in the app. Measured, not guessed, by driving one real lead change live
     with every write intercepted so nothing reached the database:
       · the change sent ONE company row, 1,895 bytes — correct;
       · and a workspace patch of 131,273 bytes whose ONLY section was `audit`.
     In the stored workspace that section is 142,211 bytes of 478,462 — 30% of the whole blob,
     re-uploaded on every lead change and re-downloaded at every sign-in.
     Nothing reads it any more. Activity & Audit was moved to the database's own record_history on
     2026-08-21 (js/63), which logs every lead create/edit with the actor and the full before/after
     row — strictly more than this array ever held, and it cannot be edited from the app. The only
     other readers are `activityFor('invoice'|'booking', id)` on the invoice and booking cards, and
     they are inert: the live workspace holds 0 invoices, 0 bookings, 0 offers, 0 requests, and every
     entry in the array is entity 'lead' or 'session' — there has never been an invoice or booking
     entry to show. The in-app self-tests that assert the array is non-empty still pass, because the
     799 existing entries are left exactly where they are: this stops the GROWTH, it deletes nothing.
     Removing the stored section as well would take ~142 KB off every sign-in, but that is a deletion
     from the owner's live workspace, so it stays on the recommendation list rather than being done
     here. logAudit() itself is untouched and still available to any direct caller. */
  try{ if(!window.__v77SweepRetired){ window.__v77SweepRetired=true; } }catch(_){}
  if(false)try{
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
