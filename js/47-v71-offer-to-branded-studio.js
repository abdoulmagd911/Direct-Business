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
