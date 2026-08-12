/* v28 — Tidy the Settings page for employees.
   The Settings page had accumulated developer/QA scaffolding (test-suite runners,
   "wipe test data", "reset for go-live", build version numbers, a reconcile step
   that points at a developer's local drive). None of that belongs in front of a
   Direct employee, and the destructive-looking buttons are alarming. This hides
   those cards and cleans the version number off the title — without touching the
   fragile layered Settings render. Self-contained, reversible (display only). */
(function(){try{
  // headings whose whole CARD is developer/QA-only and should not face employees
  var HIDE=['Developer / test harness','Performance','Accessibility audit','Internationalization',
            'Print + PDF','reconcile with Ahmed','Workflow + go-live','Scenario sweep'];
  function tidySettings(){
    try{
      if(typeof current==='undefined'||current!=='settings')return;
      var view=document.getElementById('view'); if(!view)return;
      var heads=view.querySelectorAll('.card h3, .card h4'),i;
      for(i=0;i<heads.length;i++){ var h=heads[i]; var t=(h.textContent||'').trim();
        for(var k=0;k<HIDE.length;k++){ if(t.indexOf(HIDE[k])>=0){ var card=h.closest? h.closest('.card') : null; if(card){ card.style.display='none'; card.setAttribute('data-v28hidden','1'); } break; } }
      }
      // rename version-labelled cards that are kept (drop the "v24 -" / build wording)
      for(i=0;i<heads.length;i++){ var h2=heads[i]; var t2=(h2.textContent||'').trim();
        if(/^v\d+\s*-\s*Backup destination/i.test(t2)){ h2.textContent=(typeof LANG!=='undefined'&&LANG==='ar')?'وجهة النسخ الاحتياطي':'Backup destination'; }
      }
      // strip build version off the page title ("Settings · v21" -> "Settings"/"الإعدادات")
      var vt=document.getElementById('vTitle');
      if(vt){ var tx=vt.textContent||''; if(/·\s*v\d+/i.test(tx)) vt.textContent=tx.replace(/\s*·\s*v\d+.*$/i,'').trim(); }
    }catch(e){ if(window.console)console.warn('[v28] tidy',e); }
  }
  window.v28TidySettings=tidySettings;
  if(typeof render==='function'){ var _r28=render; window.render=function(){ var o=_r28.apply(this,arguments); tidySettings(); setTimeout(tidySettings,120); return o; }; }
  tidySettings();
}catch(e){ if(window.console)console.warn('[v28] init',e); }})();
