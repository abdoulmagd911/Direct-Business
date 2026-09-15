/* js/80 — the big avatar on every detail card: initials centred, and never an empty box
   (2026-09-15, fire #51, driven live).
   1. Seen by eye on real cards (a client card, then an airline dashboard) and then measured: the
      62px avatar box in `.detail-head` had display:block, so the two initials sat in its top-left
      corner instead of the middle — on every lead, client, airline and provider card, EN and AR.
      The base stylesheet's centring rule is `.lead .ava{display:flex;align-items:center;
      justify-content:center;…}` — scoped to the list rows — and the detail-head rule only sets
      size, radius and font. One rule below, injected after every stylesheet so it wins.
   2. Found by the guard probe for (1): core-10 drops a company-logo <img> into that box for any
      business with a website, first clearing the initials; when the logo cannot be fetched (no
      logo for that domain, no network, an ad-blocker) the <img> removes itself — and the box is
      left EMPTY: no logo, no initials, a blank coloured square. The initials and colour are put
      back the moment the logo fails.
   Rollback = delete this file and its script line. */
(function(){try{
  var st=document.createElement('style'); st.id='v80avaCss';
  st.textContent='.detail-head .ava{display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;line-height:1;overflow:hidden}';
  (document.head||document.documentElement).appendChild(st);

  function restore(ava){
    try{
      if(!ava||ava.querySelector('img')||(ava.textContent||'').trim()) return;
      var b=(typeof getLead==='function'&&typeof openLead!=='undefined'&&openLead)?getLead(openLead):null;
      if(!b) return;
      ava.textContent=(typeof initials==='function')?initials(b.name||'?'):String(b.name||'?').slice(0,2).toUpperCase();
      if(typeof avaColor==='function') ava.style.background=avaColor(b.id);
    }catch(_){}
  }
  function arm(){
    try{
      var ava=document.querySelector('#view .detail-head .ava'); if(!ava) return;
      var im=ava.querySelector('img');
      if(im&&!im.__v80){ im.__v80=1;
        im.addEventListener('error',function(){ try{ im.remove(); }catch(_){} restore(ava); });
        /* already failed before we got here (cached error, or blocked synchronously) */
        if(im.complete&&im.naturalWidth===0){ try{ im.remove(); }catch(_){} restore(ava); }
      } else restore(ava);
    }catch(_){}
  }
  if(typeof window.render==='function'&&!window.render.__v80){
    var _r=window.render;
    var w=function(){ var o=_r.apply(this,arguments); try{ arm(); setTimeout(arm,300); setTimeout(arm,2500); }catch(_){} return o; };
    w.__v80=1; window.render=w;
  }
}catch(e){ console.warn('[js/80 detail-avatar-centre]',e); }})();
