/* js/82 — the Generator's document preview always fits its column (2026-09-15, fire #52, driven live).
   The three "classic identity" editors (Price offer js/67, Service fees js/68, Company profile js/69)
   render the document as real A4 pages, 794px wide, inside a preview column that is only as wide as
   the screen leaves it: 866px at 1920, 806px at 1536, 710px at 1440, 550px at 1280 and ~360px on a
   phone. The pages wrapper is a centred flex column with overflow-x:auto — and a centred child that
   is wider than its flex container overflows BOTH sides equally, with the left part unreachable by
   any scrolling. Measured live at 1440px: the page ran from x=660 to 1454 in a column that ended at
   1412 — 42px cut off each edge, the "DRAFT — no number yet" ribbon clipped, and on a 1280px laptop
   122px lost on each side. At 1920 it happened to fit, which is why nobody saw it.
   Fix: each page is zoomed to fit the wrapper's width (zoom keeps layout in sync, so the wrapper's
   height follows), recomputed on render, resize and the phone preview toggle; in print the pages
   are back at 1:1 (the editors print with window.print() and their own @media print rules).
   `align-items: safe center` is the belt to that brace: a page that could still not fit would
   start at the left edge, reachable by scrolling, instead of being clipped on both sides. */
(function(){try{
  var st=document.createElement('style'); st.id='v82fitCss';
  st.textContent='#poPages,#sfPages,#cpPages{align-items:safe center}'+
    '@media print{#poPages .po-page,#sfPages .sf-page,#cpPages .cp-page{zoom:1!important}}';
  (document.head||document.documentElement).appendChild(st);
  var NATURAL=794;
  function fit(){
    try{
      if(typeof current!=='undefined'&&current!=='documents') return;
      ['poPages','sfPages','cpPages'].forEach(function(id){
        var wrap=document.getElementById(id); if(!wrap||!wrap.offsetParent) return;
        var w=wrap.clientWidth; if(!w) return;
        var z=Math.min(1,(w-2)/NATURAL);
        wrap.querySelectorAll('.po-page,.sf-page,.cp-page').forEach(function(pg){
          var want=(z>=0.999)?'':String(Math.round(z*1000)/1000);
          if(pg.style.zoom!==want) pg.style.zoom=want;
        });
      });
    }catch(_){}
  }
  window.__dgFitProbe=fit;
  function hook(){
    try{
      if(typeof window.render==='function'&&!window.render.__v82){
        var _r=window.render;
        var w=function(){ var o=_r.apply(this,arguments); try{ fit(); setTimeout(fit,150); setTimeout(fit,800); }catch(_){} return o; };
        w.__v82=1; window.render=w;
      }
      if(typeof window.dgTogglePreview==='function'&&!window.dgTogglePreview.__v82){
        var _t=window.dgTogglePreview;
        var wt=function(){ var o=_t.apply(this,arguments); try{ fit(); setTimeout(fit,150); }catch(_){} return o; };
        wt.__v82=1; window.dgTogglePreview=wt;
      }
    }catch(_){}
  }
  hook(); setInterval(function(){ hook(); fit(); },1500);
  window.addEventListener('resize',function(){ fit(); });
  window.addEventListener('beforeprint',function(){ try{ document.querySelectorAll('.po-page,.sf-page,.cp-page').forEach(function(pg){ pg.style.zoom=''; }); }catch(_){} });
  window.addEventListener('afterprint',function(){ setTimeout(fit,50); });
}catch(e){ console.warn('[js/82 generator-preview-fit]',e); }})();
