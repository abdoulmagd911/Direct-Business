/* v34 — Won→Client link: capture & surface the Direct client ID (the link key to Direct's hub).
   Strong prompt, NOT a hard block: a client without a Direct ID shows an amber "not linked"
   banner with a one-tap Add; a linked client shows the ID + a deep link into Direct Payments.
   The ID is entered at handover (v40 modal) or here; stored on b.directClientId (persists via raw). */
(function(){try{
  if(!window.renderLeadDetail) return;
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  /* One real company = several Direct Payments accounts (Prepaid/Postpaid/Tender).
     Edit them as one line: "101 Prepaid, 102 Postpaid, 103 Tender". */
  window.v34EditAccounts=function(id){try{
    var b=getLead(id); if(!b)return;
    var cur=(b.billingAccounts&&b.billingAccounts.length)?b.billingAccounts.map(function(a){return a.id+(a.mode?(' '+a.mode):'');}).join(', '):(b.directClientId||'');
    var v=prompt(fl('Billing accounts in Direct Payments — one per company registration, format: 101 Prepaid, 102 Postpaid, 103 Tender','حسابات الفوترة في مدفوعات دايركت — مثال: 101 Prepaid, 102 Postpaid'),cur);
    if(v===null)return;
    var MODES={prepaid:'Prepaid',postpaid:'Postpaid',tender:'Tender'};
    var list=String(v).split(',').map(function(s){return s.trim();}).filter(Boolean).map(function(s){
      var m=s.match(/^(\S+)\s*(\S*)$/)||[]; var mode=MODES[String(m[2]||'').toLowerCase()]||'';
      return {id:String(m[1]||s),mode:mode};
    });
    b.billingAccounts=list;
    if(list.length&&!b.directClientId)b.directClientId=list[0].id;
    if(typeof silentSave==='function')silentSave(save);else save();
    if(typeof render==='function')render();
  }catch(e){if(window.console)console.warn('v34EditAccounts',e);}};
  window.v34AddDirectId=function(id){try{var b=getLead(id);if(!b)return;var v=prompt(fl('Direct client ID (from Direct Payments):','معرّف العميل في نظام دايركت:'),b.directClientId||'');if(v===null)return;b.directClientId=String(v).trim();if(typeof silentSave==='function')silentSave(save);else save();if(typeof render==='function')render();}catch(e){}};
  var _rld=window.renderLeadDetail;
  window.renderLeadDetail=function(v,id){
    _rld.apply(this,arguments);
    setTimeout(function(){try{
      if(typeof current!=='undefined'&&current!=='leads')return;
      var b=(typeof getLead==='function')?getLead(id):null; if(!b||!b.isClient)return; // clients only
      var view=document.getElementById('view'); if(!view||view.querySelector('.v34-link'))return;
      var grid=view.querySelector('.detail-grid'); if(!grid||!grid.parentNode)return;
      // One real company can hold SEVERAL billing accounts in Direct Payments
      // (prepaid / postpaid / tender are separate 'companies' there because the
      // system cannot change an invoice type). b.billingAccounts = [{id,mode}].
      var accts=(b.billingAccounts&&b.billingAccounts.length)?b.billingAccounts:((b.directClientId&&String(b.directClientId).trim())?[{id:String(b.directClientId),mode:''}]:[]);
      var linked=accts.length>0;
      var MODE_AR={'Prepaid':'مسبق الدفع','Postpaid':'آجل الدفع','Tender':'مناقصة'};
      var acctHtml=accts.map(function(a2){return '<span class="tag" style="background:#E7F8EF;color:#0F6E56;font-weight:700">#'+esc(String(a2.id))+(a2.mode?(' · '+esc(fl(a2.mode,MODE_AR[a2.mode]||a2.mode))):'')+'</span>';}).join(' ');
      var el=document.createElement('div'); el.className='v34-link card';
      el.style.cssText='padding:11px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-inline-start:3px solid '+(linked?'#16B364':'#F79009');
      if(linked){
        el.innerHTML='<span style="font-size:15px">🔗</span><span style="font-weight:700;color:#0F6E56">'+fl('Linked to Direct','مرتبط بدايركت')+'</span>'+
          '<span style="color:var(--muted);font-size:12.5px">'+fl(accts.length>1?'billing accounts':'client','حسابات الفوترة')+'</span> '+acctHtml+'<span style="flex:1"></span>'+
          '<a class="chiplink" href="'+((b.directClientId&&typeof pdClientLink==='function')?pdClientLink(b.directClientId):(typeof pdLink==='function'?pdLink(b):'#'))+'" target="_blank" rel="noopener">'+fl('Open in Direct Payments ↗','افتح في مدفوعات دايركت ↗')+'</a>'+
          ' <button class="btn ghost sm" onclick="v34EditAccounts(\''+id+'\')">'+fl('Billing accounts','حسابات الفوترة')+'</button>'+
          ' <button class="btn ghost sm" onclick="v34AddDirectId(\''+id+'\')">'+fl('Edit','تعديل')+'</button>';
      } else {
        el.innerHTML='<span style="font-size:15px">⚠️</span><span style="font-weight:700;color:#B54708">'+fl('Not linked to Direct yet','غير مرتبط بدايركت بعد')+'</span>'+
          '<span style="color:var(--muted);font-size:12.5px">'+fl('Add the Direct client ID so finance & invoices connect.','أضف معرّف العميل في دايركت لربط الفواتير والمالية.')+'</span><span style="flex:1"></span>'+
          '<button class="btn pri sm" onclick="v34AddDirectId(\''+id+'\')">'+fl('+ Add Direct ID','+ أضف معرّف دايركت')+'</button>';
      }
      grid.parentNode.insertBefore(el,grid);
    }catch(e){if(window.console)console.warn('[v34] link',e);}},60);
  };
  console.info('%c[v34] client Direct-link banner loaded','color:#16B364;font-weight:700');
}catch(e){if(window.console)console.warn('[v34] init',e);}})();
