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
  /* 2026-09-19 (fire #103): this is the date reader for BOTH import paths — js/65's router parses a
     Direct Payments export through js/41's parseDP/toRows — and it took exactly two shapes,
     dd/mm/yyyy and yyyy-mm-dd, with no check that the day it read exists. Driven against the live
     parser, every one of these is a date a real export can carry:
         03/14/2026  ->  "2026-14-03"   MONTH 14. Not a rejection — a date-shaped string that goes
                                        to a real DATE column, which Postgres refuses; and because
                                        one batch is one statement, that single row loses the WHOLE
                                        file. The app's own maths reads month 14 as no month and
                                        quarter "Q5" on the way past.
         31/02/2026  ->  "2026-02-31"   same shape: February has no 31st.
         29/02/2026  ->  "2026-02-29"   same: 2026 is not a leap year.
         3/14/2026 · 14-03-2026 · 2026/03/14 · 14-Mar-2026 · 14 Mar 2026 · ١٤/٠٣/٢٠٢٦  ->  null,
                                        so the row is held back for having "no readable invoice
                                        date" and a perfectly good file imports nothing. An Excel
                                        export carries a real date CELL whose written form is
                                        whatever number format was saved in it — it changes when the
                                        file is re-saved, or opened on a machine set to another
                                        region — so this is not a hypothetical spelling.
     js/65 hardened its own reader for exactly this on 2026-09-03 and publishes it. This one now
     defers to it, the same way money64 already defers to its money reader, so the two paths can
     never read one cell two ways — with month-name spellings handled first, since those are what a
     spreadsheet produces and js/65's reader does not take them. dd/mm stays the preferred reading,
     which is what Direct Payments writes; a month above 12 is the only thing that flips it. The
     fallback below is for a page without js/65, and it now checks the calendar too, so no path can
     hand the database a day that does not exist. */
  var AR_DIG64={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  var MON64={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  function calDate64(y,mo,d){
    if(!(y>=1900&&y<=2999&&mo>=1&&mo<=12&&d>=1&&d<=31))return null;
    var t=new Date(Date.UTC(y,mo-1,d));
    if(t.getUTCFullYear()!==y||t.getUTCMonth()!==mo-1||t.getUTCDate()!==d)return null;
    return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  function isoDate(s){ // "18/06/2026 03:35:42 PM", "2026-06-18…", "14-Mar-2026" → "2026-06-18"
    s=String(s==null?'':s).replace(/[٠-٩۰-۹]/g,function(c){return AR_DIG64[c]||c;}).trim();
    if(!s)return null;
    var m=s.match(/^(\d{1,2})[-\/. ]([A-Za-zء-ي]{3,})[-\/. ,]*(\d{4})/);   // 14-Mar-2026
    if(m&&MON64[m[2].slice(0,3).toLowerCase()])return calDate64(+m[3],MON64[m[2].slice(0,3).toLowerCase()],+m[1]);
    m=s.match(/^([A-Za-z]{3,})[-\/. ](\d{1,2})[-\/. ,]+(\d{4})/);                    // Mar 14, 2026
    if(m&&MON64[m[1].slice(0,3).toLowerCase()])return calDate64(+m[3],MON64[m[1].slice(0,3).toLowerCase()],+m[2]);
    try{ if(typeof window.__v65IsoDateG==='function'){ var g=window.__v65IsoDateG(s); if(g)return g; } }catch(_){}
    m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if(m)return calDate64(+m[1],+m[2],+m[3]);
    m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
    if(m){ var d64=+m[1],mo64=+m[2]; if(mo64>12&&d64<=12){var t64=mo64;mo64=d64;d64=t64;} return calDate64(+m[3],mo64,d64); }
    return null;
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

  /* D1 (2026-09-28, DECISIONS D21) — the Payments invoice export, read as it is. What changed from the reader before it:
       · a wallet TOP-UP is stored, never counted (it used to be skipped outright): a top-up-only invoice is its own row
         kind; a "Wallet Balance" line inside a real sale (change put back into the wallet) is split off as the wallet part,
         and the sale keeps its service lines. A sale PAID from the wallet is a full sale — the wallet shows only as a
         payment receipt, never as a line, so nothing is taken off it;
       · COST IS NOT READ FROM THE ITEM LINES any more (it used to be the sum of the untaxed lines — the "pass-through =
         cost" the owner ruled out on 22 Aug). Cost is approved expenses only; until they arrive it is empty. The lines
         themselves are kept (finance_invoice_lines) and the pass-through amount on them is shown beside the cost;
       · no VAT figure is worked out or stored (D18), and profit is the database's (revenue − cost, empty when cost is);
       · every Payments status is kept as written, with when it last changed; "Fully Paid (Audit Required)" counts and is
         flagged; Pending Payment, Void, Draft and Cancelled are stored and never count;
       · the date that sets the month is the paid date for a paid invoice, else the date it was created (both kept). */
  var _walletSkipped=0,_verifSkipped=0,_clientExcluded=0,_clientExcludedDetail=[],_topups=0,_unknownStatus=[];
  var STATUS64=[   // Payments' own words → what the app stores; anything else stops that row for a person (never guessed)
    [/^fully paid\s*\(audit required\)$/i, {st:'paid',audit:true}],
    [/^fully paid$/i, {st:'paid'}], [/^paid$/i, {st:'paid'}],
    [/^pending( payment)?$/i, {st:'pending'}], [/^partially paid$/i, {st:'pending'}],
    [/^draft$/i, {st:'draft'}], [/^void(ed)?$/i, {st:'void'}], [/^cancel+ed$/i, {st:'cancelled'}]];
  function status64(raw){ var t=String(raw||'').trim(); for(var k=0;k<STATUS64.length;k++){ if(STATUS64[k][0].test(t)) return STATUS64[k][1]; } return null; }
  function stamp64(s){ // "18/06/2026 03:35:42 PM" → an ISO time (Riyadh, where Payments writes it); a plain date → noon Riyadh
    var d=isoDate(s); if(!d) return null;
    var m=String(s||'').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i); var hh=12, mm=0, ss=0;
    if(m){ hh=+m[1]; mm=+m[2]; ss=+(m[3]||0); if(m[4]){ var pm=/p/i.test(m[4]); if(pm&&hh<12)hh+=12; if(!pm&&hh===12)hh=0; } }
    return d+'T'+String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0')+'+03:00';
  }
  function isWalletLine(it){ return it.product==='Direct Wallet'||/Wallet Balance|رصيد المحفظة/i.test(it.name||''); }
  function parseDP(rows){
    _walletSkipped=0;_verifSkipped=0;_clientExcluded=0;_clientExcludedDetail=[];_topups=0;_unknownStatus=[];
    var hdr=rows[0].map(function(x){return String(x||'').trim();});
    function ix(n){ var list=[].concat(n); for(var k=0;k<list.length;k++){ var at=hdr.indexOf(list[k]); if(at>=0) return at; } return -1; }
    function cell(row,i){ return i>=0?String(row[i]==null?'':row[i]).trim():''; }
    var iType=ix('Type'),iProd=ix('Product'),iCust=ix('Customer Name'),iRef=ix('Invoice Reference #'),
        iNum=ix('Invoice Number'),iCreate=ix('Invoice Create Date'),iGen=ix('Invoice Generate Date'),iPaid=ix('Last Payment Date'),
        iStatus=ix('Invoice Status'),iStatusAt=ix('Last Status At'),iEmail=ix(['Customer Email','Email']),
        iName=ix('Name'),iTax=ix('Item Is Taxable'),iDisc=ix('Item Discount'),iItemTot=ix('Item Total'),
        iQty=ix(['Qty','Quantity','Item Quantity']),iUnit=ix(['Unit Price','Item Unit Price','Item Price']),
        iTot=ix('Invoice Total'),iBranch=ix('Sale Branch'),iSales=ix('Salesman');
    var invs={},order=[];
    for(var r=1;r<rows.length;r++){
      var row=rows[r]; if(!row||!row.length)continue;
      var t=cell(row,iType), ref=cell(row,iRef);
      if(!ref)continue;
      if(t==='invoice'||t==='credit_note'){
        if(!invs[ref]){order.push(ref);}
        invs[ref]={ref:ref,num:cell(row,iNum)||null,created:isoDate(row[iCreate]),generated:isoDate(row[iGen]),paid:isoDate(row[iPaid]),
          status:cell(row,iStatus),statusAt:stamp64(row[iStatusAt]),cust:cell(row,iCust),email:(cell(row,iEmail)||'').toLowerCase()||null,
          credit:(t==='credit_note'),total:money64(row[iTot]),
          branch:cell(row,iBranch)||null,salesman:cell(row,iSales)||null,items:[]};
      } else if(t==='item'&&invs[ref]){
        invs[ref].items.push({name:cell(row,iName),taxable:cell(row,iTax)==='Yes',
          discount:money64(row[iDisc]),total:money64(row[iItemTot]),product:cell(row,iProd),
          qty:iQty>=0?money64(row[iQty]):null,unit:iUnit>=0?money64(row[iUnit]):null});
      }
    }
    var out=[];
    order.forEach(function(ref){
      var inv=invs[ref];
      var disc=0,svcs={},comm=false,verif=false,walletPart=0,serviceItems=0;
      inv.items.forEach(function(it){
        disc+=it.discount||0;
        if(isWalletLine(it)){ walletPart+=it.total; return; }
        serviceItems++;
        if(it.product)svcs[SVC64[it.product]||it.product]=1;
        if(/Commission/i.test(it.name))comm=true;
        if(it.product==='Techtic Support'||/Verification/i.test(it.name)||/Verification/i.test(it.product||''))verif=true;
      });
      if(verif){_verifSkipped++;return;}   // owner rule 2026-08-13: verification services are accounted for elsewhere — never imported here
      var topup=!inv.credit&&walletPart>0&&(serviceItems===0||walletPart>=inv.total-0.01);
      if(topup)_topups++;
      var s=inv.credit?{st:'credit'}:status64(inv.status);
      if(!s){ _unknownStatus.push({ref:ref,status:inv.status}); return; }   // a status nobody has named: held back for a person
      var xhit=(typeof window.finExclusionCheck==='function')?window.finExclusionCheck(inv.cust):null;
      if(xhit){ _clientExcluded++; _clientExcludedDetail.push({name:inv.cust,clientId:xhit.clientId,reason:xhit.reason}); }
      var svc=topup?'Wallet top-up':(Object.keys(svcs).sort().join(' + ')||'Other');
      out.push({ref:ref,num:inv.num,created:inv.created,generated:inv.generated,paid:inv.paid,status:inv.status,statusAt:inv.statusAt,
        cust:inv.cust,email:inv.email,total:inv.total,walletPart:topup?inv.total:Math.round(walletPart*100)/100,topup:topup,
        disc:Math.round(disc*100)/100,svc:svc,st:s.st,audit:!!s.audit,comm:comm,
        branch:inv.branch,salesman:inv.salesman,items:inv.items});
    });
    // twin pairing (the OLD system): a numbered + an unnumbered row for the same customer and total → the unnumbered one is
    // the transaction the numbered invoice was issued for; one money row, the transaction number kept on it
    var byKey={};
    out.forEach(function(i){ if(i.topup) return; var k=i.cust+'|'+i.total.toFixed(2);(byKey[k]=byKey[k]||[]).push(i);});
    var drop={};
    Object.keys(byKey).forEach(function(k){
      var g=byKey[k],nums=g.filter(function(i){return i.num;}),plain=g.filter(function(i){return !i.num;});
      nums.forEach(function(n){ if(plain.length&&!n.tx){var tw=plain.shift();n.tx=tw.ref;drop[tw.ref]=1;} });
    });
    return out.filter(function(i){return !drop[i.ref];});
  }

  function toRows(parsed){
    var batch='dp-import-'+todayISO();
    return parsed.map(function(i){
      var paid=i.st==='paid';
      var integ = paid?'verified_paid' : i.st==='credit'?'credit_note' : 'pending';
      // the date that sets the month: paid date for a paid invoice (else its creation date) — D21
      var periodDate=(paid&&i.paid)?i.paid:(i.created||i.paid||i.generated);
      var row={
        invoice_no:i.ref, zatca_dpin:i.num, client_group:i.cust, customer_raw_name:i.cust,
        invoice_date:periodDate, invoice_created_on:i.created, paid_at:paid?(i.paid||null):null, tax_invoice_date:i.generated,
        products:i.svc, service_type:i.svc, record_type:'b2b',
        row_kind:i.topup?'wallet_topup':i.st==='credit'?'credit_note':'sale',
        total_incl_vat_sar:i.total, wallet_portion_sar:i.walletPart,
        cost_sar:null,                                   // approved expenses only (D2) — never the item lines
        discount_sar:i.disc,
        amount_received_sar:(paid?i.total:0),
        amount_remaining_sar:(paid||i.st==='credit')?0:i.total,
        integrity_status:integ, payments_status:i.status||null, payments_status_at:i.statusAt, audit_required:!!i.audit,
        customer_email:i.email,
        exclusion_reason:null,
        notes:i.st==='draft'?'Draft in Direct Payments':null,
        source_batch:batch, source:'import',
        line_no:1, branch:i.branch, salesman:i.salesman,
        revenue_way:(i.comm?'commission':(!i.num&&i.st!=='credit'&&!i.topup)?'transaction':'invoice'),
        transaction_ref:i.tx||null
      };
      // the item lines, replaced per invoice on the commit (import rule 4)
      row._lines=(i.items||[]).map(function(it,k){ return {invoice_no:i.ref,line_no:k+1,kind:'item',product:it.product||null,name:it.name||null,
        qty:it.qty,unit_price:it.unit,discount_sar:it.discount||0,taxable:!!it.taxable,item_total_sar:it.total,source_batch:batch}; });
      return row;
    });
  }

  function preview(rows,skipped,supCount,deletedSkipped){
    var paid=0,pend=0,cred=0,comm=0,tx=0,tot=0,wal=0;   // D1: top-ups are stored now — counted in the summary below, never as revenue
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
      (_clientExcluded?('<br>🚫 '+fl('Left out by a rule (imported, not counted):','تستبعدها قاعدة (تُستورد ولا تُحتسب):')+' <b>'+_clientExcluded+'</b> — '+esc64(_clientExcludedDetail.map(function(d){return d.name+' (#'+d.clientId+(d.reason?(': '+d.reason):'')+')';}).join('; '))):'')+
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
      var fresh=[],skipped=0,deletedSkipped=0;
      toRows(parsed).forEach(function(r){
        if(existing[r.invoice_no]){skipped++;return;}
        if(deletedOnly[r.invoice_no]){deletedSkipped++;return;}
        /* D1 (2026-09-28): an invoice no longer retires a pending transaction by itself. The transaction is the money row and
           stays (its cost is recorded on it); linking an invoice to the transactions it bills is proposed in the import
           preview (js/65) and a PERSON confirms it — never done here. */
        fresh.push(r);
      });
      preview(fresh,skipped,0,deletedSkipped);
    }catch(e){
      document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px">'+fl('Could not read this export: ','تعذر قراءة الملف: ')+esc64(e.message)+'</div>';
    }
  }

  /* D1 (2026-09-28): the wrapper that soft-deleted "superseded" pending transactions after a commit is gone with the step
     that chose them (above) — the oversight's order: no import retires a transaction by itself. */

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
  window.__v65_exclusionCounts=function(){ return {wallet:_walletSkipped,verif:_verifSkipped,clientExcluded:_clientExcluded,clientExcludedDetail:_clientExcludedDetail,topups:_topups,unknownStatus:_unknownStatus.slice()}; };

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
    /* E (2026-09-27): retired. This linked invoice groups to companies BY NAME, automatically — the owner's rules of 27 Sep
       say nothing merges unless a person types it (Finance → Rules), and no code creates records. Kept, switched off. */
    return;
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
