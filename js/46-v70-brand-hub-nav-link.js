/* ===== v70: Brand Hub link in the nav =====
   Opens /brand/ (the internal brand hub: logos, colours, fonts) in a new tab.
   NOTE: renamed from v46 → v70 (and again from v67, which the parallel session took) because the app already has a real v46 layer.
   New-file pattern per CLAUDE.md; nothing in the core is touched. */
(function(){try{
  var IC_BRAND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4 10 9a5 5 0 0 1-5 5h-2a2 2 0 0 0-1 3.75"/></svg>';
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function inject(){
    var nav=document.getElementById('nav'); if(!nav||!nav.querySelector('button')) return;
    var b=document.getElementById('v70BrandBtn');
    var label=isAr()?'الهوية':'Brand';
    if(b){ var s=b.querySelector('span'); if(s&&s.textContent!==label) s.textContent=label; return; }
    b=document.createElement('button');
    b.id='v70BrandBtn';
    b.innerHTML=IC_BRAND+'<span>'+label+'</span>';
    b.onclick=function(){ try{ window.open('/brand/','_blank'); }catch(_){} };
    nav.appendChild(b);
  }
  inject();
  var _r=window.render;
  if(typeof _r==='function'){
    window.render=function(){ var out=_r.apply(this,arguments); try{ inject(); }catch(_){ } return out; };
  }
  setInterval(function(){ try{ inject(); }catch(_){ } },2500);
  console.info('%c[v70] brand hub nav link loaded','color:#F47A1F;font-weight:700');
}catch(e){if(window.console)console.warn('[v70] init',e);}})();
