/* ===== Expenses — the real cost behind a service (chapter, sitting S5 — 2026-08-16) =====

   What this tab is, in the owner's words (2026-08-16): not company-wide overheads like
   salaries, marketing or bank fees. It is the actual service costs — the real money paid
   out for the services Direct resells to a client at a margin. The hotel that was bought,
   the activity that was booked, the visa that was paid for.

   THREE RULES THIS FILE MUST KEEP:

   1. RECORD ONLY. Nothing here may ever be added to, or substituted for, an invoice's cost
      or profit — anywhere, ever. The owner: "I want the accurate amounts because the rest
      of the work will happen on the actual Direct system." These rows exist so money spent
      can be found again and defended in an audit, not to compute anything. `finance_expenses`
      is read by this file and nothing else; a test in scripts/qa fails loudly if a figure
      on any Finance tab ever moves when an expense is added.

   2. EVERY EXPENSE CARRIES ITS PROOF. The screenshot or receipt lives in the "expenses"
      storage bucket, and the row remembers where. Stored paths are unique and never reused,
      so a document can't be quietly overwritten — which is the whole point of keeping it.

   3. THE EXPORT NAME IS GENERATED, NOT STORED. Audit asks for "all the expenses" and needs
      files it can read the meaning of. The name is composed from the row at the moment of
      download — transaction, service, amount, date — so correcting a record fixes its file
      name too, with no stored file renamed and no link broken. English/Latin only, on the
      owner's instruction, because these bundles get opened on locked-down Windows machines
      where Arabic file names are a lottery.

   Not in this chapter, deliberately: the proposal side of the same naming scheme. That one
   needs a proposal to be attached to a real invoice or transaction first, and the owner has
   parked the proposal generator as a later piece. Conflating them here would build it twice.  */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function m0(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
  var EXP={rows:null,loading:false,month:'all'};
  window.EXPX=EXP;

  var VIA=[['bank_transfer','Bank transfer','تحويل بنكي'],['credit_card','Credit card','بطاقة ائتمانية'],['mada','mada','مدى'],['cash','Cash','نقدًا'],['wallet','Wallet','محفظة']];
  /* Legacy wording only — kept so expenses entered before 2026-08-16 still read correctly.
     New ones are filed under a service, not one of these. */
  var CATS=[['Supplier payment','دفعة لمورّد'],['Government fees','رسوم حكومية'],['Marketing','تسويق'],['Software & subscriptions','برامج واشتراكات'],['Office & utilities','مكتب وخدمات'],['Salaries & staff','رواتب وموظفون'],['Bank fees','رسوم بنكية'],['Travel & transport','سفر وتنقل'],['Other','أخرى']];
  function viaLbl(k){var v=VIA.find(function(x){return x[0]===k;});return v?fl(v[1],v[2]):k;}
  function catLbl(k){var c=CATS.find(function(x){return x[0]===k;});return c?fl(c[0],c[1]):k;}
  /* the same service list the rest of the app uses, so an expense and the invoice it sits
     behind describe the service with the same word */
  function services(){
    try{ if(window.SVC_CATALOG&&SVC_CATALOG.length) return SVC_CATALOG.map(function(s){return s[0];}).filter(function(v,i,a){return a.indexOf(v)===i;}); }catch(_){}
    return ['Flights','Hotels','Visas','Umrah','Transfers','Insurance','Activities / tours','MICE / events','eSIM','Other'];
  }
  function svcLbl(k){try{ return window.svcLabel?svcLabel(k):k; }catch(_){ return k; }}

  function canView(){ try{return window.canFinView?canFinView():false;}catch(_){return false;} }
  /* The owner asked for BD's own expenses. BD are team members, and the database has always
     allowed them to write here — only this screen didn't offer it.
     Removing follows the access model signed off at go-live, where employees edit Finance
     as well as Leads and Clients (js/52-v76). Nothing is destroyed by it: the row is hidden,
     kept in history, and the audit log records who hid it. */
  function canAdd(){ try{ return !window.__isShareView && !!window.__userTier; }catch(_){ return false; } }
  function canRemove(){ try{return window.canFinEdit?canFinEdit():false;}catch(_){return false;} }
  function client(){ try{return window.fc?fc():null;}catch(_){return null;} }
  function meNow(){ try{ return (window.__userName||(window.meName?meName():'')||''); }catch(_){ return ''; } }

  function load(cb){
    if(EXP.loading)return; EXP.loading=true;
    var c=client(); if(!c){EXP.loading=false;return;}
    c.from('finance_expenses').select('*').is('deleted_at',null).order('expense_date',{ascending:false}).then(function(r){
      EXP.loading=false;
      EXP.rows=(r&&!r.error&&r.data)?r.data:[];
      if(cb)cb(); else try{if(current==='finance'&&FIN.tab==='expenses')render();}catch(_){}
    });
  }

  /* ---------- the generated export name ---------- */
  /* Latin only. Arabic and anything else becomes a dash, on the owner's instruction. */
  function latin(s,max){
    var out=String(s==null?'':s);
    try{ out=out.normalize('NFKD').replace(/[\u0300-\u036f]/g,''); }catch(_){}
    out=out.replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    return out.slice(0,max||40);
  }
  function extOf(name){ var m=/\.([A-Za-z0-9]{1,5})$/.exec(String(name||'')); return m?m[1].toLowerCase():'bin'; }
  window.expFileName=function(r){
    var parts=['EXP',
      latin(r.transaction_ref||r.invoice_no||'no-txn',24),
      latin(r.service_type||'no-service',20),
      Math.round(Number(r.amount_sar)||0)+'SAR',
      latin(r.expense_date||'',10),
      String(r.id||'').replace(/-/g,'').slice(-4)];
    return parts.filter(Boolean).join('_').slice(0,120)+'.'+extOf(r.proof_name);
  };
  function proofUrl(r){
    try{ var c=client(); if(!c||!r.proof_path) return ''; var p=c.storage.from('expenses').getPublicUrl(r.proof_path); return (p&&p.data&&p.data.publicUrl)||''; }catch(_){ return ''; }
  }

  /* ---------- attaching the proof ---------- */
  function upload(row,file,done){
    var c=client(); if(!c||!file){done&&done('no file');return;}
    if(!/\.(pdf|png|jpe?g|webp|docx|xlsx)$/i.test(file.name)) return done&&done(fl('Accepted: PDF, images, Word, Excel.','المقبول: PDF، صور، Word، Excel.'));
    if(file.size>25*1024*1024) return done&&done(fl('That file is larger than 25MB.','الملف أكبر من 25 ميجابايت.'));
    var path='exp/'+row.id+'/'+Date.now()+'-'+latin(file.name.replace(/\.[^.]+$/,''),30)+'.'+extOf(file.name);
    c.storage.from('expenses').upload(path,file,{upsert:false}).then(function(up){
      if(up&&up.error) return done&&done(up.error.message);
      c.from('finance_expenses').update({
        proof_path:path, proof_name:file.name, proof_uploaded_by:meNow(), proof_uploaded_at:new Date().toISOString()
      }).eq('id',row.id).select().then(function(r){
        /* A refused write comes back as success with nothing in it — count the rows. */
        if(r&&r.error) return done&&done(r.error.message);
        if(!r||!r.data||!r.data.length) return done&&done(fl('The file uploaded but the record would not accept it — nothing was saved.','تم رفع الملف لكن السجل لم يقبله — لم يُحفظ شيء.'));
        done&&done(null);
      });
    }).catch(function(e){ done&&done(String(e)); });
  }

  window.expAttach=function(id){try{
    var row=(EXP.rows||[]).find(function(x){return x.id===id;}); if(!row)return;
    var inp=document.createElement('input'); inp.type='file';
    inp.accept='.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx';
    inp.onchange=function(){
      var f=inp.files&&inp.files[0]; if(!f)return;
      if(typeof toast==='function')toast(fl('Uploading…','جارٍ الرفع…'));
      upload(row,f,function(err){
        if(err){alert(fl('Could not attach the proof: ','تعذر إرفاق المستند: ')+err);return;}
        if(typeof toast==='function')toast(fl('Proof attached','تم إرفاق المستند'));
        try{ if(window.__note)__note('finance',id,'expense proof attached',f.name); }catch(_){}
        EXP.rows=null; load();
      });
    };
    inp.click();
  }catch(e){console.warn('[exp] attach',e);}};

  /* Fetch then save, so the file lands under its generated name. A plain link cannot rename
     a file that comes from another host — the browser ignores the download name. */
  window.expDownload=function(id){try{
    var r=(EXP.rows||[]).find(function(x){return x.id===id;}); if(!r||!r.proof_path)return;
    var url=proofUrl(r); if(!url)return;
    fetch(url).then(function(res){return res.blob();}).then(function(b){
      var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=expFileName(r);
      document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
    }).catch(function(e){ alert(fl('Could not download: ','تعذر التنزيل: ')+e); });
  }catch(e){console.warn('[exp] download',e);}};

  /* In-page confirm, not window.confirm() — a native dialog blocks the whole tab on its own
     modal loop. Reuses js/57's pfConfirm box when it's loaded (same one Payment proofs,
     Individual bookings and the Ledger's "Delete invoice" already share), with a plain
     confirm() fallback only if it somehow isn't. */
  function expConfirm(msg,onYes){
    try{ if(window.pfConfirm) return pfConfirm(msg,onYes); }catch(_){}
    if(confirm(msg))onYes();
  }
  window.expDownloadAll=function(){try{
    var rows=view_().filter(function(r){return r.proof_path;});
    if(!rows.length){alert(fl('None of the expenses in view have a document attached yet.','لا يوجد مستند مرفق بأي مصروف معروض.'));return;}
    expConfirm(fl(rows.length+' documents will be downloaded, one at a time.',rows.length+' مستندًا سيتم تنزيلها واحدًا تلو الآخر.'), function(){
    var i=0;
    (function next(){ if(i>=rows.length)return; expDownload(rows[i++].id); setTimeout(next,900); })();
    });
  }catch(e){console.warn('[exp] downloadAll',e);}};

  /* The manifest is what makes a bundle auditable — the files alone are just files. */
  window.expCSV=function(){try{
    var rows=view_();
    var head=['file_name','date','transaction_ref','invoice_no','service','description','amount_sar','paid_via','supplier','client','receipt_ref','proof_attached','proof_uploaded_by','proof_uploaded_at','notes','entered_by'];
    var csv=[head.join(',')].concat(rows.map(function(r){
      return [ r.proof_path?expFileName(r):'', r.expense_date, r.transaction_ref||'', r.invoice_no||'',
               r.service_type||r.category||'', r.description, r.amount_sar, r.paid_via, r.supplier||'',
               r.client_group||'', r.receipt_ref||'', r.proof_path?'yes':'no', r.proof_uploaded_by||'',
               r.proof_uploaded_at||'', r.notes||'', r.created_by||''
             ].map(function(x){x=String(x==null?'':x);return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x;}).join(',');
    })).join('\n');
    var a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
    a.download='direct-expenses-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  }catch(e){console.warn('[exp] csv',e);}};

  window.expSave=function(){try{
    var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
    var row={
      expense_date:g('xp_date'), description:g('xp_desc').trim(),
      service_type:g('xp_svc')||null,
      transaction_ref:g('xp_txn').trim()||null,
      amount_sar:parseFloat(String(g('xp_amt')).replace(/[^\d.]/g,''))||0,
      paid_via:g('xp_via'), supplier:g('xp_sup').trim()||null, client_group:g('xp_client').trim()||null,
      receipt_ref:g('xp_ref').trim()||null, notes:g('xp_notes').trim()||null,
      created_by:meNow()
    };
    if(!row.expense_date||!row.description||!(row.amount_sar>0)){alert(fl('Date, what it was for, and an amount are all needed.','التاريخ والوصف والمبلغ مطلوبة.'));return;}
    if(!row.service_type){alert(fl('Which service was this cost for? Every expense here sits behind a service.','لأي خدمة هذه التكلفة؟ كل مصروف هنا يخص خدمة.'));return;}
    var c=client(); if(!c)return;
    c.from('finance_expenses').insert(row).select().then(function(r){
      if(r.error){alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message);return;}
      if(!r.data||!r.data.length){alert(fl('The expense was not saved — your account was not allowed to write it.','لم يُحفظ المصروف — لا تملك صلاحية الكتابة.'));return;}
      var saved=r.data[0];
      try{ if(window.__note)__note('finance',saved.id,'expense added',row.description+' · '+m0(row.amount_sar)+' SAR'); }catch(_){}
      var fi=document.getElementById('xp_file'), f=fi&&fi.files&&fi.files[0];
      if(f){
        upload(saved,f,function(err){
          if(err)alert(fl('Expense saved, but the document did not attach: ','حُفظ المصروف لكن لم يُرفق المستند: ')+err);
          else if(typeof toast==='function')toast(fl('Expense and its proof saved','تم حفظ المصروف ومستنده'));
          EXP.rows=null; load();
        });
      }else{
        if(typeof toast==='function')toast(fl('Expense saved — attach its proof when you have it','تم حفظ المصروف — أرفق المستند لاحقًا'));
        EXP.rows=null; load();
      }
    });
  }catch(e){console.warn('[exp] save',e);}};

  window.expDel=function(id){try{
    expConfirm(fl('Remove this expense? It stays in the history and disappears from the list.','حذف هذا المصروف؟ يبقى في السجل ويختفي من القائمة.'), function(){
      var c=client(); if(!c)return;
      c.from('finance_expenses').update({deleted_at:new Date().toISOString()}).eq('id',id).select().then(function(r){
        if(r.error){alert(r.error.message);return;}
        if(!r.data||!r.data.length){alert(fl('Nothing was removed — your account was not allowed to.','لم يُحذف شيء — لا تملك الصلاحية.'));return;}
        try{ if(window.__note)__note('finance',id,'expense removed',''); }catch(_){}
        EXP.rows=null; load();
      });
    });
  }catch(e){}};

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
    var tot=0,byVia={},noProof=0,noSvc=0;
    rows.forEach(function(r){tot+=+r.amount_sar||0;byVia[r.paid_via]=(byVia[r.paid_via]||0)+ +r.amount_sar;
      if(!r.proof_path)noProof++; if(!r.service_type)noSvc++;});
    var clients=((typeof DB!=='undefined'&&DB.businesses)||[]).filter(function(b){return b.isClient;}).map(function(b){return b.name;});
    var txns=[];
    try{ txns=Array.from(new Set(((window.FIN&&FIN.rows)||[]).map(function(r){return r.transaction_ref||r.invoice_no;}).filter(Boolean))).slice(0,400); }catch(_){}

    var h='<div class="card" style="padding:16px;margin-bottom:14px">'+
      '<h3 class="finh" style="margin:0 0 3px">'+fl('Expenses — the cost behind a service','المصروفات — تكلفة الخدمة')+'</h3>'+
      '<div class="ch-sub" style="margin-bottom:12px">'+fl(
        'What we actually paid out for the services we resell — the hotel, the activity, the visa. Each one belongs to a transaction and keeps its receipt. These amounts are a record only: they never change an invoice’s cost or profit.',
        'ما دفعناه فعليًا مقابل الخدمات التي نبيعها — الفندق، النشاط، التأشيرة. كل مصروف يتبع معاملة ويحتفظ بإيصاله. هذه المبالغ للسجل فقط ولا تغيّر تكلفة أو ربح أي فاتورة.')+'</div>'+
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:6px">'+
        '<div><div style="font-size:11px;color:var(--muted)">'+fl('Total in view','الإجمالي المعروض')+'</div><div style="font-size:21px;font-weight:800;color:#B54708">'+m0(tot)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'+
        Object.keys(byVia).map(function(k){return '<div><div style="font-size:11px;color:var(--muted)">'+esc(viaLbl(k))+'</div><div style="font-size:15px;font-weight:700">'+m0(byVia[k])+'</div></div>';}).join('')+
      '</div>'+
      ((noProof||noSvc)?('<div style="margin:8px 0 2px;font-size:12px;color:#8b5b1f">⚠ '+
        [ noProof?fl(noProof+' without a document attached',noProof+' بلا مستند مرفق'):'',
          noSvc?fl(noSvc+' not yet filed under a service',noSvc+' بلا خدمة محددة'):'' ].filter(Boolean).join(' · ')+
        '</div>'):'')+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">'+
        '<select class="inp sm" style="max-width:160px" onchange="expMonth(this.value)"><option value="all">'+fl('All months','كل الشهور')+'</option>'+months.map(function(mn){return '<option value="'+mn+'" '+(EXP.month===mn?'selected':'')+'>'+mn+'</option>';}).join('')+'</select>'+
        '<button class="btn sm ghost" onclick="expCSV()">⬇ '+fl('Export list (CSV)','تصدير القائمة (CSV)')+'</button>'+
        '<button class="btn sm ghost" onclick="expDownloadAll()">⬇ '+fl('Download the documents','تنزيل المستندات')+'</button>'+
      '</div></div>';

    if(canAdd()){
      h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 style="margin:0 0 10px;font-size:14px">'+fl('Add a service cost','إضافة تكلفة خدمة')+'</h3>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Date','التاريخ')+'</label><input type="date" id="xp_date" class="inp sm" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('What was bought?','ما الذي تم شراؤه؟')+'</label><input id="xp_desc" class="inp sm" style="width:100%" placeholder="'+fl('e.g. Makkah hotel — 40 rooms, 3 nights','مثال: فندق مكة — 40 غرفة، 3 ليالٍ')+'"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Service','الخدمة')+'</label><select id="xp_svc" class="inp sm" style="width:100%"><option value="">'+fl('— choose —','— اختر —')+'</option>'+services().map(function(s){return '<option value="'+esc(s)+'">'+esc(svcLbl(s))+'</option>';}).join('')+'</select></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Transaction / invoice','المعاملة / الفاتورة')+'</label><input id="xp_txn" class="inp sm" style="width:100%" list="xp_txns" placeholder="'+fl('optional','اختياري')+'"><datalist id="xp_txns">'+txns.map(function(t){return '<option value="'+esc(t)+'">';}).join('')+'</datalist></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Amount (SAR)','المبلغ (ريال)')+'</label><input id="xp_amt" class="inp sm" inputmode="decimal" style="width:100%" placeholder="0"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Paid via','طريقة الدفع')+'</label><select id="xp_via" class="inp sm" style="width:100%">'+VIA.map(function(v){return '<option value="'+v[0]+'">'+fl(v[1],v[2])+'</option>';}).join('')+'</select></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Supplier (optional)','المورّد (اختياري)')+'</label><input id="xp_sup" class="inp sm" style="width:100%"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('For a client? (optional)','لعميل؟ (اختياري)')+'</label><input id="xp_client" class="inp sm" style="width:100%" list="xp_clients"><datalist id="xp_clients">'+clients.map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Receipt / transfer ref','مرجع الإيصال/التحويل')+'</label><input id="xp_ref" class="inp sm" style="width:100%"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('The proof — receipt or screenshot','المستند — إيصال أو صورة')+'</label><input type="file" id="xp_file" class="inp sm" style="width:100%;font-size:12px" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('Notes (optional)','ملاحظات')+'</label><input id="xp_notes" class="inp sm" style="width:100%"></div>'+
        '</div><button class="btn pri sm" style="margin-top:10px" onclick="expSave()">'+fl('Save','حفظ')+'</button></div>';
    }

    var th=function(t,r){return '<th style="padding:7px 9px;text-align:'+(r?'right':(ar?'right':'left'))+';color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap">'+t+'</th>';};
    var cols=7+(canAdd()?1:0)+(canRemove()?1:0);
    h+='<div class="card" style="padding:16px"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:820px"><thead><tr>'+
      th(fl('Date','التاريخ'))+th(fl('What was bought','ما تم شراؤه'))+th(fl('Service','الخدمة'))+th(fl('Transaction','المعاملة'))+
      th(fl('Paid via','طريقة الدفع'))+th(fl('Supplier / client','المورّد / العميل'))+th(fl('Proof','المستند'))+th(fl('Amount','المبلغ'),1)+
      (canRemove()?th(''):'')+'</tr></thead><tbody>'+
      (rows.length?rows.map(function(r){
        var svcCell=r.service_type?esc(svcLbl(r.service_type))
          :(r.category?'<span style="color:var(--muted)">'+esc(catLbl(r.category))+'</span> <span title="'+fl('Filed under an old category — choose a service','تصنيف قديم — اختر خدمة')+'" style="color:#B54708">⚠</span>'
                      :'<span style="color:#B54708">'+fl('not set','غير محددة')+'</span>');
        var proofCell=r.proof_path
          ? '<button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="expDownload(\''+r.id+'\')" title="'+esc(r.proof_name||'')+'">⬇ '+fl('open','فتح')+'</button>'
          : (canAdd()?'<button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px;color:#B54708" onclick="expAttach(\''+r.id+'\')">+ '+fl('attach','إرفاق')+'</button>'
                     :'<span style="color:#B54708;font-size:11px">'+fl('missing','ناقص')+'</span>');
        return '<tr style="border-top:1px solid var(--line,#eee)">'+
          '<td style="padding:7px 9px;white-space:nowrap">'+esc(r.expense_date)+'</td>'+
          '<td style="padding:7px 9px;font-weight:600">'+esc(r.description)+(r.notes?'<div style="font-size:11px;color:var(--muted);font-weight:400">'+esc(r.notes)+'</div>':'')+'</td>'+
          '<td style="padding:7px 9px">'+svcCell+'</td>'+
          '<td style="padding:7px 9px;color:var(--muted);font-size:11.5px">'+esc(r.transaction_ref||r.invoice_no||'—')+'</td>'+
          '<td style="padding:7px 9px">'+esc(viaLbl(r.paid_via))+'</td>'+
          '<td style="padding:7px 9px;color:var(--muted)">'+esc(r.supplier||r.client_group||'—')+'</td>'+
          '<td style="padding:7px 9px">'+proofCell+'</td>'+
          '<td style="padding:7px 9px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:#B54708">'+m0(r.amount_sar)+'</td>'+
          (canRemove()?('<td style="padding:7px 9px"><button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="expDel(\''+r.id+'\')">✕</button></td>'):'')+
        '</tr>';
      }).join(''):'<tr><td colspan="'+cols+'" style="padding:22px;text-align:center;color:var(--muted)">'+fl('No service costs recorded yet.','لا تكاليف خدمات مسجلة بعد.')+'</td></tr>')+
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
          ? '<div class="card" style="padding:40px;text-align:center;color:var(--muted)">'+fl('Loading…','جاري التحميل…')+'</div>'
          : body());
      }
      markTab();
    }catch(e){console.warn('[exp] render',e);}
  };

  console.info('%c[S5] expenses — service costs with proof','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[exp] init',e);}})();
