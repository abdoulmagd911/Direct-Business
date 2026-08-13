/* v69 — Expenses: money OUT (owner framing 2026-08-13: "how to store every expense,
   the bank transfers, the credit card payments").
   A new Finance tab "Expenses" storing every company payment: date, what it was,
   category, amount, HOW it was paid (bank transfer / credit card / cash / mada /
   wallet), supplier, optional client it belongs to, receipt reference, notes.
   Money OUT lives in its own table (finance_expenses) and NEVER mixes into the
   client-income numbers — the revenue screens stay exactly as they are.
   Viewing: anyone with finance access. Adding/removing: admin + manager (same rule
   as the ledger). CSV export included. Additive layer, reversible. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
  function m0(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
  var EXP={rows:null,loading:false,month:'all'};
  window.EXPX=EXP;

  var VIA=[['bank_transfer','Bank transfer','تحويل بنكي'],['credit_card','Credit card','بطاقة ائتمانية'],['mada','mada','مدى'],['cash','Cash','نقدًا'],['wallet','Wallet','محفظة']];
  var CATS=[['Supplier payment','دفعة لمورّد'],['Government fees','رسوم حكومية'],['Marketing','تسويق'],['Software & subscriptions','برامج واشتراكات'],['Office & utilities','مكتب وخدمات'],['Salaries & staff','رواتب وموظفون'],['Bank fees','رسوم بنكية'],['Travel & transport','سفر وتنقل'],['Other','أخرى']];
  function viaLbl(k){var v=VIA.find(function(x){return x[0]===k;});return v?fl(v[1],v[2]):k;}
  function catLbl(k){var c=CATS.find(function(x){return x[0]===k;});return c?fl(c[0],c[1]):k;}

  function canEdit(){ try{return window.canFinEdit?canFinEdit():false;}catch(_){return false;} }
  function client(){ try{return window.fc?fc():null;}catch(_){return null;} }

  function load(cb){
    if(EXP.loading)return; EXP.loading=true;
    var c=client(); if(!c){EXP.loading=false;return;}
    c.from('finance_expenses').select('*').is('deleted_at',null).order('expense_date',{ascending:false}).then(function(r){
      EXP.loading=false;
      EXP.rows=(r&&!r.error&&r.data)?r.data:[];
      if(cb)cb(); else try{if(current==='finance'&&FIN.tab==='expenses')render();}catch(_){}
    });
  }

  window.expSave=function(){try{
    var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
    var row={
      expense_date:g('xp_date'), description:g('xp_desc').trim(), category:g('xp_cat'),
      amount_sar:parseFloat(String(g('xp_amt')).replace(/[^\d.]/g,''))||0,
      paid_via:g('xp_via'), supplier:g('xp_sup').trim()||null, client_group:g('xp_client').trim()||null,
      receipt_ref:g('xp_ref').trim()||null, notes:g('xp_notes').trim()||null,
      created_by:(window.meName?meName():'')
    };
    if(!row.expense_date||!row.description||!(row.amount_sar>0)){alert(fl('Date, description and an amount are required.','التاريخ والوصف والمبلغ مطلوبة.'));return;}
    var c=client(); if(!c)return;
    c.from('finance_expenses').insert(row).then(function(r){
      if(r.error){alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message);return;}
      if(typeof toast==='function')toast(fl('Expense saved','تم حفظ المصروف'));
      EXP.rows=null; load();
    });
  }catch(e){console.warn('[v69] save',e);}};

  window.expDel=function(id){try{
    if(!confirm(fl('Remove this expense? (kept in history, hidden from lists)','حذف هذا المصروف؟ (يبقى في السجل، يختفي من القوائم)')))return;
    var c=client(); if(!c)return;
    c.from('finance_expenses').update({deleted_at:new Date().toISOString()}).eq('id',id).then(function(r){
      if(r.error){alert(r.error.message);return;}
      EXP.rows=null; load();
    });
  }catch(e){}};

  window.expCSV=function(){try{
    var rows=view_(); var head=['date','description','category','amount_sar','paid_via','supplier','client','receipt_ref','notes','entered_by'];
    var csv=[head.join(',')].concat(rows.map(function(r){
      return [r.expense_date,r.description,r.category,r.amount_sar,r.paid_via,r.supplier||'',r.client_group||'',r.receipt_ref||'',r.notes||'',r.created_by||''].map(function(x){x=String(x==null?'':x);return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x;}).join(',');
    })).join('\n');
    var a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);a.download='direct-expenses-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  }catch(e){console.warn('[v69] csv',e);}};

  window.expMonth=function(v){EXP.month=v;render();};

  function view_(){
    var rows=EXP.rows||[];
    if(EXP.month!=='all')rows=rows.filter(function(r){return String(r.expense_date||'').slice(0,7)===EXP.month;});
    return rows;
  }

  function body(){
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var rows=view_(); var all=EXP.rows||[];
    var months=Array.from(new Set(all.map(function(r){return String(r.expense_date||'').slice(0,7);}))).sort().reverse();
    var tot=0,byVia={},byCat={};
    rows.forEach(function(r){tot+=+r.amount_sar||0;byVia[r.paid_via]=(byVia[r.paid_via]||0)+ +r.amount_sar;byCat[r.category]=(byCat[r.category]||0)+ +r.amount_sar;});
    var clients=((typeof DB!=='undefined'&&DB.businesses)||[]).filter(function(b){return b.isClient;}).map(function(b){return b.name;});
    var h='<div class="card" style="padding:16px;margin-bottom:14px">'+
      '<h3 class="finh" style="margin:0 0 3px">'+fl('Expenses — money out','المصروفات — أموال خارجة')+'</h3>'+
      '<div class="ch-sub" style="margin-bottom:12px">'+fl('Every company payment: bank transfers, credit card, mada, cash. Kept apart from client income — these numbers never touch the revenue screens.','كل مدفوعات الشركة: تحويلات بنكية، بطاقة ائتمانية، مدى، نقدًا. منفصلة تمامًا عن إيرادات العملاء.')+'</div>'+
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:6px">'+
        '<div><div style="font-size:11px;color:var(--muted)">'+fl('Total in view','الإجمالي المعروض')+'</div><div style="font-size:21px;font-weight:800;color:#B54708">'+m0(tot)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'+
        Object.keys(byVia).map(function(k){return '<div><div style="font-size:11px;color:var(--muted)">'+esc(viaLbl(k))+'</div><div style="font-size:15px;font-weight:700">'+m0(byVia[k])+'</div></div>';}).join('')+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
        '<select class="inp sm" style="max-width:160px" onchange="expMonth(this.value)"><option value="all">'+fl('All months','كل الشهور')+'</option>'+months.map(function(mn){return '<option value="'+mn+'" '+(EXP.month===mn?'selected':'')+'>'+mn+'</option>';}).join('')+'</select>'+
        '<button class="btn sm ghost" onclick="expCSV()">⬇ '+fl('Export CSV','تصدير CSV')+'</button>'+
      '</div></div>';
    if(canEdit()){
      h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 style="margin:0 0 10px;font-size:14px">'+fl('Add an expense','إضافة مصروف')+'</h3>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Date','التاريخ')+'</label><input type="date" id="xp_date" class="inp sm" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('What was it for?','على ماذا؟')+'</label><input id="xp_desc" class="inp sm" style="width:100%" placeholder="'+fl('e.g. Amadeus subscription — August','مثال: اشتراك أماديوس — أغسطس')+'"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Amount (SAR)','المبلغ (ريال)')+'</label><input id="xp_amt" class="inp sm" inputmode="decimal" style="width:100%" placeholder="0"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Paid via','طريقة الدفع')+'</label><select id="xp_via" class="inp sm" style="width:100%">'+VIA.map(function(v){return '<option value="'+v[0]+'">'+fl(v[1],v[2])+'</option>';}).join('')+'</select></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Category','التصنيف')+'</label><select id="xp_cat" class="inp sm" style="width:100%">'+CATS.map(function(c){return '<option value="'+esc(c[0])+'">'+fl(c[0],c[1])+'</option>';}).join('')+'</select></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Supplier (optional)','المورّد (اختياري)')+'</label><input id="xp_sup" class="inp sm" style="width:100%"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('For a client? (optional)','لعميل؟ (اختياري)')+'</label><input id="xp_client" class="inp sm" style="width:100%" list="xp_clients"><datalist id="xp_clients">'+clients.map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Receipt / transfer ref (optional)','مرجع الإيصال/التحويل')+'</label><input id="xp_ref" class="inp sm" style="width:100%"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('Notes (optional)','ملاحظات')+'</label><input id="xp_notes" class="inp sm" style="width:100%"></div>'+
        '</div><button class="btn pri sm" style="margin-top:10px" onclick="expSave()">'+fl('Save expense','حفظ المصروف')+'</button></div>';
    }
    var th=function(t,r){return '<th style="padding:7px 9px;text-align:'+(r?'right':(ar?'right':'left'))+';color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap">'+t+'</th>';};
    h+='<div class="card" style="padding:16px"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:720px"><thead><tr>'+
      th(fl('Date','التاريخ'))+th(fl('Description','الوصف'))+th(fl('Category','التصنيف'))+th(fl('Paid via','طريقة الدفع'))+th(fl('Supplier / client','المورّد / العميل'))+th(fl('Ref','المرجع'))+th(fl('Amount','المبلغ'),1)+(canEdit()?th(''):'')+'</tr></thead><tbody>'+
      (rows.length?rows.map(function(r){
        return '<tr style="border-top:1px solid var(--line,#eee)">'+
          '<td style="padding:7px 9px;white-space:nowrap">'+esc(r.expense_date)+'</td>'+
          '<td style="padding:7px 9px;font-weight:600">'+esc(r.description)+(r.notes?'<div style="font-size:11px;color:var(--muted);font-weight:400">'+esc(r.notes)+'</div>':'')+'</td>'+
          '<td style="padding:7px 9px">'+esc(catLbl(r.category))+'</td>'+
          '<td style="padding:7px 9px">'+esc(viaLbl(r.paid_via))+'</td>'+
          '<td style="padding:7px 9px;color:var(--muted)">'+esc(r.supplier||r.client_group||'—')+'</td>'+
          '<td style="padding:7px 9px;color:var(--muted);font-size:11.5px">'+esc(r.receipt_ref||'—')+'</td>'+
          '<td style="padding:7px 9px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:#B54708">'+m0(r.amount_sar)+'</td>'+
          (canEdit()?('<td style="padding:7px 9px"><button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="expDel(\''+r.id+'\')">✕</button></td>'):'')+
        '</tr>';
      }).join(''):'<tr><td colspan="8" style="padding:22px;text-align:center;color:var(--muted)">'+fl('No expenses recorded yet.','لا مصروفات مسجلة بعد.')+'</td></tr>')+
      '</tbody></table></div></div>';
    return h;
  }

  function markTab(){
    try{
      var view=document.getElementById('view'); if(!view)return;
      var bar=view.querySelector('div'); if(!bar)return;
      var btns=[].slice.call(bar.querySelectorAll('button'));
      if(!btns.length||!/finGo/.test(btns[0].getAttribute('onclick')||''))return;
      var mine=btns.find(function(b){return /finGo\('expenses'\)/.test(b.getAttribute('onclick')||'');});
      if(!mine){
        mine=document.createElement('button'); mine.className='btn sm ghost';
        mine.setAttribute('onclick',"finGo('expenses')");
        mine.textContent=fl('Expenses','المصروفات');
        var impBtn=btns.find(function(b){return /finGo\('import'\)/.test(b.getAttribute('onclick')||'');});
        bar.insertBefore(mine,impBtn||null);
      }
      btns.concat([mine]).forEach(function(b){
        var isExp=/finGo\('expenses'\)/.test(b.getAttribute('onclick')||'');
        if(FIN.tab==='expenses'){ b.className='btn sm '+(isExp?'pri':'ghost'); }
      });
    }catch(_){}
  }

  var _rf=window.renderFinance;
  window.renderFinance=function(v){
    _rf.apply(this,arguments);
    try{
      if(typeof FIN==='undefined')return;
      if(FIN.tab==='expenses'){
        if(EXP.rows==null){ load(); }
        var view=document.getElementById('view'); if(!view)return;
        var bar=view.firstElementChild;
        view.innerHTML=''; if(bar)view.appendChild(bar);
        view.insertAdjacentHTML('beforeend', EXP.rows==null
          ? '<div class="card" style="padding:40px;text-align:center;color:var(--muted)">'+fl('Loading expenses…','جاري تحميل المصروفات…')+'</div>'
          : body());
      }
      markTab();
    }catch(e){console.warn('[v69] render',e);}
  };

  console.info('%c[v69] expenses (money out) loaded','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[v69] init',e);}})();
