/* ===== v69: identity in the app shell =====
   Login-card logo + a brand strip on the offers list that mounts the Studio.
   Renamed from v48 → v69 (the app already has a real v48 layer). */
(function(){try{
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function setLoginLogo(){
    var img=document.getElementById('cl_logo');
    if(img && !img.getAttribute('src')){
      img.src='/brand/direct_logo_color.png';
      img.style.display='block';
    }
  }
  function injectOffersStrip(){
    var cur=null, open=null;
    try{ cur=current; }catch(_){}
    try{ open=openOffer; }catch(_){}
    var existing=document.getElementById('v69OffersStrip');
    if(cur!=='offers' || open){ if(existing) existing.remove(); return; }
    if(existing) return;
    var view=document.getElementById('view')||document.querySelector('main'); if(!view) return;
    var table=view.querySelector('table'); if(!table) return;
    var ar=isAr();
    var strip=document.createElement('div');
    strip.id='v69OffersStrip';
    strip.style.cssText='display:flex;align-items:center;gap:14px;flex-wrap:wrap;'+
      'background:#FFF3EC;border:1px solid #F8CBAA;border-radius:12px;padding:10px 14px;margin:0 0 12px';
    var img=document.createElement('img');
    img.src='/brand/direct_logo_color.png'; img.alt='Direct'; img.style.cssText='height:26px';
    var txt=document.createElement('span');
    txt.style.cssText='font-size:12.5px;color:#6B7480;flex:1;min-width:200px';
    txt.textContent=ar
      ? 'العروض المرسلة للعملاء تصدر بالهوية الرسمية — افتح الاستوديو أو استخدم زر "عرض بالهوية" داخل أي عرض'
      : 'Client-facing offers go out in the official identity — open the Studio, or use the "Branded offer" button inside any offer';
    var btn=document.createElement('button');
    btn.style.cssText='background:#F06820;color:#fff;border:0;border-radius:9px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer';
    btn.textContent=ar?'فتح استوديو العروض':'Open Proposal Studio';
    btn.onclick=function(){ try{ window.open('/brand/proposal.html','_blank'); }catch(_){} };
    strip.appendChild(img); strip.appendChild(txt); strip.appendChild(btn);
    var anchor=table.closest('.card')||table;
    anchor.parentNode.insertBefore(strip, anchor);
  }
  function tick(){ try{ setLoginLogo(); injectOffersStrip(); }catch(_){} }
  tick();
  var _r=window.render;
  if(typeof _r==='function'){
    window.render=function(){ var out=_r.apply(this,arguments); try{ tick(); }catch(_){ } return out; };
  }
  setInterval(tick,1500);
  console.info('%c[v69] app identity layer loaded','color:#F47A1F;font-weight:700');
}catch(e){if(window.console)console.warn('[v69] init',e);}})();
