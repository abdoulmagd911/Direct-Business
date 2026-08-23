/* ===== Payment proofs — the audit document register, never a Finance number (chapter, sitting S3 — 2026-08-19) =====

   Where this came from. The Aug-12 audit purged wallet top-ups from Finance entirely — they
   are not Direct's revenue, so they were deleted from the ledger and the importer now skips
   them. That stands. What was still missing: the proof itself. When MDD (a prepaid client)
   tops up its wallet, someone at Direct Payments still needs the bank-transfer screenshot on
   file for audit — and today that file, if it exists anywhere, is loose in an inbox. This
   chapter is that file cabinet, and nothing else.

   THE RULE THIS FILE MUST KEEP, on the owner's explicit instruction (2026-08-19): this is
   audit/document infrastructure, NOT a Finance feature. `proof_documents` carries no revenue,
   cost or profit — amount_sar exists only to tag a file and build its downloaded name.
   Nothing here is ever summed into a Finance total, KPI or report. If a future change makes
   that happen, it is a bug, not a feature.

   A wallet-top-up reference and an invoice/tax-invoice reference both live here purely as
   tags — for finding a file again and for the name it downloads under. Same three guarantees
   as the Expenses chapter (S5) this borrows its shape from: record only, every file remembers
   its proof, and the downloaded name is generated fresh from the row, never stored.

   NAMING SCHEME (the owner asked for a concrete recommendation — this is it, applied here and
   matching the existing Expenses names):
     {TYPE}_{Client}_{Ref}_{Amount}SAR_{Date}_{last4ofID}.{ext}
   TYPE is PAY / WTU / DOC. Ref is the invoice number and/or wallet-top-up number, joined with
   a dash when a row carries both (a top-up that already became an invoice). Latin-only, same
   reason as Expenses: these get opened on locked-down Windows machines. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function m0(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
  var PRX={rows:null,loading:false,type:'all',month:'all',sel:{}};
  window.PRX=PRX;

  var TYPES=[['payment_proof','Payment proof','إثبات دفع'],['wallet_top_up','Wallet top-up','تعبئة محفظة'],['other','Other document','مستند آخر']];
  function typeLbl(k){var t=TYPES.find(function(x){return x[0]===k;});return t?fl(t[1],t[2]):k;}

  function canView(){ try{return window.canFinView?canFinView():false;}catch(_){return false;} }
  function canAdd(){ try{ return !window.__isShareView && !!window.__userTier; }catch(_){ return false; } }
  function canRemove(){ try{return window.canFinEdit?canFinEdit():false;}catch(_){return false;} }
  function client(){ try{return window.fc?fc():null;}catch(_){return null;} }
  function meNow(){ try{ return (window.__userName||(window.meName?meName():'')||''); }catch(_){ return ''; } }

  /* In-page confirmation, not window.confirm(). A native confirm() blocks the whole tab on
     its own modal loop, which freezes any scripted/automated driver of the page (Playwright
     included, per the owner's own hands-on QA of this exact chapter) — so anything that
     needs a "are you sure" here uses this instead. */
  window.pfConfirm=function(msg,onYes){
    try{
      var old=document.getElementById('pfConfirmBox'); if(old)old.remove();
      var ar=(typeof LANG!=='undefined'&&LANG==='ar');
      var d=document.createElement('div'); d.id='pfConfirmBox';
      /* Found 2026-08-20: this box must out-rank EVERY modal it might be confirming inside,
         not just its own page. The Finance invoice detail modal alone uses z-index:999999 —
         at 99998 this box was rendering invisibly BEHIND it, so "Delete invoice" looked like
         a dead button (no confirm box ever appeared, nothing clicked, no error) when it was
         really working the whole time, just hidden. 1e9 clears every modal in the app with
         wide headroom, while staying under the ~2.1e9 tier reserved for session/permission
         system banners, which must still win if ever shown at the same time as this. */
      d.style.cssText='position:fixed;inset:0;z-index:1000000000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center';
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
    }catch(e){ console.warn('[proof] confirm',e); onYes(); }
  };

  function load(cb){
    if(PRX.loading)return; PRX.loading=true;
    var c=client(); if(!c){PRX.loading=false;return;}
    c.from('proof_documents').select('*').is('deleted_at',null).order('doc_date',{ascending:false}).then(function(r){
      PRX.loading=false;
      PRX.rows=(r&&!r.error&&r.data)?r.data:[];
      if(cb)cb(); else try{if(current==='finance'&&FIN.tab==='proofs')render();}catch(_){}
    });
  }

  /* ---------- the generated download name — Latin only, never stored ---------- */
  function latin(s,max){
    var out=String(s==null?'':s);
    try{ out=out.normalize('NFKD').replace(/[\u0300-\u036f]/g,''); }catch(_){}
    out=out.replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    return out.slice(0,max||40);
  }
  function extOf(name){ var m=/\.([A-Za-z0-9]{1,5})$/.exec(String(name||'')); return m?m[1].toLowerCase():'bin'; }
  window.proofFileName=function(r){
    var typeCode=r.doc_type==='wallet_top_up'?'WTU':(r.doc_type==='other'?'DOC':'PAY');
    var refs=[r.invoice_no,r.wallet_topup_ref].filter(Boolean).map(function(x){return latin(x,22);});
    var parts=[typeCode,
      latin(r.client_group||'client',22),
      refs.length?refs.join('-'):'no-ref',
      (r.amount_sar!=null&&r.amount_sar!=='')?Math.round(Number(r.amount_sar)||0)+'SAR':'',
      latin(r.doc_date||'',10),
      String(r.id||'').replace(/-/g,'').slice(-4)];
    return parts.filter(Boolean).join('_').slice(0,140)+'.'+extOf(r.file_name);
  };
  function fileUrl(r){
    try{ var c=client(); if(!c||!r.file_path) return ''; var p=c.storage.from('payment-proofs').getPublicUrl(r.file_path); return (p&&p.data&&p.data.publicUrl)||''; }catch(_){ return ''; }
  }

  /* ---------- attaching the file ---------- */
  function upload(row,file,done){
    var c=client(); if(!c||!file){done&&done('no file');return;}
    if(!/\.(pdf|png|jpe?g|webp|docx|xlsx)$/i.test(file.name)) return done&&done(fl('Accepted: PDF, images, Word, Excel.','المقبول: PDF، صور، Word، Excel.'));
    if(file.size>25*1024*1024) return done&&done(fl('That file is larger than 25MB.','الملف أكبر من 25 ميجابايت.'));
    var path='proof/'+row.id+'/'+Date.now()+'-'+latin(file.name.replace(/\.[^.]+$/,''),30)+'.'+extOf(file.name);
    c.storage.from('payment-proofs').upload(path,file,{upsert:false}).then(function(up){
      if(up&&up.error) return done&&done(up.error.message);
      c.from('proof_documents').update({
        file_path:path, file_name:file.name, file_uploaded_by:meNow(), file_uploaded_at:new Date().toISOString()
      }).eq('id',row.id).select().then(function(r){
        if(r&&r.error) return done&&done(r.error.message);
        if(!r||!r.data||!r.data.length) return done&&done(fl('The file uploaded but the record would not accept it — nothing was saved.','تم رفع الملف لكن السجل لم يقبله — لم يُحفظ شيء.'));
        done&&done(null);
      });
    }).catch(function(e){ done&&done(String(e)); });
  }

  window.proofAttach=function(id){try{
    var row=(PRX.rows||[]).find(function(x){return x.id===id;}); if(!row)return;
    var inp=document.createElement('input'); inp.type='file';
    inp.accept='.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx';
    inp.onchange=function(){
      var f=inp.files&&inp.files[0]; if(!f)return;
      if(typeof toast==='function')toast(fl('Uploading…','جارٍ الرفع…'));
      upload(row,f,function(err){
        if(err){alert(fl('Could not attach the file: ','تعذر إرفاق الملف: ')+err);return;}
        if(typeof toast==='function')toast(fl('File attached','تم إرفاق الملف'));
        try{ if(window.__note)__note('finance',id,'proof document attached',f.name); }catch(_){}
        PRX.rows=null; load();
      });
    };
    inp.click();
  }catch(e){console.warn('[proof] attach',e);}};

  /* preview = open the file as-is, in a new tab. download = fetch + save under the generated name.
     A plain link cannot rename a file hosted elsewhere — the browser ignores the download name. */
  window.proofPreview=function(id){try{
    var r=(PRX.rows||[]).find(function(x){return x.id===id;}); if(!r||!r.file_path)return;
    var url=fileUrl(r); if(url) window.open(url,'_blank');
  }catch(e){console.warn('[proof] preview',e);}};

  window.proofDownload=function(id){try{
    var r=(PRX.rows||[]).find(function(x){return x.id===id;}); if(!r||!r.file_path)return;
    var url=fileUrl(r); if(!url)return;
    fetch(url).then(function(res){return res.blob();}).then(function(b){
      var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=proofFileName(r);
      document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
    }).catch(function(e){ alert(fl('Could not download: ','تعذر التنزيل: ')+e); });
  }catch(e){console.warn('[proof] download',e);}};

  /* ---------- selection, for bulk download ---------- */
  window.proofToggleSel=function(id){ PRX.sel[id]=!PRX.sel[id]; render(); };
  window.proofSelectAll=function(){
    var v=view_().filter(function(r){return r.file_path;});
    var allOn=v.length && v.every(function(r){return PRX.sel[r.id];});
    v.forEach(function(r){ PRX.sel[r.id]=!allOn; });
    render();
  };
  function selectedRows(){ return view_().filter(function(r){return r.file_path && PRX.sel[r.id];}); }

  function downloadInSequence(rows){ var i=0; (function next(){ if(i>=rows.length)return; proofDownload(rows[i++].id); setTimeout(next,900); })(); }

  window.proofDownloadSelected=function(){try{
    var rows=selectedRows();
    if(!rows.length){alert(fl('Select at least one document with a file attached first.','اختر مستندًا واحدًا على الأقل يحتوي على ملف أولًا.'));return;}
    pfConfirm(fl(rows.length+' documents will be downloaded, one at a time.',rows.length+' مستندًا سيتم تنزيلها واحدًا تلو الآخر.'), function(){ downloadInSequence(rows); });
  }catch(e){console.warn('[proof] downloadSelected',e);}};

  window.proofDownloadAll=function(){try{
    var rows=view_().filter(function(r){return r.file_path;});
    if(!rows.length){alert(fl('None of the documents in view have a file attached yet.','لا يوجد ملف مرفق بأي مستند معروض.'));return;}
    pfConfirm(fl(rows.length+' documents will be downloaded, one at a time.',rows.length+' مستندًا سيتم تنزيلها واحدًا تلو الآخر.'), function(){ downloadInSequence(rows); });
  }catch(e){console.warn('[proof] downloadAll',e);}};

  /* The manifest is what makes this a real audit hand-off, not just a pile of files. */
  window.proofCSV=function(){try{
    var rows=view_();
    var head=['file_name_when_downloaded','type','date','client','invoice_no','wallet_topup_ref','amount_sar','notes','file_attached','uploaded_by','uploaded_at','created_by'];
    var csv=[head.join(',')].concat(rows.map(function(r){
      return [ r.file_path?proofFileName(r):'', typeLbl(r.doc_type), r.doc_date, r.client_group||'',
               r.invoice_no||'', r.wallet_topup_ref||'', r.amount_sar==null?'':r.amount_sar, r.notes||'',
               r.file_path?'yes':'no', r.file_uploaded_by||'', r.file_uploaded_at||'', r.created_by||''
             ].map(function(x){x=csvGuard(x);return /[",\n]/.test(x)||x.charCodeAt(0)===39?'"'+x.replace(/"/g,'""')+'"':x;}).join(',');
    })).join('\n');
    var a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
    a.download='direct-payment-proofs-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  }catch(e){console.warn('[proof] csv',e);}};

  window.proofSave=function(){try{
    var g=function(id){var e=document.getElementById(id);return e?e.value:'';};
    var row={
      doc_type:g('pf_type')||'payment_proof',
      doc_date:g('pf_date'),
      client_group:g('pf_client').trim()||null,
      invoice_no:g('pf_inv').trim()||null,
      wallet_topup_ref:g('pf_wtu').trim()||null,
      amount_sar:g('pf_amt')?parseFloat(String(g('pf_amt')).replace(/[^\d.]/g,'')):null,
      notes:g('pf_notes').trim()||null,
      created_by:meNow()
    };
    if(!row.doc_date){alert(fl('A date is needed.','التاريخ مطلوب.'));return;}
    if(!row.invoice_no && !row.wallet_topup_ref){alert(fl('Give at least an invoice number or a wallet-top-up number — one of the two ties this to a real record.','أدخل رقم فاتورة أو رقم تعبئة محفظة على الأقل — أحدهما يربط هذا بسجل حقيقي.'));return;}
    var c=client(); if(!c)return;
    c.from('proof_documents').insert(row).select().then(function(r){
      if(r.error){alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message);return;}
      if(!r.data||!r.data.length){alert(fl('The record was not saved — your account was not allowed to write it.','لم يُحفظ السجل — لا تملك صلاحية الكتابة.'));return;}
      var saved=r.data[0];
      try{ if(window.__note)__note('finance',saved.id,'payment proof added',typeLbl(row.doc_type)+' · '+(row.invoice_no||row.wallet_topup_ref||'')); }catch(_){}
      var fi=document.getElementById('pf_file'), f=fi&&fi.files&&fi.files[0];
      if(f){
        upload(saved,f,function(err){
          if(err)alert(fl('Record saved, but the file did not attach: ','حُفظ السجل لكن لم يُرفق الملف: ')+err);
          else if(typeof toast==='function')toast(fl('Document and its file saved','تم حفظ المستند وملفه'));
          PRX.rows=null; load();
        });
      }else{
        if(typeof toast==='function')toast(fl('Record saved — attach the file when you have it','تم حفظ السجل — أرفق الملف لاحقًا'));
        PRX.rows=null; load();
      }
    });
  }catch(e){console.warn('[proof] save',e);}};

  window.proofDel=function(id){try{
    pfConfirm(fl('Remove this document record? It stays in the history and disappears from the list.','حذف هذا المستند؟ يبقى في السجل ويختفي من القائمة.'), function(){
      var c=client(); if(!c)return;
      c.from('proof_documents').update({deleted_at:new Date().toISOString()}).eq('id',id).select().then(function(r){
        if(r.error){alert(r.error.message);return;}
        if(!r.data||!r.data.length){alert(fl('Nothing was removed — your account was not allowed to.','لم يُحذف شيء — لا تملك الصلاحية.'));return;}
        try{ if(window.__note)__note('finance',id,'payment proof removed',''); }catch(_){}
        delete PRX.sel[id];
        PRX.rows=null; load();
      });
    });
  }catch(e){}};

  window.proofType=function(v){PRX.type=v;render();};
  window.proofMonth=function(v){PRX.month=v;render();};

  function view_(){
    var rows=PRX.rows||[];
    if(PRX.type!=='all')rows=rows.filter(function(r){return r.doc_type===PRX.type;});
    if(PRX.month!=='all')rows=rows.filter(function(r){return String(r.doc_date||'').slice(0,7)===PRX.month;});
    return rows;
  }

  function body(){
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var rows=view_(); var all=PRX.rows||[];
    var months=Array.from(new Set(all.map(function(r){return String(r.doc_date||'').slice(0,7);}))).sort().reverse();
    var byType={},noFile=0;
    all.forEach(function(r){ byType[r.doc_type]=(byType[r.doc_type]||0)+1; if(!r.file_path)noFile++; });
    var selCount=view_().filter(function(r){return r.file_path&&PRX.sel[r.id];}).length;
    var clients=((typeof DB!=='undefined'&&DB.businesses)||[]).filter(function(b){return b.isClient;}).map(function(b){return b.name;});

    var h='<div class="card" style="padding:16px;margin-bottom:14px">'+
      '<h3 class="finh" style="margin:0 0 3px">'+fl('Payment proofs','مستندات الدفع')+'</h3>'+
      '<div class="ch-sub" style="margin-bottom:12px">'+fl(
        'Bank-transfer and wallet top-up proofs, filed for audits. Nothing here counts toward Revenue, Cost or Profit — wallet top-ups especially are never counted as revenue.',
        'إثباتات التحويل البنكي وتعبئة المحفظة، للتدقيق. لا شيء هنا يُحتسب ضمن الإيراد أو التكلفة أو الربح — وتعبئات المحفظة تحديدًا لا تُحتسب إيرادًا أبدًا.')+'</div>'+
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:6px">'+
        '<div><div style="font-size:11px;color:var(--muted)">'+fl('Documents in view','المستندات المعروضة')+'</div><div style="font-size:21px;font-weight:800;color:#175CD3">'+rows.length+'</div></div>'+
        TYPES.map(function(t){return byType[t[0]]?'<div><div style="font-size:11px;color:var(--muted)">'+fl(t[1],t[2])+'</div><div style="font-size:15px;font-weight:700">'+byType[t[0]]+'</div></div>':'';}).join('')+
      '</div>'+
      (noFile?('<div style="margin:8px 0 2px;font-size:12px;color:#8b5b1f">⚠ '+fl(noFile+' record(s) without a file attached',noFile+' سجل بلا ملف مرفق')+'</div>'):'')+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">'+
        '<select class="inp sm" style="max-width:170px" onchange="proofType(this.value)"><option value="all" '+(PRX.type==='all'?'selected':'')+'>'+fl('All types','كل الأنواع')+'</option>'+TYPES.map(function(t){return '<option value="'+t[0]+'" '+(PRX.type===t[0]?'selected':'')+'>'+fl(t[1],t[2])+'</option>';}).join('')+'</select>'+
        '<select class="inp sm" style="max-width:160px" onchange="proofMonth(this.value)"><option value="all">'+fl('All months','كل الشهور')+'</option>'+months.map(function(mn){return '<option value="'+mn+'" '+(PRX.month===mn?'selected':'')+'>'+mn+'</option>';}).join('')+'</select>'+
        '<button class="btn sm ghost" onclick="proofSelectAll()">☑ '+fl('Select all in view','تحديد الكل')+'</button>'+
        '<button class="btn sm ghost" onclick="proofDownloadSelected()" '+(selCount?'':'disabled')+'>⬇ '+fl('Download selected ('+selCount+')','تنزيل المحدد ('+selCount+')')+'</button>'+
        '<button class="btn sm ghost" onclick="proofDownloadAll()">⬇ '+fl('Download all in view','تنزيل الكل')+'</button>'+
        '<button class="btn sm ghost" onclick="proofCSV()">⬇ '+fl('Export list (CSV)','تصدير القائمة (CSV)')+'</button>'+
      '</div></div>';

    if(canAdd()){
      h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 style="margin:0 0 10px;font-size:14px">'+fl('Add a payment proof','إضافة مستند دفع')+'</h3>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Type','النوع')+'</label><select id="pf_type" class="inp sm" style="width:100%">'+TYPES.map(function(t){return '<option value="'+t[0]+'">'+fl(t[1],t[2])+'</option>';}).join('')+'</select></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Date','التاريخ')+'</label><input type="date" id="pf_date" class="inp sm" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Client','العميل')+'</label><input id="pf_client" class="inp sm" style="width:100%" list="pf_clients"><datalist id="pf_clients">'+clients.map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Invoice / tax-invoice #','رقم الفاتورة الضريبية')+'</label><input id="pf_inv" class="inp sm" style="width:100%" placeholder="'+fl('if any','إن وجد')+'"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Wallet top-up #','رقم تعبئة المحفظة')+'</label><input id="pf_wtu" class="inp sm" style="width:100%" placeholder="'+fl('if any','إن وجد')+'"></div>'+
        '<div><label style="font-size:11px;color:var(--muted)">'+fl('Amount (SAR, optional)','المبلغ (ريال، اختياري)')+'</label><input id="pf_amt" class="inp sm" inputmode="decimal" style="width:100%" placeholder="0"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('The file — screenshot or receipt','الملف — صورة أو إيصال')+'</label><input type="file" id="pf_file" class="inp sm" style="width:100%;font-size:12px" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"></div>'+
        '<div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">'+fl('Notes (optional)','ملاحظات')+'</label><input id="pf_notes" class="inp sm" style="width:100%"></div>'+
        '</div><button class="btn pri sm" style="margin-top:10px" onclick="proofSave()">'+fl('Save','حفظ')+'</button></div>';
    }

    var th=function(t,r){return '<th style="padding:7px 9px;text-align:'+(r?'right':(ar?'right':'left'))+';color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap">'+t+'</th>';};
    var cols=8+(canRemove()?1:0);
    h+='<div class="card" style="padding:16px"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:900px"><thead><tr>'+
      th('')+th(fl('Date','التاريخ'))+th(fl('Type','النوع'))+th(fl('Client','العميل'))+th(fl('Invoice #','رقم الفاتورة'))+
      th(fl('Wallet top-up #','رقم التعبئة'))+th(fl('File','الملف'))+th(fl('Amount','المبلغ'),1)+
      (canRemove()?th(''):'')+'</tr></thead><tbody>'+
      (rows.length?rows.map(function(r){
        var fileCell=r.file_path
          ? '<button class="btn ghost sm" style="padding:1px 6px;font-size:10.5px" onclick="proofPreview(\''+r.id+'\')" title="'+esc(r.file_name||'')+'">👁 '+fl('preview','معاينة')+'</button> '+
            '<button class="btn ghost sm" style="padding:1px 6px;font-size:10.5px" onclick="proofDownload(\''+r.id+'\')">⬇</button>'
          : (canAdd()?'<button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px;color:#B54708" onclick="proofAttach(\''+r.id+'\')">+ '+fl('attach','إرفاق')+'</button>'
                     :'<span style="color:#B54708;font-size:11px">'+fl('missing','ناقص')+'</span>');
        return '<tr style="border-top:1px solid var(--line,#eee)">'+
          '<td style="padding:7px 9px">'+(r.file_path?'<input type="checkbox" '+(PRX.sel[r.id]?'checked':'')+' onchange="proofToggleSel(\''+r.id+'\')">':'')+'</td>'+
          '<td style="padding:7px 9px;white-space:nowrap">'+esc(r.doc_date)+'</td>'+
          '<td style="padding:7px 9px">'+esc(typeLbl(r.doc_type))+'</td>'+
          '<td style="padding:7px 9px">'+esc(r.client_group||'—')+(r.notes?'<div style="font-size:11px;color:var(--muted)">'+esc(r.notes)+'</div>':'')+'</td>'+
          '<td style="padding:7px 9px;color:var(--muted);font-size:11.5px">'+esc(r.invoice_no||'—')+'</td>'+
          '<td style="padding:7px 9px;color:var(--muted);font-size:11.5px">'+esc(r.wallet_topup_ref||'—')+'</td>'+
          '<td style="padding:7px 9px;white-space:nowrap">'+fileCell+'</td>'+
          '<td style="padding:7px 9px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">'+(r.amount_sar==null?'—':m0(r.amount_sar))+'</td>'+
          (canRemove()?('<td style="padding:7px 9px"><button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="proofDel(\''+r.id+'\')">✕</button></td>'):'')+
        '</tr>';
      }).join(''):'<tr><td colspan="'+cols+'" style="padding:22px;text-align:center;color:var(--muted)">'+fl('No payment proofs recorded yet.','لا مستندات دفع مسجلة بعد.')+'</td></tr>')+
      '</tbody></table></div></div>';
    return h;
  }

  function markTab(){
    try{
      var view=document.getElementById('view'); if(!view)return;
      var bar=view.querySelector('div'); if(!bar)return;
      var btns=[].slice.call(bar.querySelectorAll('button'));
      if(!btns.length||!/finGo/.test(btns[0].getAttribute('onclick')||''))return;
      var mine=btns.find(function(b){return /finGo\('proofs'\)/.test(b.getAttribute('onclick')||'');});
      if(!mine){
        mine=document.createElement('button'); mine.className='btn sm ghost';
        mine.setAttribute('onclick',"finGo('proofs')");
        mine.textContent=fl('Payment proofs','مستندات الدفع');
        var expBtn=btns.find(function(b){return /finGo\('expenses'\)/.test(b.getAttribute('onclick')||'');});
        bar.insertBefore(mine, expBtn ? expBtn.nextSibling : null);
      }
      btns.concat([mine]).forEach(function(b){
        var isMine=/finGo\('proofs'\)/.test(b.getAttribute('onclick')||'');
        if(FIN.tab==='proofs'){ b.className='btn sm '+(isMine?'pri':'ghost'); }
      });
    }catch(_){}
  }

  var _rf=window.renderFinance;
  window.renderFinance=function(v){
    _rf.apply(this,arguments);
    try{
      if(typeof FIN==='undefined')return;
      if(FIN.tab==='proofs'){
        if(PRX.rows==null){ load(); }
        var view=document.getElementById('view'); if(!view)return;
        var bar=view.firstElementChild;
        view.innerHTML=''; if(bar)view.appendChild(bar);
        view.insertAdjacentHTML('beforeend', PRX.rows==null
          ? '<div class="card" style="padding:40px;text-align:center;color:var(--muted)">'+fl('Loading…','جاري التحميل…')+'</div>'
          : body());
      }
      markTab();
    }catch(e){console.warn('[proof] render',e);}
  };

  console.info('%c[S3] payment proofs — audit document register, kept out of Finance totals','color:#175CD3;font-weight:700');
}catch(e){if(window.console)console.warn('[proof] init',e);}})();
