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
  function money64(x){ if(typeof x==='number')return x; return parseFloat(String(x==null?'':x).replace(/[^\d.\-]/g,''))||0; }
  function m0(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
  function isoDate(s){ // "18/06/2026 03:35:42 PM" or "2026-06-18..." → "2026-06-18"
    s=String(s||'').trim(); var m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(m)return m[3]+'-'+m[2]+'-'+m[1];
    m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m?m[0]:null;
  }
  var SVC64={'Direct Flights':'Flights','Direct Hotels':'Hotels','Direct Visa':'Visas',
    'Direct Course':'Study abroad','Direct Support':'Support services',
    'Techtic Support':'Verification services','Direct Packages':'Packages','Direct Wallet':'Wallet top-up'};

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

  var _walletSkipped=0;
  function parseDP(rows){
    _walletSkipped=0;
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
      var cost=0,taxTot=0,disc=0,svcs={},comm=false,wallet=false;
      inv.items.forEach(function(it){
        if(it.taxable)taxTot+=it.total; else cost+=it.total;
        disc+=it.discount||0;
        if(it.product)svcs[SVC64[it.product]||it.product]=1;
        if(/Commission/i.test(it.name))comm=true;
        if(/Wallet Balance/i.test(it.name)||it.product==='Direct Wallet')wallet=true;
      });
      var profit=Math.round(taxTot/1.15*100)/100, vat=Math.round((taxTot-profit)*100)/100;
      if(wallet){_walletSkipped++;return;} // owner rule 2026-08-12: wallet top-ups are NOT imported at all
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
      var rev = i.wallet?0 : Math.round((i.total-i.vat)*100)/100;
      return {
        invoice_no:i.ref, zatca_dpin:i.num, client_group:i.cust, customer_raw_name:i.cust,
        invoice_date:i.date, month:i.date?i.date.slice(0,7):null,
        quarter:i.date?(i.date.slice(0,4)+'-Q'+(Math.floor((+i.date.slice(5,7)-1)/3)+1)):null,
        products:i.svc, service_type:i.svc, record_type:'b2b',
        total_incl_vat_sar:i.total, wallet_portion_sar:i.wallet?i.total:0, revenue_sar:rev,
        cost_sar:i.cost, profit_sar:i.profit, vat_sar:i.vat, discount_sar:i.disc,
        amount_received_sar:(i.st==='paid'?i.total:0),
        amount_remaining_sar:(i.st==='paid'||i.st==='credit')?0:i.total,
        integrity_status:integ,
        exclusion_reason:i.wallet?'wallet top-up — excluded from revenue by definition':null,
        notes:i.st==='draft'?'Draft in Direct Payments':null,
        source_batch:'dp-import-'+new Date().toISOString().slice(0,10),
        line_no:1, branch:i.branch, salesman:i.salesman,
        revenue_way:(i.comm?'commission':(!i.num&&i.st!=='credit'&&!i.wallet)?'transaction':'invoice'),
        transaction_ref:i.tx||null
      };
    });
  }

  function preview(rows,skipped){
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
      (skipped?('<br>↩ '+fl('Skipped (already in the ledger):','تم تجاوزها (موجودة مسبقًا):')+' <b>'+skipped+'</b>'):'')+
      '</div>'+
      (rows.length?('<button class="btn pri sm" style="margin-top:8px" onclick="finCommit()">'+fl('Confirm import of '+rows.length+' rows','تأكيد استيراد '+rows.length+' صف')+'</button>'):'');
    document.getElementById('finImpOut').innerHTML=h;
    FIN._pending=rows.length?rows:null;
  }

  function runDP(rows2d){
    try{
      var parsed=parseDP(rows2d);
      var existing={}; ((window.FIN&&FIN.rows)||[]).forEach(function(r){existing[r.invoice_no]=1;});
      var fresh=[],skipped=0;
      toRows(parsed).forEach(function(r){ if(existing[r.invoice_no])skipped++; else fresh.push(r); });
      preview(fresh,skipped);
    }catch(e){
      document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px">'+fl('Could not read this export: ','تعذر قراءة الملف: ')+esc64(e.message)+'</div>';
    }
  }

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

  // wrap finParse: Direct Payments files take the new path; the legacy CSV keeps the old one
  var _fp=window.finParse;
  window.finParse=function(){
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
      var card=dz&&dz.closest('.card');
      if(card&&!card.__v64){ card.__v64=1;
        var note=document.createElement('div');
        note.style.cssText='background:#EFF8F2;border:1px solid #CDEBD8;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#0F6E56;margin-bottom:12px';
        note.innerHTML='<b>'+fl('New:','جديد:')+'</b> '+fl('this screen now reads Direct Payments’ own "Invoice Export" file directly — invoices, transactions, commissions and wallet rows are recognised automatically. No manual typing.','هذه الشاشة تقرأ الآن ملف "تصدير الفواتير" من Direct Payments مباشرة — تتعرف تلقائيًا على الفواتير والمعاملات والعمولات وتعبئة المحفظة. بلا إدخال يدوي.');
        card.insertBefore(note,card.children[1]);
      }
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

  console.info('%c[v65] Direct Payments importer loaded','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[v65] init',e);}})();
