/* ===== Hide the fake "failed syncs / integrations" alert on Today (chapter, 2026-08-20) =====

   Found by the QA-admin audit: Today shows a red/orange alert strip — "🔴 N failed syncs",
   "🔌 N integrations need attention", sync conflicts, stale records — that reads exactly like
   a real operational problem. It isn't one. Every number behind it comes from `DB.syncEvents`
   / `DB.integrations`, and the only code that ever writes to those is `migrateV20`'s one-time
   seed (hardcoded so Kiwi always shows "down" and ZATCA always shows "token expired", plus a
   handful of randomly-generated mock events) and a few "simulate this action" demo helpers
   (v20TestConnection, v20ForceSync, the rehearsal-flow pushes). No real integration exists
   behind any of it yet. Left as-is, it would show the same two "failures" forever, on every
   visit, regardless of anything actually happening — pure noise dressed as an alarm.

   Owner's call (2026-08-20): hide it rather than label it "demo," since it isn't actionable
   either way and a labeled-but-still-red alert would keep drawing attention it doesn't
   deserve. This only hides the homepage strip (core-06-v18-v21.js's injected
   `.v20-alert-strip`) — the per-record sync log / conflict-resolution tools on an individual
   invoice or booking are untouched; those stay available if that mock system becomes real.

   A MutationObserver, not a fixed setTimeout delay, because the strip is itself inserted by
   another script's own setTimeout after render() returns — guessing a "safe" delay to run
   after that one would be fragile the next time either script's timing changes. */
(function(){try{
  function hide(node){ try{ node.style.display='none'; }catch(_){} }
  document.querySelectorAll('.v20-alert-strip').forEach(hide);
  var mo=new MutationObserver(function(muts){
    for(var i=0;i<muts.length;i++){
      var added=muts[i].addedNodes;
      for(var j=0;j<added.length;j++){
        var n=added[j];
        if(!(n&&n.nodeType===1))continue;
        if(n.classList&&n.classList.contains('v20-alert-strip')){ hide(n); continue; }
        if(n.querySelectorAll){ n.querySelectorAll('.v20-alert-strip').forEach(hide); }
      }
    }
  });
  mo.observe(document.body,{childList:true,subtree:true});
  console.info('%c[61] fake sync-alert strip suppressed on Today','color:#8b5b1f;font-weight:700');
}catch(e){if(window.console)console.warn('[61-hide-fake-sync-alert] init',e);}})();
