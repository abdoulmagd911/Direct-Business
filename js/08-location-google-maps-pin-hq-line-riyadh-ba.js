/* Location: Google Maps pin + HQ line + Riyadh badge on lead/client detail (additive, idempotent) */
(function(){
  function city(b){ var hq=(b.branchHQ||'').toString().trim(); if(hq && !/^(hq|head\s*office|main|n\/a)$/i.test(hq)) return hq; return (b.addressEn||b.addressAr||hq||'').toString().trim(); }
  function mapsUrl(b){ var q=[b.name||b.nameAr||'',city(b),'Saudi Arabia'].filter(Boolean).join(' '); return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q); }
  function isRiyadh(b){ return /riyadh|الرياض/i.test(''+(b.branchHQ||'')+(b.addressEn||'')+(b.addressAr||'')); }
  function curEnt(){ try{ var m=location.pathname.match(/\/(lead|client)\/([^\/?#]+)/); if(m&&window.getLead) return getLead(m[2]); }catch(e){} return null; }
  function inject(){ try{
    var v=document.getElementById('view'); if(!v) return;
    var head=v.querySelector('.detail-head'); if(!head) return;
    if(head.querySelector('.mapsLine')) return;
    var b=curEnt(); if(!b) return;
    var c=city(b), riy=isRiyadh(b);
    var line=document.createElement('div'); line.className='mapsLine';
    line.style.cssText='display:flex;align-items:center;gap:8px;margin:6px 0;flex-wrap:wrap;font-size:13px';
    line.innerHTML='<span style="color:#475467">HQ: '+(c?c.slice(0,60).replace(/[<>&]/g,''):'not set')+'</span>'+(riy?'<span style="background:#16B364;color:#fff;border-radius:10px;padding:1px 8px;font-weight:700;font-size:11px">Riyadh</span>':'')+'<a href="'+mapsUrl(b)+'" target="_blank" rel="noopener" class="btn ghost sm" style="text-decoration:none">Map ↗</a>';
    head.appendChild(line);
  }catch(e){} }
  if(window.render && !window.render.__mapsWrap){ var _r=window.render; window.render=function(){var o=_r.apply(this,arguments); setTimeout(inject,0); return o;}; window.render.__mapsWrap=true; }
  setTimeout(inject,400);
  window.addEventListener('popstate',function(){setTimeout(inject,200);});
})();
