/* ===== Individual bookings — the fifth revenue pattern, entered by hand (chapter, S3 part 2 — 2026-08-20) =====

   Why this exists. Four of the five real ways money reaches Direct (invoice, transaction,
   commission, promo_code) come straight off a Direct Payments export — the importer reads
   them, nobody types a figure. The fifth, b2c_manual, cannot: an individual/personal booking
   Direct made as a team has no corporate-client export to import from. The owner's decision
   (2026-08-20): don't wait on an importer for this — a lightweight form is the right size,
   and he (or Claude on his instruction) will type these in as he collects them.

   WHAT THIS ROW IS. A real `finance_invoices` row, same table, same trigger
   (`finance_derive_fields`) that already derives every other row's revenue/profit/month/
   quarter — nothing here recomputes that logic a second time. `revenue_way='b2c_manual'` and
   `record_type='b2c'` are the only things that mark it as this pattern; every Overview,
   Ledger, Clients and Report Builder number picks it up automatically, exactly like an
   imported invoice would.

   NOT the same door as "New invoice" (owner-closed 2026-08-08). That card duplicated real
   corporate Direct Payments data and was folded away for it. This one is scoped tight to the
   one pattern that has no importer to duplicate — record_type is fixed to 'b2c', not a free
   choice, so this can never become a side door for entering a corporate invoice by hand.    */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function m0(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
  var B2C={rows:null,loading:false};
  window.B2C=B2C;

  function canFinEditSafe(){ try{return window.canFinEdit?canFinEdit():false;}catch(_){return false;} }
  function client(){ try{return window.fc?fc():null;}catch(_){return null;} }
  function services(){
    try{ if(window.SVC_CATALOG&&SVC_CATALOG.length) return SVC_CATALOG.map(function(s){return s[0];}).filter(function(v,i,a){return a.indexOf(v)===i;}); }catch(_){}
    return ['Flights','Hotels','Visas','Umrah','Transfers','Insurance','Activities / tours','MICE / events','eSIM','Other'];
  }
  function svcLbl(k){try{ return window.svcLabel?svcLabel(k):k; }catch(_){ return k; }}

  /* Same in-page confirm as the Payment proofs chapter — a native confirm() blocks any
     scripted driver of the page, which the owner's own hands-on QA hit on a different tab. */
  function b2cConfirm(msg,onYes){
    try{
      if(window.pfConfirm) return pfConfirm(msg,onYes);
      var old=document.getElementById('pfConfirmBox'); if(old)old.remove();
      var ar=(typeof LANG!=='undefined'&&LANG==='ar');
      var d=document.createElement('div'); d.id='pfConfirmBox';
      d.style.cssText='position:fixed;inset:0;z-index:1000000000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center'; // kept in step with js/57's real pfConfirm — see its comment
      d.innerHTML='<div style="background:var(--card,#fff);border-radius:12px;padding:20px 22px;max-width:360px;box-shadow:0 12px 40px rgba(0,0,0,.25)">'+
        '<div style="font-size:13.5px;margin-bottom:16px;line-height:1.5">'+esc(msg)+'</div>'+
        '<div style="display:flex;gap:8px;justify-content:'+(ar?'flex-start':'flex-end')+'">'+
        '<button class="btn sm ghost" id="pfConfirmNo">'+fl('Cancel','إلغاء')+'</button>'+
        '<button class="btn sm pri" id="pfConfirmYes">'+fl('Confirm','تأكيد')+'</button>'+
        '</div></div>';
      document.body.appendChild(d);
      var close=function(){ try{d.remove();}catch(_){} };
      document.getElementById('pfConfirmNo').onclick=close;
      d.addEventListener('click',function(e){ if(e.target===d)close(); });
      document.getElementById('pfConfirmYes').onclick=function(){ close(); onYes(); };
    }catch(e){ onYes(); }
  }

  function load(cb){
    if(B2C.loading)return; B2C.loading=true;
    var c=client(); if(!c){B2C.loading=false;return;}
    c.from('finance_invoices').select('*').eq('revenue_way','b2c_manual').is('deleted_at',null)
      .order('invoice_date',{ascending:false}).then(function(r){
        B2C.loading=false;
        B2C.rows=(r&&!r.error&&r.data)?r.data:[];
        if(cb)cb(); else try{if(current==='finance'&&FIN.tab==='b2c')render();}catch(_){}
      });
  }

  window.b2cSave=function(){try{
    var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
    var date=g('bc_date');
    /* parseMoneyInput (js/core/core-01-foundation.js) — the naive digit-strip this used to do
       returned wrong-by-1000x for European-formatted input ("1.500,50" -> 1.5005), silently,
       past the amt>0 guard below. cost had NO guard at all, so a mis-parsed cost landed
       straight in cost_sar and flowed into the Profit card with no rejection whatsoever. */
    var amt=parseMoneyInput(g('bc_amt'));
    var cost=parseMoneyInput(g('bc_cost'));
    var status=g('bc_status')||'verified_paid';
    var name=g('bc_name').trim();
    if(!date){alert(fl('A date is needed.','التاريخ مطلوب.'));return;}
    if(!name){alert(fl('The individual’s name is needed.','اسم الفرد مطلوب.'));return;}
    if(!(amt>0)){alert(fl('Amount must be more than zero.','المبلغ يجب أن يكون أكبر من صفر.'));return;}
    /* cost is allowed to be 0 (a genuinely free/no-cost booking) — only a value that failed
       to parse at all is rejected here, so this doesn't newly block anything that already
       worked, only closes the silent-wrong-number gap. */
    if(g('bc_cost').trim()&&isNaN(cost)){alert(fl('That cost doesn’t look like a valid amount.','هذه التكلفة ليست مبلغًا صالحًا.'));return;}
    if(isNaN(cost))cost=0;
    /* Overview's "Invoices" tile counts DISTINCT invoice_no among verified rows — a blank
       reference here would either vanish from that count or collapse together with any other
       reference-less row (multiple nulls count as one). Every booking needs its own identity
       the same way an imported invoice always has a real number, so one is generated when the
       field is left blank rather than ever writing a null. */
    var ref=g('bc_ref').trim() || ('B2C-'+date.replace(/-/g,'')+'-'+Math.random().toString(16).slice(2,6));
    var row={
      revenue_way:'b2c_manual', record_type:'b2c',
      client_group:name, customer_raw_name:name,
      invoice_date:date, /* year is a generated column, derived from invoice_date — never set it explicitly */
      service_type:g('bc_svc')||null, products:g('bc_svc')||null,
      invoice_no:ref,
      total_incl_vat_sar:amt, wallet_portion_sar:0, cost_sar:cost,
      amount_received_sar: status==='verified_paid'?amt:0,
      amount_remaining_sar: status==='verified_paid'?0:amt,
      integrity_status:status,
      notes:g('bc_notes').trim()||null
    };
    var c=client(); if(!c)return;
    c.from('finance_invoices').insert(row).select().then(function(r){
      if(r.error){alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message);return;}
      if(!r.data||!r.data.length){alert(fl('The booking was not saved — your account was not allowed to write it.','لم يُحفظ الحجز — لا تملك صلاحية الكتابة.'));return;}
      try{ if(window.__note)__note('finance',r.data[0].id,'individual booking added',name+' · '+m0(amt)+' SAR'); }catch(_){}
      if(typeof toast==='function')toast(fl('Individual booking saved','تم حفظ الحجز الفردي'));
      ['bc_name','bc_ref','bc_amt','bc_cost','bc_notes'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
      B2C.rows=null; try{ if(window.FIN)FIN.rows=null; }catch(_){}
      load(); try{ if(typeof finLoad==='function')finLoad(); }catch(_){}
    });
  }catch(e){console.warn('[b2c] save',e);}};

  window.b2cDel=function(id){try{
    b2cConfirm(fl('Remove this individual booking? It stays in the history and disappears from every Finance total.','حذف هذا الحجز الفردي؟ يبقى في السجل ويختفي من كل إجماليات المالية.'), function(){
      var c=client(); if(!c)return;
      c.from('finance_invoices').update({deleted_at:new Date().toISOString()}).eq('id',id).select().then(function(r){
        if(r.error){alert(r.error.message);return;}
        if(!r.data||!r.data.length){alert(fl('Nothing was removed — your account was not allowed to.','لم يُحذف شيء — لا تملك الصلاحية.'));return;}
        try{ if(window.__note)__note('finance',id,'individual booking removed',''); }catch(_){}
        B2C.rows=null; try{ if(window.FIN)FIN.rows=null; }catch(_){}
        load(); try{ if(typeof finLoad==='function')finLoad(); }catch(_){}
      });
    });
  }catch(e){}};

  function body(){
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var rows=B2C.rows||[];
    var tot=0; rows.forEach(function(r){tot+=+r.total_incl_vat_sar||0;});
    var editable=canFinEditSafe();

    var h='<div class="card" style="padding:16px;margin-bottom:14px">'+
      '<h3 class="finh" style="margin:0 0 3px">'+fl('Individual bookings','الحجوزات الفردية')+'</h3>'+
      '<div class="ch-sub" style="margin-bottom:12px">'+fl(
        'Bookings made for an individual, not a company — the one revenue pattern with no Direct Payments export to import from, so it’s entered here by hand. Each row is a real Finance record: it counts toward Revenue, Cost, Profit, Received and Outstanding exactly like an imported invoice.',
        'حجوزات لفرد وليس لشركة — نمط الإيراد الوحيد الذي لا يوجد له ملف تصدير من Direct Payments، لذلك يُدخل هنا يدويًا. كل صف هو سجل مالي حقيقي: يُحتسب ضمن الإيراد والتكلفة والربح والمحصّل والمتبقي تمامًا كأي فاتورة مستوردة.')+'</div>'+
      '<div><div style="font-size:11px;color:var(--muted)">'+fl('Total, all individual bookings','الإجمالي — كل الحجوزات الفردية')+'</div><div style="font-size:21px;font-weight:800;color:#175CD3">'+m0(tot)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'+
      '</div>';

    if(editable){
      h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 style="margin:0 0 10px;font-size:14px">'+fl('Add an individual booking','إضافة حجز فردي')+'</h3>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Date','التاريخ')+'</label><input type="date" id="bc_date" class="inp sm" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('Individual’s name','اسم الفرد')+'</label><input id="bc_name" class="inp sm" style="width:100%" placeholder="'+fl('e.g. Khalid Al-Otaibi','مثال: خالد العتيبي')+'"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Service','الخدمة')+'</label><select id="bc_svc" class="inp sm" style="width:100%"><option value="">'+fl('— choose —','— اختر —')+'</option>'+services().map(function(s){return '<option value="'+esc(s)+'">'+esc(svcLbl(s))+'</option>';}).join('')+'</select></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Amount (SAR)','المبلغ (ريال)')+'</label><input id="bc_amt" class="inp sm" inputmode="decimal" style="width:100%" placeholder="0"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Cost (SAR, optional)','التكلفة (ريال، اختياري)')+'</label><input id="bc_cost" class="inp sm" inputmode="decimal" style="width:100%" placeholder="0"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Status','الحالة')+'</label><select id="bc_status" class="inp sm" style="width:100%"><option value="verified_paid">'+fl('Paid','مدفوع')+'</option><option value="pending">'+fl('Pending','معلّق')+'</option></select></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Reference # (optional)','رقم مرجعي (اختياري)')+'</label><input id="bc_ref" class="inp sm" style="width:100%"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('Notes (optional)','ملاحظات')+'</label><input id="bc_notes" class="inp sm" style="width:100%"></div>'+
        '</div><button class="btn pri sm" style="margin-top:10px" onclick="b2cSave()">'+fl('Save','حفظ')+'</button></div>';
    }

    var th=function(t,r){return '<th style="padding:7px 9px;text-align:'+(r?'right':(ar?'right':'left'))+';color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap">'+t+'</th>';};
    var cols=6+(editable?1:0);
    h+='<div class="card" style="padding:16px"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:760px"><thead><tr>'+
      th(fl('Date','التاريخ'))+th(fl('Individual','الفرد'))+th(fl('Service','الخدمة'))+th(fl('Status','الحالة'))+th(fl('Reference','المرجع'))+th(fl('Amount','المبلغ'),1)+
      (editable?th(''):'')+'</tr></thead><tbody>'+
      (rows.length?rows.map(function(r){
        return '<tr style="border-top:1px solid var(--line,#eee)">'+
          '<td style="padding:7px 9px;white-space:nowrap">'+esc(r.invoice_date)+'</td>'+
          '<td style="padding:7px 9px;font-weight:600">'+esc(r.client_group)+(r.notes?'<div style="font-size:11px;color:var(--muted);font-weight:400">'+esc(r.notes)+'</div>':'')+'</td>'+
          '<td style="padding:7px 9px">'+esc(svcLbl(r.service_type)||'—')+'</td>'+
          '<td style="padding:7px 9px">'+(r.integrity_status==='verified_paid'?fl('Paid','مدفوع'):fl('Pending','معلّق'))+'</td>'+
          '<td style="padding:7px 9px;color:var(--muted);font-size:11.5px">'+esc(r.invoice_no||'—')+'</td>'+
          '<td style="padding:7px 9px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:#175CD3">'+m0(r.total_incl_vat_sar)+'</td>'+
          (editable?('<td style="padding:7px 9px"><button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="b2cDel(\''+r.id+'\')">✕</button></td>'):'')+
        '</tr>';
      }).join(''):'<tr><td colspan="'+cols+'" style="padding:22px;text-align:center;color:var(--muted)">'+fl('No individual bookings recorded yet.','لا حجوزات فردية مسجلة بعد.')+'</td></tr>')+
      '</tbody></table></div></div>';
    return h;
  }

  function markTab(){
    try{
      var view=document.getElementById('view'); if(!view)return;
      var bar=view.querySelector('div'); if(!bar)return;
      var btns=[].slice.call(bar.querySelectorAll('button'));
      if(!btns.length||!/finGo/.test(btns[0].getAttribute('onclick')||''))return;
      var mine=btns.find(function(b){return /finGo\('b2c'\)/.test(b.getAttribute('onclick')||'');});
      if(!mine){
        mine=document.createElement('button'); mine.className='btn sm ghost';
        mine.setAttribute('onclick',"finGo('b2c')");
        mine.textContent=fl('Individual bookings','الحجوزات الفردية');
        var proofsBtn=btns.find(function(b){return /finGo\('proofs'\)/.test(b.getAttribute('onclick')||'');});
        bar.insertBefore(mine, proofsBtn ? proofsBtn.nextSibling : null);
      }
      btns.concat([mine]).forEach(function(b){
        var isMine=/finGo\('b2c'\)/.test(b.getAttribute('onclick')||'');
        if(FIN.tab==='b2c'){ b.className='btn sm '+(isMine?'pri':'ghost'); }
      });
    }catch(_){}
  }

  var _rf=window.renderFinance;
  window.renderFinance=function(v){
    _rf.apply(this,arguments);
    try{
      if(typeof FIN==='undefined')return;
      if(FIN.tab==='b2c'){
        if(B2C.rows==null){ load(); }
        var view=document.getElementById('view'); if(!view)return;
        var bar=view.firstElementChild;
        view.innerHTML=''; if(bar)view.appendChild(bar);
        view.insertAdjacentHTML('beforeend', B2C.rows==null
          ? '<div class="card" style="padding:40px;text-align:center;color:var(--muted)">'+fl('Loading…','جاري التحميل…')+'</div>'
          : body());
      }
      markTab();
    }catch(e){console.warn('[b2c] render',e);}
  };

  console.info('%c[S3] individual bookings — the fifth revenue pattern, entered by hand','color:#175CD3;font-weight:700');
}catch(e){if(window.console)console.warn('[b2c] init',e);}})();
