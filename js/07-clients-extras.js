/* ===== Clients-page extras: dashboard + location — one chapter, one file (Step 1, ch. 7) =====

   Two neighbouring decorations:
     part 1 (was js/07)  the aggregate dashboard strip on the main Clients page
     part 2 (was js/08)  the location line on a company card — Google-Maps pin, HQ line

   Old slots were ADJACENT (07, 08): nothing loads between them, so folding them into
   slot 07 changes no order at all. Verbatim, each part keeping its own try/catch.       */

/* ---------- part 1 — clients aggregate dashboard (was js/07) ---------- */
/* Clients aggregate dashboard on the main Clients page (mirrors the Leads dashboard) */
(function(){try{
  function money(n){try{return (typeof moneyShort==='function')?moneyShort(n):(n||0).toLocaleString();}catch(_){return n;}}
  function clientsDash(){try{
    if(typeof current==='undefined'||current!=='clients')return;
    if(typeof openLead!=='undefined'&&openLead)return;
    if(document.getElementById('cl_dash'))return;
    if(typeof DB==='undefined'||!DB.businesses)return;
    var cls=DB.businesses.filter(function(b){return b.isClient;});
    if(!cls.length)return;
    var key=cls.filter(function(b){return b.tier==='Key';}).length;
    var today=new Date().toISOString().slice(0,10);
    var overdue=cls.filter(function(b){return b.nextReview&&b.nextReview<=today;}).length;
    var byArea={}; cls.forEach(function(b){var a=b.area||'—';byArea[a]=(byArea[a]||0)+1;});
    var areas=Object.keys(byArea).sort(function(a,b){return byArea[b]-byArea[a];}).slice(0,6);
    // No money here — the Clients page is identity only (owner ruling 2026-08-21); the
    // billed/received/outstanding figures live on the Finance page, per company.
    var chips='<div class="chip"><div class="v">'+cls.length+'</div><div class="l">Total clients</div></div>'+
      '<div class="chip"><div class="v">'+key+'</div><div class="l">Key accounts</div></div>'+
      '<div class="chip"><div class="v" style="color:'+(overdue?'#D92D20':'inherit')+'">'+overdue+'</div><div class="l">Reviews overdue</div></div>';
    var areaBars=areas.map(function(a){return '<span class="tag" style="background:#EEF0F5;color:#5b6178;margin:0 6px 6px 0">'+a+': <b>'+byArea[a]+'</b></span>';}).join('');
    var d=document.createElement('div'); d.id='cl_dash'; d.style.cssText='margin:0 0 16px';
    d.innerHTML='<div class="chips" style="margin-bottom:10px">'+chips+'</div>'+(areaBars?'<div style="display:flex;flex-wrap:wrap;align-items:center">'+areaBars+'</div>':'');
    var host=document.querySelector('.toolbar')||document.querySelector('table');
    if(host&&host.parentNode){host.parentNode.insertBefore(d,host);}
  }catch(_){}}
  function run(){clientsDash();}
  var iv=setInterval(function(){if(typeof render==='function'){clearInterval(iv);try{var _r=render;render=function(){var o=_r.apply(this,arguments);try{run();}catch(_){}setTimeout(run,40);return o;};}catch(_){}run();}},200);
  setTimeout(run,1500);setTimeout(run,3000);
}catch(e){console.warn('cldash',e);}})();

/* ---------- part 2 — location pin + HQ line (was js/08) ---------- */
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
