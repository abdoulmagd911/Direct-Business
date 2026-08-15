/* ===== Brand & Proposal Studio — one chapter, one file (Step 1 pilot, 2026-08-15) =====

   This file is the whole "identity dressing" chapter of the app:
     part 1 (was js/46-v70)  the Brand link in the sidebar
     part 2 (was js/47-v71)  the bridge that opens an offer in the branded Proposal Studio
     part 3 (was js/48-v72)  the login-card logo and the identity strip on the offers list

   The three parts used to be three separate layer files — and, for a while, ALSO three
   inline copies pasted into index.html by another session, which is how the offers page
   grew two identity banners. One file, loaded once, is the cure for that class of bug.
   Each part keeps its own try/catch wrapper, exactly as before: a failure in one part
   cannot take down the others.                                                          */

/* ---------- part 1 — the Brand link in the sidebar (was js/46-v70) ---------- */
/* ===== v70: Brand Hub link in the nav =====
   Opens /brand/ (the internal brand hub: logos, colours, fonts) in a new tab.
   NOTE: renamed from v46 → v70 (and again from v67, which the parallel session took) because the app already has a real v46 layer.
   New-file pattern per CLAUDE.md; nothing in the core is touched. */
(function(){try{
  var IC_BRAND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4 10 9a5 5 0 0 1-5 5h-2a2 2 0 0 0-1 3.75"/></svg>';
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function inject(){
    var nav=document.getElementById('nav'); if(!nav||!nav.querySelector('button')) return;
    var label=isAr()?'الهوية':'Brand';
    var mine=document.getElementById('v70BrandBtn');
    /* An earlier layer (v46BrandBtn) already puts a Brand entry in the sidebar. Adding a second
       one produced two identical rows — glaring in Arabic, where both read "الهوية". If anyone
       else already provides it, stand down completely and remove ours. (fix 2026-08-13) */
    var others=[].slice.call(nav.querySelectorAll('button')).filter(function(x){
      return x!==mine && /^(Brand|الهوية)$/.test((x.textContent||'').trim());
    });
    if(others.length){ if(mine&&mine.parentNode) mine.parentNode.removeChild(mine); return; }
    if(mine){ var sp=mine.querySelector('span'); if(sp&&sp.textContent!==label) sp.textContent=label; return; }
    var b=document.createElement('button');
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

/* ---------- part 2 — offer → branded Proposal Studio bridge (was js/47-v71) ---------- */
/* ===== v71: Offer Builder → branded Proposal Studio bridge =====
   Closes the document gap in the cycle lead → offer → booking → invoice.
   The Offer Builder keeps owning the DATA; the Studio owns the branded
   DOCUMENT. Handoff via localStorage (same origin) — no offer data in URLs.
   Also labels the built-in plain HTML export so nobody mistakes it for the
   client-facing document. Renamed from v47 → v71 (v47 is taken). */
(function(){try{
  function n(x){ var v=parseFloat(String(x==null?'':x).replace(/[^\d.\-]/g,'')); return isFinite(v)?v:0; }
  function daysBetween(a,b){
    try{ var ms=new Date(b+'T00:00:00')-new Date(a+'T00:00:00'); var d=Math.round(ms/86400000); return (isFinite(d)&&d>0)?d:14; }catch(_){ return 14; }
  }
  window.v71StudioHandoff=function(offerId){
    try{
      var o=(DB.offers||[]).find(function(x){return x.id===offerId;}); if(!o) return;
      var lines=[];
      var paxTotal=(Number(o.paxAdt)||0)+(Number(o.paxChd)||0)+(Number(o.paxInf)||0)||1;
      var svcName=[o.airline,o.route].filter(Boolean).join(' · ')||o.subject||'Air ticket';
      if(n(o.ticketPrice)) lines.push({svc:'Air ticket — '+svcName, svcAr:'تذكرة طيران — '+svcName, unit:'Per ticket', qty:paxTotal, orig:'', price:n(o.ticketPrice)});
      if(n(o.partnerFees)) lines.push({svc:'Partner fees', svcAr:'رسوم الشريك', unit:'Per ticket', qty:paxTotal, orig:'', price:n(o.partnerFees)});
      if(n(o.serviceFees)) lines.push({svc:'Direct service fee', svcAr:'قيمة خدمة دايركت', unit:'Per ticket', qty:paxTotal, orig:'', price:n(o.serviceFees)});
      if(!lines.length) lines.push({svc:o.subject||'', svcAr:'', unit:'', qty:1, orig:'', price:n(o.total)});
      var payload={
        no:o.ref||'', client:o.client||'', attn:o.subject||'',
        date:o.date||'', valid:o.validUntil?daysBetween(o.date,o.validUntil):14,
        by:o.owner||'', lines:lines,
        remarks:o.remarks||'', addFees:o.addFees||''
      };
      localStorage.setItem('direct_studio_handoff', JSON.stringify(payload));
      logAudit&&logAudit('offer',o.id,'studio-open',o.ref||'');
      window.open('/brand/proposal.html?from=app','_blank');
    }catch(e){ if(window.console)console.warn('[v71] handoff',e); }
  };
  /* The built-in Download/Print produce a plain unbranded HTML quote — useful as an
     internal copy, but it must never be mistaken for the client-facing document.
     Label them once, from this layer, so the core file stays untouched. */
  function labelPlainExports(ar){
    try{
      var btns=document.querySelectorAll('.offer-wrap button, .offer-form button, button');
      for(var i=0;i<btns.length;i++){
        var b=btns[i], oc=(b.getAttribute('onclick')||'');
        if(b.getAttribute('data-v71lbl')) continue;
        if(oc.indexOf('o_download()')>=0){
          b.setAttribute('data-v71lbl','1');
          b.textContent=ar?'⇩ نسخة داخلية (بدون هوية)':'⇩ Plain copy (internal)';
          b.title=ar?'ملف بسيط بدون الهوية — للاستخدام الداخلي':'Unbranded file for internal use';
        } else if(oc.indexOf('o_print()')>=0){
          b.setAttribute('data-v71lbl','1');
          b.textContent=ar?'⎙ طباعة بسيطة (داخلية)':'⎙ Plain print (internal)';
          b.title=ar?'طباعة بدون الهوية — للاستخدام الداخلي':'Unbranded print for internal use';
        }
      }
    }catch(_){}
  }
  function inject(){
    try{
      var cur=null; try{ cur=current; }catch(_){}
      if(cur!=='offers'){ return; }
      var id=null; try{ id=openOffer; }catch(_){}
      if(!id){ return; }
      if(document.getElementById('v71StudioBtn')) return;
      var wrap=document.querySelector('.offer-wrap'); if(!wrap||!wrap.parentNode) return;
      var isAr=false; try{ isAr=(typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){}
      var bar=document.createElement('div');
      bar.id='v71StudioBtn';
      bar.style.cssText='margin:8px 0 10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
      var b=document.createElement('button');
      b.className='btn sm';
      b.style.cssText='background:#F47A1F;color:#fff;border:0;font-weight:800';
      b.textContent=isAr?'⤓ عرض بالهوية (PDF)':'⤓ Branded offer (PDF)';
      b.onclick=function(){ window.v71StudioHandoff(id); };
      var hint=document.createElement('span');
      hint.style.cssText='font-size:11.5px;color:var(--muted)';
      hint.textContent=isAr?'يفتح الاستوديو ببيانات هذا العرض — الغلاف والجدول والشروط جاهزة':'Opens the Studio pre-filled from this offer — cover, table & terms ready';
      bar.appendChild(b); bar.appendChild(hint);
      wrap.parentNode.insertBefore(bar,wrap);
      labelPlainExports(isAr);
    }catch(e){}
  }
  inject();
  var _r=window.render;
  if(typeof _r==='function'){
    window.render=function(){ var out=_r.apply(this,arguments); try{ inject(); }catch(_){ } return out; };
  }
  setInterval(function(){ try{ inject(); }catch(_){ } },1500);
  console.info('%c[v71] offer→studio bridge loaded','color:#F47A1F;font-weight:700');
}catch(e){if(window.console)console.warn('[v71] init',e);}})();

/* ---------- part 3 — login logo + offers identity strip (was js/48-v72) ---------- */
/* ===== v72: identity in the app shell =====
   Login-card logo + a brand strip on the offers list that mounts the Studio.
   Renamed from v48 → v72 (the app already has a real v48 layer). */
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
    var existing=document.getElementById('v72OffersStrip');
    if(cur!=='offers' || open){ if(existing) existing.remove(); return; }
    if(existing) return;
    var view=document.getElementById('view')||document.querySelector('main'); if(!view) return;
    var table=view.querySelector('table'); if(!table) return;
    var ar=isAr();
    var strip=document.createElement('div');
    strip.id='v72OffersStrip';
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
  console.info('%c[v72] app identity layer loaded','color:#F47A1F;font-weight:700');
}catch(e){if(window.console)console.warn('[v72] init',e);}})();
