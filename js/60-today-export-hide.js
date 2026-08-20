/* ===== Hide the top-bar Export menu on Today (chapter, 2026-08-20) =====

   Found by the QA-admin audit: on Today, all four Export options ("CSV - summary", "CSV -
   full details", "Excel - summary", "Excel - full details") silently downloaded the same
   full-database JSON backup instead of a CSV/Excel file — the same failure Finance had
   before its fix, because exportCurrent()'s per-page column map (core-05-records.js) has no
   entry for 'today' and falls through to exportData(). Owner's call: there is genuinely
   nothing tabular on Today to export, so the fix is to hide the button on that one page
   rather than invent a CSV for it — every other page keeps the menu untouched.

   The Export menu (.exp-wrap) lives in the persistent top bar in index.html, outside #view,
   so it isn't rebuilt by a normal page render — it has to be toggled explicitly on every
   render() call, the same way js/56's access panel has to inject itself explicitly. */
(function(){try{
  function apply(){
    try{
      var wrap=document.querySelector('.exp-wrap');
      if(!wrap)return;
      wrap.style.display=(typeof current!=='undefined'&&current==='today')?'none':'';
    }catch(_){}
  }
  var _r=window.render;
  if(typeof _r==='function'){
    window.render=function(){ var out=_r.apply(this,arguments); try{ setTimeout(apply,0); }catch(_){} return out; };
  }
  document.addEventListener('DOMContentLoaded', apply);
  setTimeout(apply,0);
  console.info('%c[60] Today export-menu hide loaded','color:#8b5b1f;font-weight:700');
}catch(e){if(window.console)console.warn('[60-today-export-hide] init',e);}})();
