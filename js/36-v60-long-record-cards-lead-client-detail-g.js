/* v60 — long record cards (lead/client detail) get a "jump to section" chip bar under the
   header: one tap scrolls to Finance / Key facts / Contacts / Work log / … Display-only,
   built from whatever cards the page actually shows; nothing is moved or hidden. */
(function(){try{
  function inject(){
    try{
      var view=document.getElementById('view'); if(!view) return;
      var head=view.querySelector('.detail-head');
      var old=document.getElementById('v60jump');
      if(!head){ if(old)old.remove(); return; }
      if(old) return;
      var items=[];
      view.querySelectorAll('.card h3').forEach(function(h3){
        var card=h3.closest('.card'); if(!card) return;
        var t=''; h3.childNodes.forEach(function(n){ if(n.nodeType===3) t+=n.textContent; });
        t=(t||h3.textContent||'').trim();
        t=t.replace(/\s*(Edit|تعديل)\s*$/,'').trim();
        if(t&&t.length<=38) items.push({card:card,t:t});
      });
      if(items.length<4) return; // short pages stay as they are
      var bar=document.createElement('div'); bar.id='v60jump';
      bar.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px';
      items.slice(0,10).forEach(function(c){
        var b=document.createElement('button'); b.className='btn sm ghost'; b.textContent=c.t;
        b.onclick=function(){ try{ c.card.scrollIntoView({behavior:'smooth',block:'start'}); }catch(_){ c.card.scrollIntoView(); } };
        bar.appendChild(b);
      });
      head.insertAdjacentElement('afterend',bar);
    }catch(_){}
  }
  var _r=window.render;
  if(typeof _r==='function'){ window.render=function(){ var o=_r.apply(this,arguments); try{ setTimeout(inject,80); }catch(_){ } return o; }; }
  setTimeout(inject,900);
  console.info('%c[v60] record-card section jump bar loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v60] init',e);}})();
