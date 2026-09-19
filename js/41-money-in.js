/* ===== Money-in pipes — one chapter, one file (Finance sitting F2 — 2026-08-16) =====

   The two pieces that bring money INTO the ledger and attach it to a client:
     part 1 (was js/41-v65)  the Direct Payments importer — drag in an export, parse it,
                              preview it, commit it as finance rows
     part 2 (was js/42-v66)  automatic finance-to-client linking, so every imported row
                              lands on the right client with no manual matching step

   Old slots were ADJACENT (41, 42): nothing loads between them, so folding into slot 41
   changes no order at all, and part 2 does not use part 1's parser — they are independent
   pipes that happen to share a purpose. Verbatim, each part keeps its own try/catch.

   These are the only two layers in the app that CREATE finance rows and CLIENT LINKS, so
   this merge was checked against the live link map (which invoice belongs to which client,
   and the money each carries) as well as the on-screen figures.                          */

/* ---------- part 1 — Direct Payments importer (was js/41-v65) ---------- */
/* v65 — THE IMPORTER (owner-approved blueprint step 1, 2026-08-12).
   Drop a Direct Payments export (CSV or Excel) into Finance → Import and the ledger
   fills itself: invoices, their transactions, commissions, wallet top-ups, credit
   notes — all four revenue ways — using Direct's own fee-pair rules:
     · non-taxable lines = the cost (pass-through)
     · taxable lines     = Direct's income; the whole taxable amount is the profit
     · VAT is computed for storage only, never displayed
     · a numbered invoice paired with an unnumbered twin of the same total = the
       transaction it came from (stored in transaction_ref)
   Also folds away the old MANUAL mirror path (Today's "New invoice" now opens this
   importer; the "From Direct (read-only)" nav group is hidden — pages stay reachable).
   Additive layer: wraps finParse; the legacy simple-CSV format still works unchanged. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function esc64(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
  /* 2026-09-02 (attack round 14): same reading as js/65's moneyG — Arabic-Indic digits, "(500)",
     decimal commas — so the two import paths can never read one cell two ways. Falls back to
     the original one-liner if js/65 is not there. */
  function money64(x){ if(typeof x==='number')return x; try{ if(typeof window.__v65MoneyG==='function')return window.__v65MoneyG(x); }catch(_){} return parseFloat(String(x==null?'':x).replace(/[^\d.\-]/g,''))||0; }
  function m0(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
  function isoDate(s){ // "18/06/2026 03:35:42 PM" or "2026-06-18..." → "2026-06-18"
    s=String(s||'').trim(); var m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(m)return m[3]+'-'+m[2]+'-'+m[1];
    m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m?m[0]:null;
  }
  var SVC64={'Direct Flights':'Flights','Direct Hotels':'Hotels','Direct Visa':'Visas',
    'Direct Course':'Study abroad','Direct Support':'Support services',
    'Direct Packages':'Packages','Direct Wallet':'Wallet top-up'};

  function csvParse64(text){
    text=String(text).replace(/^﻿/,'');
    var rows=[],row=[],cur='',inQ=false;
    for(var i=0;i<text.length;i++){ var ch=text[i];
      if(inQ){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else inQ=false; } else cur+=ch; }
      else if(ch==='"')inQ=true;
      else if(ch===','){row.push(cur);cur='';}
      else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n')i++; row.push(cur);cur=''; if(row.length>1||row[0]!=='')rows.push(row); row=[]; }
      else cur+=ch; }
    if(cur!==''||row.length)row.push(cur); if(row.length>1||(row.length===1&&row[0]!==''))rows.push(row);
    return rows;
  }

  function isDPHeader(hdr){
    var h=hdr.map(function(x){return String(x||'').trim();});
    return h.indexOf('Type')>=0 && h.indexOf('Invoice Reference #')>=0 && h.indexOf('Customer Name')>=0 && h.indexOf('Item Is Taxable')>=0;
  }

  var _walletSkipped=0,_verifSkipped=0,_clientExcluded=0,_clientExcludedDetail=[];
  function parseDP(rows){
    _walletSkipped=0;_verifSkipped=0;_clientExcluded=0;_clientExcludedDetail=[];
    var hdr=rows[0].map(function(x){return String(x||'').trim();});
    function ix(n){return hdr.indexOf(n);}
    var iType=ix('Type'),iProd=ix('Product'),iCust=ix('Customer Name'),iRef=ix('Invoice Reference #'),
        iNum=ix('Invoice Number'),iCreate=ix('Invoice Create Date'),iStatus=ix('Invoice Status'),
        iName=ix('Name'),iTax=ix('Item Is Taxable'),iDisc=ix('Item Discount'),iItemTot=ix('Item Total'),
        iTot=ix('Invoice Total'),iBranch=ix('Sale Branch'),iSales=ix('Salesman');
    var invs={},order=[];
    for(var r=1;r<rows.length;r++){
      var row=rows[r]; if(!row||!row.length)continue;
      var t=String(row[iType]||'').trim(), ref=String(row[iRef]||'').trim();
      if(!ref)continue;
      if(t==='invoice'||t==='credit_note'){
        if(!invs[ref]){order.push(ref);}
        invs[ref]={ref:ref,num:String(row[iNum]||'').trim()||null,date:isoDate(row[iCreate]),
          status:String(row[iStatus]||'').trim(),cust:String(row[iCust]||'').trim(),
          credit:(t==='credit_note'),total:money64(row[iTot]),
          branch:String(row[iBranch]||'').trim()||null,salesman:String(row[iSales]||'').trim()||null,items:[]};
      } else if(t==='item'&&invs[ref]){
        invs[ref].items.push({name:String(row[iName]||'').trim(),taxable:String(row[iTax]||'').trim()==='Yes',
          discount:money64(row[iDisc]),total:money64(row[iItemTot]),product:String(row[iProd]||'').trim()});
      }
    }
    // per-invoice math
    var out=[];
    order.forEach(function(ref){
      var inv=invs[ref];
      if(/Cancelled/i.test(inv.status))return; // never entered the books
      var cost=0,taxTot=0,disc=0,svcs={},comm=false,wallet=false,verif=false;
      inv.items.forEach(function(it){
        if(it.taxable)taxTot+=it.total; else cost+=it.total;
        disc+=it.discount||0;
        if(it.product)svcs[SVC64[it.product]||it.product]=1;
        if(/Commission/i.test(it.name))comm=true;
        if(/Wallet Balance/i.test(it.name)||it.product==='Direct Wallet')wallet=true;
        if(it.product==='Techtic Support'||/Verification/i.test(it.name)||/Verification/i.test(it.product||''))verif=true;
      });
      var profit=Math.round(taxTot/1.15*100)/100, vat=Math.round((taxTot-profit)*100)/100;
      if(wallet){_walletSkipped++;return;} // owner rule 2026-08-12: wallet top-ups are NOT imported at all
      if(verif){_verifSkipped++;return;}   // owner rule 2026-08-13: verification services are accounted for elsewhere — never imported here
      // Spec 4 item 1 (2026-08-21) — the real bug fix: excluding a CLIENT (Takamol) is a
      // separate rule from excluding a PRODUCT (Techtic Support/Verification above), and
      // must never rest on a product regex — a Takamol invoice for any other service used
      // to sail straight through. Checked by client ID via the exclusion list (js/62); the
      // list is name-matched today only because Direct Payments hasn't shipped a
      // transaction-level export carrying a numeric client ID yet — never silent, the match
      // is recorded so the preview can show exactly which id and why.
      var xhit=(typeof window.finExclusionCheck==='function')?window.finExclusionCheck(inv.cust):null;
      if(xhit){ _clientExcluded++; _clientExcludedDetail.push({name:inv.cust,clientId:xhit.clientId,reason:xhit.reason}); return; }
      var svc=Object.keys(svcs).sort().join(' + ')||'Other';
      var st = inv.credit?'credit' : /Fully Paid/i.test(inv.status)?'paid' : /Draft/i.test(inv.status)?'draft' : 'pending';
      out.push({ref:ref,num:inv.num,date:inv.date,cust:inv.cust,total:inv.total,cost:Math.round(cost*100)/100,
        profit:profit,vat:vat,disc:Math.round(disc*100)/100,svc:svc,st:st,comm:comm,wallet:wallet,
        branch:inv.branch,salesman:inv.salesman});
    });
    // twin pairing: numbered + unnumbered same customer+total → the unnumbered one is the transaction
    var byKey={};
    out.forEach(function(i){var k=i.cust+'|'+i.total.toFixed(2);(byKey[k]=byKey[k]||[]).push(i);});
    var drop={};
    Object.keys(byKey).forEach(function(k){
      var g=byKey[k],nums=g.filter(function(i){return i.num;}),plain=g.filter(function(i){return !i.num;});
      nums.forEach(function(n){ if(plain.length&&!n.tx){var tw=plain.shift();n.tx=tw.ref;drop[tw.ref]=1;} });
    });
    return out.filter(function(i){return !drop[i.ref];});
  }

  function toRows(parsed){
    return parsed.map(function(i){
      var integ = i.wallet?'excluded' : i.st==='paid'?'verified_paid' : i.st==='credit'?'credit_note' : 'pending';
      /* 2026-09-18 (fire #93): this said `(i.total - i.vat)` — revenue with VAT taken out of it, which
         is M1's exact prohibition: VAT must never enter or be mixed into revenue, cost or profit. The
         doctrine, the database trigger `finance_derive_fields` (BEFORE INSERT OR UPDATE) and js/65's
         own importer all agree that revenue = total − wallet. This was the only place in the app that
         subtracted VAT instead.
         It has never produced a wrong stored figure, for two independent reasons: every VAT value in
         the live ledger is 0.00, so the two formulas returned the same number; and the trigger rewrites
         revenue whenever it differs from total − wallet by more than a hundredth, so the database was
         never going to keep this one. But the app was computing it wrongly on the live import path —
         js/65's real importer calls THIS function through window.__v65_toRowsDP — and a Direct Payments
         export carrying real VAT would have made the app's own arithmetic disagree with the ledger it
         was writing to. A doctrine that survives only because a trigger silently corrects it is not
         being followed. Wallet rows stay 0: their wallet_portion is the whole total. */
      var rev = i.wallet?0 : Math.round(i.total*100)/100;
      return {
        invoice_no:i.ref, zatca_dpin:i.num, client_group:i.cust, customer_raw_name:i.cust,
        invoice_date:i.date,
        // month NAME + bare quarter — the period filters compare against 'January'…'December' and 'Q1'…'Q4'
        month:i.date?['January','February','March','April','May','June','July','August','September','October','November','December'][+i.date.slice(5,7)-1]:null,
        quarter:i.date?('Q'+(Math.floor((+i.date.slice(5,7)-1)/3)+1)):null,
        products:i.svc, service_type:i.svc, record_type:'b2b',
        total_incl_vat_sar:i.total, wallet_portion_sar:i.wallet?i.total:0, revenue_sar:rev,
        cost_sar:i.cost, profit_sar:i.profit, vat_sar:i.vat, discount_sar:i.disc,
        amount_received_sar:(i.st==='paid'?i.total:0),
        amount_remaining_sar:(i.st==='paid'||i.st==='credit')?0:i.total,
        integrity_status:integ,
        exclusion_reason:i.wallet?'wallet top-up — excluded from revenue by definition':null,
        notes:i.st==='draft'?'Draft in Direct Payments':null,
        source_batch:'dp-import-'+todayISO(),
        line_no:1, branch:i.branch, salesman:i.salesman,
        revenue_way:(i.comm?'commission':(!i.num&&i.st!=='credit'&&!i.wallet)?'transaction':'invoice'),
        transaction_ref:i.tx||null
      };
    });
  }

  function preview(rows,skipped,supCount,deletedSkipped){
    var paid=0,pend=0,cred=0,comm=0,tx=0,tot=0,wal=_walletSkipped;
    rows.forEach(function(r){
      if(r.integrity_status==='verified_paid'){paid++;tot+=r.total_incl_vat_sar;}
      else if(r.integrity_status==='credit_note')cred++;
      else pend++;
      if(r.revenue_way==='commission')comm++;
      if(r.revenue_way==='transaction')tx++;
    });
    var h='<div style="font-size:13px;line-height:2">'+
      '<b>'+fl('Direct Payments export detected — preview, nothing written yet:','ملف Direct Payments — معاينة، لم يُكتب شيء بعد:')+'</b><br>'+
      '✅ '+fl('Ready to import:','جاهز للاستيراد:')+' <b>'+rows.length+'</b> '+fl('invoices','فاتورة')+
      ' · '+fl('paid','مدفوع')+' <b>'+paid+'</b> ('+m0(tot)+' SAR)'+
      ' · '+fl('pending payment','بانتظار السداد')+' <b>'+pend+'</b>'+
      (tx?' · '+fl('transactions (tax invoice later)','معاملات (الفاتورة الضريبية لاحقًا)')+' <b>'+tx+'</b>':'')+
      (comm?' · '+fl('commissions','عمولات')+' <b>'+comm+'</b>':'')+
      (cred?' · '+fl('credit notes','إشعارات دائنة')+' <b>'+cred+'</b>':'')+
      (wal?' · '+fl('wallet top-ups skipped (not stored)','تم تجاوز تعبئة المحفظة (لا تُخزن)')+' <b>'+wal+'</b>':'')+
      (_verifSkipped?' · '+fl('verification services skipped (accounted for elsewhere)','تم تجاوز خدمات التوثيق (تُحتسب في نظام آخر)')+' <b>'+_verifSkipped+'</b>':'')+
      (_clientExcluded?('<br>🚫 '+fl('Excluded by rule:','مستبعد بحسب القاعدة:')+' <b>'+_clientExcluded+'</b> — '+esc64(_clientExcludedDetail.map(function(d){return d.name+' (#'+d.clientId+(d.reason?(': '+d.reason):'')+')';}).join('; '))):'')+
      (skipped?('<br>↩ '+fl('Skipped (already in the ledger):','تم تجاوزها (موجودة مسبقًا):')+' <b>'+skipped+'</b>'):'')+
      /* said separately and in plain words: these are NOT in the ledger, they were deleted */
      (deletedSkipped?('<br>🗑 '+fl('Left alone — you deleted these invoice numbers before:','لم تُلمس — أرقام فواتير سبق أن حذفتها:')+' <b>'+deletedSkipped+'</b>'+
        '<div style="font-size:12px;color:var(--muted)">'+fl('They are not in the ledger and nothing was written to them. Bringing one back is your decision — restore it from the Ledger tab.',
                                                             'ليست في السجل ولم يُكتب إليها شيء. إعادتها قرارك — استعدها من تبويب «السجل».')+'</div>'):'')+
      (supCount?('<br>🔗 '+fl('Already-recorded transactions that now have their tax invoice — the old pending transaction will retire, this invoice replaces it:','معاملات مسجّلة سابقًا صدرت لها الآن فاتورة ضريبية — سيتقاعد سجل المعاملة المعلّق القديم وتحل محله هذه الفاتورة:')+' <b>'+supCount+'</b>'):'')+
      '</div>'+
      (rows.length?('<button class="btn pri sm" style="margin-top:8px" onclick="finCommit()">'+fl('Confirm import of '+rows.length+' rows','تأكيد استيراد '+rows.length+' صف')+'</button>'):'');
    document.getElementById('finImpOut').innerHTML=h;
    FIN._pending=rows.length?rows:null;
  }

  function runDP(rows2d){
    try{
      var parsed=parseDP(rows2d);
      /* 2026-09-19 (fire #102): this index counted SOFT-DELETED rows as "already in the ledger".
         finLoad() selects finance_invoices with no deleted_at filter on purpose — the Ledger offers
         Restore — so FIN.rows carries them, and the live database holds 45 of them today. Drop the
         same export again after deleting an invoice and the preview said "↩ Skipped (already in the
         ledger)", which is not true of a row that was deleted: it is not in the ledger, and nothing
         said its number had ever been seen.
         js/65 fixed exactly this on 2026-09-02, in the owner's own words — "I deleted it, dropped
         the file again, it said updated, and the invoice never came back" — and this import path,
         the Direct Payments one, kept the unfixed twin. The line directly below already checked
         !r.deleted_at for its own index, so the distinction was known here and simply not applied.
         Deleted numbers are kept apart and REPORTED now, never counted as ordinary duplicates and
         never silently resurrected: restoring one is the owner's decision, not the importer's. A
         number with BOTH a live and a deleted row is matched on the live one, exactly as before. */
      var existing={}, deletedOnly={};
      ((window.FIN&&FIN.rows)||[]).forEach(function(r){ if(r.invoice_no&&!r.deleted_at) existing[r.invoice_no]=1; });
      ((window.FIN&&FIN.rows)||[]).forEach(function(r){ if(r.invoice_no&&r.deleted_at&&!existing[r.invoice_no]) deletedOnly[r.invoice_no]=1; });
      /* Cross-import twin resolution (S4, 2026-08-20). parseDP()'s twin pairing above only
         matches a numbered invoice to its unnumbered transaction WITHIN one file — but the
         normal way this app gets used is: import an export today (a transaction still
         pending, no tax invoice yet), then import a NEWER export weeks later where that
         same transaction now HAS its tax invoice. At that point the twin is a row ALREADY
         IN THE DATABASE from the first import, not another row in this file, so the pairing
         above never sees it — and without this step both rows would sit in the ledger and
         double-count the same money forever: once as the old pending transaction, once as
         the new invoice. Matched on the exact same key the intra-file pairing already uses
         (client + total) — same trust level already approved for that pairing. */
      var openTx={};
      ((window.FIN&&FIN.rows)||[]).forEach(function(r){
        if(r.revenue_way==='transaction'&&!r.deleted_at&&r.integrity_status==='pending'){
          openTx[r.client_group+'|'+(+r.total_incl_vat_sar).toFixed(2)]=r;
        }
      });
      var supersede=[]; // old pending-transaction row ids to retire once the new rows commit
      var fresh=[],skipped=0,deletedSkipped=0;
      toRows(parsed).forEach(function(r){
        if(existing[r.invoice_no]){skipped++;return;}
        if(deletedOnly[r.invoice_no]){deletedSkipped++;return;}
        if(r.revenue_way==='invoice'&&!r.transaction_ref){
          var tw=openTx[r.client_group+'|'+(+r.total_incl_vat_sar).toFixed(2)];
          if(tw){ r.transaction_ref=tw.invoice_no; supersede.push(tw.id); }
        }
        fresh.push(r);
      });
      FIN._supersede=supersede.length?supersede:null;
      preview(fresh,skipped,supersede.length,deletedSkipped);
    }catch(e){
      document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px">'+fl('Could not read this export: ','تعذر قراءة الملف: ')+esc64(e.message)+'</div>';
    }
  }

  /* finCommit() (js/16) only inserts the new rows — it knows nothing about superseded
     transactions. Wrap it, same additive pattern this file already uses for finParse and
     renderFinance: soft-delete the matched old pending-transaction rows once the new ones
     are in, so the ledger never double-counts a transaction that has since been invoiced. */
  var _fcm=window.finCommit;
  window.finCommit=function(){
    var sup=FIN._supersede; FIN._supersede=null;
    var out=_fcm.apply(this,arguments);
    if(sup&&sup.length){
      fc().from('finance_invoices').update({deleted_at:new Date().toISOString()}).in('id',sup).select('id').then(function(r){
        if(r&&r.error){ console.warn('[v65] could not retire superseded transactions',r.error); return; }
        // M13: no error is not proof — a silent RLS refusal returns no rows. Say so, never pretend.
        var got=(r&&r.data)?r.data.length:0;
        if(got<sup.length){ console.warn('[v65] retired '+got+' of '+sup.length+' superseded transactions'); try{ if(typeof toast==='function')toast((typeof LANG!=='undefined'&&LANG==='ar')?('تم سحب '+got+' من '+sup.length+' معاملة قديمة فقط — تحقّق من الصلاحيات'):('Only '+got+' of '+sup.length+' superseded transactions were retired — check permissions')); }catch(_){} }
        FIN.rows=null; finLoad();
      });
    }
    return out;
  };

  function readXlsx(f,cb){
    function go(){ var rd=new FileReader();
      rd.onload=function(){ try{
        var wb=XLSX.read(new Uint8Array(rd.result),{type:'array'});
        var ws=wb.Sheets[wb.SheetNames[0]];
        cb(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}));
      }catch(e){ document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px">'+fl('Could not open the Excel file: ','تعذر فتح ملف الإكسل: ')+esc64(e.message)+'</div>'; } };
      rd.readAsArrayBuffer(f); }
    if(window.XLSX)return go();
    document.getElementById('finImpOut').innerHTML='<div style="font-size:13px;color:var(--muted)">'+fl('Loading the Excel reader…','جاري تحميل قارئ الإكسل…')+'</div>';
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=go;
    s.onerror=function(){document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px">'+fl('Could not load the Excel reader — save the file as CSV and drop it again.','تعذر تحميل قارئ الإكسل — احفظ الملف بصيغة CSV وأعد إفلاته.')+'</div>';};
    document.head.appendChild(s);
  }

  /* 2026-09-19 (fire #102, second half): TWO IMPORTERS WERE READING EVERY DROPPED FILE.
     js/16's rImport() attaches its own drop listener from a `setTimeout(...,0)`, which runs AFTER
     js/65's wiring has cloned and replaced the drop-zone node. Cloning strips js/65's listener from
     nothing — the new node is bare — so js/65 wires it, and then js/16's timeout finds that same new
     node, sees no `__wired` flag of its own, and adds its listener too. The node ends up carrying
     BOTH. Measured by dropping four Excel exports in one session: `finParse` was called on every
     single drop, alongside js/65's router, and the preview a person reads is simply whichever of the
     two finished last — js/65 on the first file (this path has to fetch SheetJS from a CDN before it
     can read an xlsx at all) and THIS path on every file after it.
     They do not agree. js/65 refuses an invoice the owner deleted and says why, holds back a row
     whose date it cannot read so the rest of the file still lands, and dedupes numbers inside one
     file. This path does none of that, and the "Confirm import" button under its preview is a
     different commit path from js/65's. So the guards that protect the ledger were there or not
     depending on how many files you had dropped before this one.
     When the router owns the panel it owns the file too: stand down. This wrapper stays for the day
     the router is not wired — that is what a fallback is for — and `__v41_stoodDown` lets a probe
     see which of the two answered without guessing from the wording. */
  function v65OwnsPanel(){
    try{
      var dz=document.getElementById('finDrop'), inp=document.getElementById('finFile');
      return !!(dz&&dz.__v65&&inp&&typeof inp.onchange==='function'&&typeof window.v65CheckFiles==='function');
    }catch(_){ return false; }
  }
  // wrap finParse: Direct Payments files take the new path; the legacy CSV keeps the old one
  var _fp=window.finParse;
  window.finParse=function(){
    if(v65OwnsPanel()){ window.__v41_stoodDown=(window.__v41_stoodDown||0)+1; return; }
    try{
      var f=document.getElementById('finFile').files[0];
      if(f&&/\.xlsx?$/i.test(f.name)){ readXlsx(f,function(rows2d){ if(rows2d&&rows2d.length&&isDPHeader(rows2d[0]))runDP(rows2d); else document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px">'+fl('This Excel file is not a Direct Payments invoice export.','هذا الملف ليس تصدير فواتير من Direct Payments.')+'</div>'; }); return; }
      if(f){ var rd=new FileReader();
        rd.onload=function(){ var rows2d=csvParse64(String(rd.result));
          if(rows2d.length&&isDPHeader(rows2d[0]))runDP(rows2d); else _fp.apply(this,arguments); };
        rd.readAsText(f); return; }
    }catch(e){ console.warn('[v65] parse',e); }
    return _fp.apply(this,arguments);
  };

  // widen the Import screen text + file filter to mention Excel
  var _ri=window.renderFinance;
  window.renderFinance=function(){
    _ri.apply(this,arguments);
    try{
      if(!window.FIN||FIN.tab!=='import')return;
      var inp=document.getElementById('finFile'); if(inp)inp.setAttribute('accept','.csv,.xlsx,.xls');
      var dz=document.getElementById('finDrop');
      if(dz&&!dz.__v64){ dz.__v64=1; dz.innerHTML='⬇ '+fl('Drop the Direct Payments invoice export here (Excel or CSV) — or the simple CSV format below','أفلت هنا تصدير فواتير Direct Payments (إكسل أو CSV) — أو ملف CSV البسيط أدناه'); }
      // 2026-08-25: dropped the green "New: this screen now reads Direct Payments' own
      // Invoice Export file directly" banner — it announced a feature that stopped being
      // new weeks ago and just sat there permanently once injected (density/copy pass,
      // owner-directed). No functional change: js/65's own dropzone text (wired on mount,
      // M12) already carries the up-to-date instructions.
    }catch(e){}
  };

  // fold away the old MANUAL mirror path (reversible: pages still exist, just unlisted)
  var _rr=window.render;
  window.render=function(){var out=_rr.apply(this,arguments);try{
    // 1) Today quick-create: "New invoice" now opens the importer
    document.querySelectorAll('.v19-qc').forEach(function(qc){
      var lab=qc.querySelector('.lab'); if(!lab)return;
      if(/^New invoice$|^فاتورة جديدة$/.test(lab.textContent.trim())&&!qc.__v64){
        qc.__v64=1;
        lab.textContent=fl('Import invoices','استيراد الفواتير');
        var sub=qc.querySelector('.sub'); if(sub)sub.textContent=fl('Drop the Direct Payments export','أفلت ملف تصدير Direct Payments');
        qc.onclick=function(){ current='finance'; if(window.FIN)FIN.tab='import'; render(); };
      }
    });
    // 2) hide the "From Direct (read-only)" nav group — replaced by the importer + ledger
    var nav=document.getElementById('nav');
    if(nav){ nav.querySelectorAll('.v25-more-tog').forEach(function(tg){
      if(/From Direct|من نظام Direct/.test(tg.textContent)){ tg.style.display='none'; var w=tg.nextElementSibling; if(w)w.style.display='none'; }
    });
    if(!nav.__v64scan){ [...nav.children].forEach(function(el){
      if(el.tagName&&/From Direct|من نظام Direct/.test(el.textContent||'')&&el.querySelectorAll('button').length<=1&&el.textContent.length<60){ el.style.display='none'; var w=el.nextElementSibling; if(w&&w.querySelector&&w.querySelector('button'))w.style.display='none'; }
    }); } }
  }catch(_){ }
  return out;};

  // Exposed 2026-08-21 so js/65 (the universal importer, Spec 9) can reuse the real,
  // already-proven Invoice Export parsing instead of duplicating it — signature ROUTING and
  // the five-count preview live in js/65; the row-level parsing rules (twin pairing, wallet/
  // verification/client exclusions, the fee-pair math) stay here, unchanged.
  window.__v65_isDPHeader=isDPHeader; window.__v65_parseDP=parseDP; window.__v65_toRowsDP=toRows;
  /* 2026-09-19 (fire #102): the preview itself is now reachable for a driven test, the same way
     parseDP and toRows already are. Without it the only way in is a real dropped File, and the
     deleted-number path — the one this round fixed — could not be driven at all. */
  window.__v41_runDP=runDP;
  window.__v65_csvParse=csvParse64; window.__v65_readXlsx=readXlsx;
  window.__v65_exclusionCounts=function(){ return {wallet:_walletSkipped,verif:_verifSkipped,clientExcluded:_clientExcluded,clientExcludedDetail:_clientExcludedDetail}; };

  console.info('%c[v65] Direct Payments importer loaded','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[v65] init',e);}})();

/* ---------- part 2 — auto-link finance to clients (was js/42-v66) ---------- */
/* v66 — AUTOMATIC finance ↔ client linking (owner order 2026-08-13: "nothing manual").
   Whenever the finance ledger is loaded, every invoice group that is not linked to a
   client yet is matched against the businesses list by normalised name (Arabic + English,
   company words stripped). Exact matches are linked automatically and saved to
   finance_client_links with confirmed_by='auto-match'. Groups whose rows are all B2C
   individuals are auto-marked "Individuals / not a client". No employee ever has to open
   a mapping screen — the old manual button is hidden (the modal still exists as a
   fallback for true edge cases, reachable from the unlinked warning).
   Safety: only exact normalised name matches are linked — near-misses stay unlinked and
   visible, per the no-cross-company-merging rule. Additive layer, reversible. */
(function(){try{
  var attempted={};   // group → true, so we never hammer the API for the same group twice a session
  var busy=false;

  function norm(s){
    s=String(s==null?'':s); try{ s=s.normalize('NFKC'); }catch(_){}   // presentation forms (ﻻ, ﺷ…) → base letters
    s=s.toLowerCase();
    // unify Arabic letter variants, strip diacritics/tatweel
    s=s.replace(/[أإآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ً-ْـ]/g,'');
    // drop punctuation
    s=s.replace(/[&.,'’`"()\/\\\-_+·|]/g,' ');
    // drop generic company words (EN + AR)
    var stop=['company','co','ltd','llc','inc','corp','corporation','group','holding','est','establishment','trading','for','the','and','of',
              'شركه','شركة','مؤسسه','مؤسسة','مجموعه','مجموعة','قابضه','قابضة','التجاريه','التجارية','المحدوده','المحدودة','وشركاه','وأولاده','واولاده'];
    var toks=s.split(/\s+/).filter(function(t){return t&&stop.indexOf(t)<0;});
    return toks.join(' ').trim();
  }

  function bizIndex(){
    var ix={};
    (((typeof DB!=='undefined')&&DB.businesses)||[]).forEach(function(b){
      [b.name,b.nameAr].forEach(function(n){
        var k=norm(n); if(k&&k.length>=4&&!ix[k])ix[k]=b;
      });
    });
    return ix;
  }

  function canEdit(){ try{ return window.canFinEdit?canFinEdit():false; }catch(_){ return false; } }
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }

  function pass(){
    if(busy||!canEdit())return;
    var FIN=window.FIN; if(!FIN||!FIN.rows)return;
    /* 2026-09-15 (fire #58, live): js/16 sets FIN.rows FIRST and fetches finance_client_links
       AFTERWARDS, while this pass runs 400 ms after every render. In that gap the link map is empty,
       so every name-matchable group looked unlinked and was upserted again — 13 links rewritten on
       every visit to Finance by any editor (confirmed_at/updated_at bumped to "now", and a human's
       later correction of a link would be silently undone by the name match). FIN.links only exists
       once the links have actually loaded (js/16 finGot), so wait for it. */
    if(!Array.isArray(FIN.links))return;
    if(!((typeof DB!=='undefined')&&DB.businesses&&DB.businesses.length))return;
    var linkBy=FIN.linkByGroup||{};
    // collect candidate groups: not linked, not already attempted
    var groups={};
    /* 2026-09-02 (attack round 11): read through js/16's chokepoint so an EXCLUDED partner's
       group is never auto-linked to a company by name. */
    var _src=(typeof window.finLive==='function')?window.finLive():(FIN.rows||[]);
    (_src||[]).forEach(function(r){
      if(r.deleted_at)return; var g=r.client_group; if(!g)return;
      var l=linkBy[g];
      if(l&&(l.business_id||l.is_client===false))return;   // already linked
      if(attempted[g])return;
      (groups[g]=groups[g]||{b2b:0,b2c:0});
      if(r.record_type==='b2c')groups[g].b2c++; else groups[g].b2b++;
    });
    var names=Object.keys(groups); if(!names.length)return;
    var ix=bizIndex(), todo=[];
    names.forEach(function(g){
      attempted[g]=true;
      var info=groups[g];
      if(info.b2c>0&&info.b2b===0){ todo.push({g:g,indiv:true}); return; }   // pure individuals
      // M14 (owner, 2026-08-25): the client-name alias map must be consulted on the IMPORT/
      // linking path too, beside the exclusion check — not only at display time. If this
      // spelling is a registered alias and a sibling spelling is already linked, it is the
      // same company: link it to the same business instead of leaving it "needs linking".
      // Found in the 2026-08-29 sweep: display merged the spellings, but the link (which
      // finSectorOf() reads by RAW client_group) did not follow, so a fresh alias spelling
      // could sit unlinked and mis-sectored until a human noticed.
      // M18 (same day): the declared sibling WINS over a name match. The MDD split happened
      // exactly because the Arabic spelling name-matched a second, duplicate company record
      // while the owner had already declared it the same company as "MDD" — a name index can
      // only say "a record with this name exists", the alias map says "this IS that company".
      try{
        var e=(typeof window.finGroupCheck==='function')?window.finGroupCheck(g):null;
        if(e){
          var sib=(e.aliases||[]).map(function(a){return linkBy[a];}).filter(function(l){return l&&l.business_id;})[0];
          if(sib){ todo.push({g:g,bizId:sib.business_id,viaAlias:true}); return; }
        }
      }catch(_){}
      var b=ix[norm(g)];
      if(b){ todo.push({g:g,biz:b}); return; }
      // no match → stays unlinked and visible; a human decides (edge case only)
    });
    if(!todo.length)return;
    var c=client(); if(!c)return;
    busy=true;
    var i=0,linked=0;
    (function next(){
      if(i>=todo.length){
        busy=false;
        if(linked){
          try{ if(window.clearFinCanon)clearFinCanon(); }catch(_){}
          try{ if(typeof toast==='function')toast((typeof LANG!=='undefined'&&LANG==='ar')?('تم ربط '+linked+' مجموعة فواتير بعملائها تلقائيًا'):(linked+' invoice group'+(linked>1?'s':'')+' linked to clients automatically')); }catch(_){}
          try{ if(typeof current!=='undefined'&&current==='finance'&&typeof render==='function')render(); }catch(_){}
        }
        return;
      }
      var t=todo[i++]; var now=new Date().toISOString();
      var payload={client_group:t.g,updated_at:now,confirmed_by:'auto-match',confirmed_at:now};
      if(t.indiv){ payload.business_id=null; payload.is_client=false; }
      else if(t.viaAlias){ payload.business_id=t.bizId; payload.is_client=true; payload.confirmed_by='auto-match-alias'; }
      else { payload.business_id=(window.__bizUuid?__bizUuid(t.biz.id):t.biz.id); payload.is_client=true; }
      c.from('finance_client_links').upsert(payload,{onConflict:'client_group'}).select('client_group').then(function(r){
        // M13: a write with no error but no row back was refused silently — do not count it as linked
        if(!r||(!r.error&&r.data&&r.data.length)){
          linked++;
          FIN.linkByGroup=FIN.linkByGroup||{}; FIN.linkByGroup[t.g]=payload;
          FIN.links=(FIN.links||[]).filter(function(l){return l.client_group!==t.g;}).concat([payload]);
          if(payload.business_id){ FIN.groupsByBiz=FIN.groupsByBiz||{}; (FIN.groupsByBiz[payload.business_id]=FIN.groupsByBiz[payload.business_id]||[]).push(t.g); }
        }
        next();
      });
    })();
  }

  // hide the old manual button — linking is automatic now (modal stays as a fallback)
  function hideManualBtn(){ try{ var b=document.getElementById('v53btn'); if(b)b.style.display='none'; }catch(_){} }

  try{
    var _r=window.render;
    window.render=function(){
      var out=_r.apply(this,arguments);
      try{ [250,900,1700].forEach(function(d){setTimeout(hideManualBtn,d);}); setTimeout(pass,400); }catch(_){}
      return out;
    };
  }catch(_){}
  // also run shortly after load and on a slow heartbeat (catches imports finishing off-screen)
  [1200,4000].forEach(function(d){setTimeout(function(){hideManualBtn();pass();},d);});
  setInterval(function(){hideManualBtn();pass();},15000);

  console.info('%c[v66] automatic finance↔client linking loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v66] init',e);}})();
