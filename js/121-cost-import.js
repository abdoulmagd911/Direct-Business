/* js/121-cost-import.js — the raw Direct Payments cost exports, read in the browser (second builder, 28 Sep 2026; D25).

   Live Finance could not read the Payments cost files ("not recognized"), so every invoice showed "waiting for cost".
   This layer reads the three raw exports exactly as Payments downloads them (Excel or CSV) and writes cost through ONE
   database function, public.fn_cost_import (scripts/sql/cost-import.sql):
     · Transaction Expense Export (Invoice#, Amount (SAR), Expense Type, Status, Created At, …) — the cost: the sum of the
       APPROVED lines of each reference; Pending / Under Review / Cancelled / Rejected never count;
     · Expense Invoice Export (Invoice # / Ref #, Expense Assignments, Overdue, …) — the status summary and overdue flag;
     · Revenue Report (Invoice # / Ref #, Total Expense Amount, …) — only the submitted expenses, kept as the cost
       FALLBACK (scripts/sql/cost-fallback.sql); its revenue and VAT columns are never read (M1; they overstate profit).
   The owner's rules (Drive 04 §5): key = the Payments reference = the money row's invoice_no; any file, any order, any
   time, partial or overlapping periods; a newer file (its Payments export time, read from the file name) wins, an older
   one only fills blanks, a blank never wipes; the same file twice changes nothing; a reference with no money row is HELD
   and listed — never stored, never turned into an invoice row. Big files (the full export is ~258k rows / 23 MB) are
   read in chunks — a CSV in 1 MB slices, an Excel file in a background worker — so the tab never freezes.

   How files reach it: js/65's processFileList hands every dropped file here first (window.v121Route); this layer peeks
   at each header, keeps the three kinds above and gives every other file straight back to js/65, unchanged. Its own
   block sits above js/65's preview in the Import card (#v121Out), repainted after every render like js/65's.
   Customer names, emails, phones and card numbers in these files are never sent or stored. Guards: scripts/qa/
   probe-cost-import.mjs (the browser, with sabotage) and phase3 COST-01…11 (the database). */
(function(){try{
  var fl=function(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var I=function(n){ return Number(n||0).toLocaleString('en-US'); };
  var M=function(n){ return Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var client=function(){ try{ return window.fc?fc():null; }catch(_){ return null; } };
  var canWrite=function(){ try{ if(window.__isShareView) return false;
    if(typeof window.mayEditPage==='function') return window.mayEditPage('finance')===true;
    return typeof window.finCanWrite==='function'&&!!window.finCanWrite(); }catch(_){ return false; } };

  /* ---------------- the three kinds, by their own headers ---------------- */
  function hk(s){ return String(s==null?'':s).replace(/^﻿/,'').toLowerCase().replace(/[\s_\-\.:()\/]+/g,''); }
  var KINDS={
    tx:{ need:['invoice#','amountsar','expensetype','status','createdat'], en:'Transaction Expense Export', ar:'تصدير مصروفات المعاملات' },
    ei:{ need:['invoice#ref#','invoiceamount','invoicestatus','expenseassignments'], en:'Expense Invoice Export', ar:'تصدير فواتير المصروفات' },
    rr:{ need:['invoice#ref#','totalexpenseamount'], en:'Revenue Report', ar:'تقرير الإيرادات' }
  };
  function kindOf(header){ var h=(header||[]).map(hk);
    for(var k in KINDS){ if(KINDS[k].need.every(function(n){ return h.indexOf(n)>=0; })) return k; } return null; }

  /* ---------------- values, exactly as Payments writes them ---------------- */
  var AD={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  function digits(s){ return String(s).replace(/[٠-٩۰-۹]/g,function(c){ return AD[c]||c; }); }
  /* "2,944.00 SAR", "18.40", 3191.19174 (an Excel number), "" → null; anything else unreadable → NaN */
  function money(v){ if(v==null) return null; if(typeof v==='number') return isFinite(v)?v:NaN;
    var s=digits(v).replace(/SAR|ر\.س|ريال/gi,'').replace(/[\s,٬ ]/g,'').trim(); if(!s) return null;
    var neg=/^\(.*\)$/.test(s); s=s.replace(/[()]/g,''); if(!/^-?\d*\.?\d+$/.test(s)) return NaN;
    var n=Number(s); return neg?-Math.abs(n):n; }
  /* the reference: 1163745676 as text or as an Excel number (never 1.16e9) */
  function ref(v){ if(v==null) return ''; if(typeof v==='number') return isFinite(v)?String(Math.round(v)):'';
    var s=digits(v).trim().replace(/^'+/,''); if(/^\d+\.0+$/.test(s)) s=s.replace(/\.0+$/,'');
    if(/^\d(\.\d+)?e\+\d+$/i.test(s)) s=String(Math.round(Number(s))); return s; }
  function p2(n){ return (n<10?'0':'')+n; }
  function iso(y,mo,d,h,mi,se){ if(!(y>1990&&mo>=1&&mo<=12&&d>=1&&d<=31&&h>=0&&h<24&&mi>=0&&mi<60&&se>=0&&se<60)) return undefined;
    return y+'-'+p2(mo)+'-'+p2(d)+'T'+p2(h)+':'+p2(mi)+':'+p2(se)+'+03:00'; }
  /* "30/07/2026 03:31:59 PM" (Payments' own, day first, Riyadh time — D20), an ISO date, or an Excel date number.
     null = blank; undefined = unreadable. */
  function when(v){
    if(v==null||v==='') return null;
    if(typeof v==='number'){ if(!isFinite(v)||v<20000||v>80000) return undefined;
      var d=new Date(Math.round((v-25569)*86400000));   // the serial's own wall time, read as Riyadh time
      return iso(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()); }
    var s=digits(v).trim(), m;
    if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/))){
      var h=+m[4]||0; if(m[7]){ var pm=/p/i.test(m[7]); if(h===12) h=pm?12:0; else if(pm) h+=12; }
      return iso(+m[3],+m[2],+m[1],h,+m[5]||0,+m[6]||0); }
    if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/))) return iso(+m[1],+m[2],+m[3],+m[4]||0,+m[5]||0,+m[6]||0);
    return undefined; }
  function status(v){ var s=String(v==null?'':v).trim().toLowerCase().replace(/\s+/g,' ');
    if(!s) return null; if(s==='approved') return 'approved'; if(s==='pending') return 'pending'; if(s==='under review') return 'under_review';
    if(s==='cancelled'||s==='canceled') return 'cancelled'; if(s==='rejected') return 'rejected'; return 'other'; }
  function txt(v){ var s=String(v==null?'':v).trim(); return s===''?null:s; }
  /* the file's Payments export time — its name carries it ("2026-09-27_18-49-34transaction-expense-…"); else when it
     was saved; a newer file wins for every line it carries */
  function asOf(f){ var m=String((f&&f.name)||'').match(/(20\d\d)-(\d\d)-(\d\d)[ _+T](\d\d)[-_:](\d\d)[-_:](\d\d)/);
    if(m){ var t=iso(+m[1],+m[2],+m[3],+m[4],+m[5],+m[6]); if(t) return t; }
    if(f&&f.lastModified) return new Date(f.lastModified).toISOString(); return new Date().toISOString(); }

  /* ---------------- reading: CSV in 1 MB slices, Excel in a background worker ---------------- */
  function csvParser(onRow){
    var field='', row=[], inQ=false, qp=false, started=false;
    function endField(){ row.push(field); field=''; }
    function endRow(){ endField(); if(!(row.length===1&&row[0]==='')) onRow(row); row=[]; }
    return { feed:function(t,last){
      var i=0; if(!started){ if(t.charCodeAt(0)===0xFEFF) i=1; started=true; }
      if(qp){ qp=false; if(t.charAt(i)==='"'){ field+='"'; i++; } else inQ=false; }
      for(;i<t.length;i++){ var c=t.charAt(i);
        if(inQ){ if(c==='"'){ if(i+1<t.length){ if(t.charAt(i+1)==='"'){ field+='"'; i++; } else inQ=false; } else if(last) inQ=false; else qp=true; }
                 else field+=c; continue; }
        if(c==='"'){ inQ=true; } else if(c===','){ endField(); } else if(c==='\n'){ endRow(); } else if(c==='\r'){ if(t.charAt(i+1)!=='\n') endRow(); } else field+=c; }
      if(last&&(field!==''||row.length)) endRow(); } };
  }
  function readCsv(file, onRows, onDone, onErr){
    var CH=1<<20, pos=0, stop=false, dec=new TextDecoder('utf-8'), buf=[], p=csvParser(function(r){ buf.push(r); });
    function step(){ if(stop) return;
      file.slice(pos,pos+CH).arrayBuffer().then(function(ab){ if(stop) return; pos+=CH; var last=pos>=file.size;
        p.feed(dec.decode(new Uint8Array(ab),{stream:!last}),last);
        var out=buf; buf=[]; if(out.length) onRows(out, Math.min(pos,file.size), file.size);
        if(last) onDone(); else setTimeout(step,0); }).catch(onErr); }
    step(); return { stop:function(){ stop=true; } };
  }
  function firstCsvRow(file, cb){
    file.slice(0,65536).arrayBuffer().then(function(ab){ var got=null, p=csvParser(function(r){ if(!got) got=r; });
      p.feed(new TextDecoder('utf-8').decode(new Uint8Array(ab)), true); cb(got||[]); }).catch(function(){ cb([]); });
  }
  var XLSX_URL='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  var WORKER_SRC=[
    'var BUF=null;',
    'self.onmessage=function(e){var d=e.data;try{',
    ' if(!self.XLSX) importScripts(d.url);',
    ' if(d.cmd==="peek"){BUF=d.buf;var w=XLSX.read(new Uint8Array(BUF),{type:"array",dense:true,sheetRows:1});',
    '   var s=w.Sheets[w.SheetNames[0]];self.postMessage({t:"head",row:(XLSX.utils.sheet_to_json(s,{header:1,raw:true,defval:""})[0]||[])});return;}',
    ' if(d.cmd==="read"){var wb=XLSX.read(new Uint8Array(BUF),{type:"array",dense:true});BUF=null;var ws=wb.Sheets[wb.SheetNames[0]];',
    '   var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:""});wb=null;ws=null;self.postMessage({t:"n",n:rows.length});',
    '   for(var i=0;i<rows.length;i+=5000) self.postMessage({t:"rows",rows:rows.slice(i,i+5000)});self.postMessage({t:"done"});}',
    '}catch(err){self.postMessage({t:"err",msg:String(err&&err.message||err)});}};'].join('\n');
  function xlsxWorker(){ try{ return new Worker(URL.createObjectURL(new Blob([WORKER_SRC],{type:'application/javascript'}))); }catch(_){ return null; } }
  /* the rare browser that refuses a worker: read on the page (the tab may pause for a big file — said on screen) */
  function xlsxOnPage(file, cb, onErr){
    function go(){ file.arrayBuffer().then(function(ab){ try{ var wb=XLSX.read(new Uint8Array(ab),{type:'array',dense:true});
      cb(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''})); }catch(e){ onErr(e); } }).catch(onErr); }
    if(window.XLSX) return go(); var s=document.createElement('script'); s.src=XLSX_URL; s.onload=go; s.onerror=function(){ onErr(new Error('the Excel reader could not load')); }; document.head.appendChild(s); }
  function isXlsx(f){ return /\.xlsx?$/i.test(String((f&&f.name)||'')); }

  /* peek at one file: its kind (tx / ei / rr) or null; ctx carries what the full read needs */
  function peek(f, cb){
    if(f&&f.__rows2d){ cb(kindOf(f.__rows2d[0]||[]),{rows2d:f.__rows2d}); return; }
    if(!isXlsx(f)){ firstCsvRow(f,function(h){ cb(kindOf(h),{}); }); return; }
    var w=xlsxWorker(); if(!w){ cb(null,{}); return; }   // no worker: js/65 reads it as before
    var done=false, fin=function(k,c){ if(done) return; done=true; cb(k,c); };
    w.onmessage=function(e){ var d=e.data; if(d.t==='head'){ var k=kindOf(d.row); if(k) fin(k,{worker:w}); else { w.terminate(); fin(null,{}); } }
      else if(d.t==='err'){ w.terminate(); fin(null,{}); } };
    w.onerror=function(){ try{ w.terminate(); }catch(_){} fin(null,{}); };
    f.arrayBuffer().then(function(ab){ w.postMessage({cmd:'peek',buf:ab,url:XLSX_URL},[ab]); }).catch(function(){ fin(null,{}); });
  }
  /* the whole file, rows in batches (header first), yielding between batches */
  function readAll(item, onRows, onDone, onErr){
    var f=item.file, ctx=item.ctx||{};
    if(ctx.rows2d){ var r=ctx.rows2d, i=0; (function next(){ var b=r.slice(i,i+5000); i+=5000; if(b.length) onRows(b,Math.min(i,r.length),r.length); if(i<r.length) setTimeout(next,0); else onDone(); })(); return; }
    if(!isXlsx(f)){ readCsv(f,onRows,onDone,onErr); return; }
    var w=ctx.worker; if(!w){ xlsxOnPage(f,function(rows){ ctx.rows2d=rows; readAll(item,onRows,onDone,onErr); },onErr); return; }
    var total=0, seen=0;
    w.onmessage=function(e){ var d=e.data;
      if(d.t==='n') total=d.n;
      else if(d.t==='rows'){ seen+=d.rows.length; onRows(d.rows,seen,total); }
      else if(d.t==='done'){ w.terminate(); onDone(); }
      else if(d.t==='err'){ w.terminate(); onErr(new Error(d.msg)); } };
    w.postMessage({cmd:'read',url:XLSX_URL});
  }

  /* ---------------- the money rows (what a reference can attach to) ---------------- */
  function loadMoney(cb){
    var c=client(); if(!c){ cb(new Error(fl('Not connected — try again.','غير متصل — حاول مجددًا.'))); return; }
    var all=[], from=0, P=1000;
    (function page(){ c.from('finance_invoices').select('id,invoice_no,source,cost_sar,revenue_way,client_group,line_no').is('deleted_at',null)
      .order('id',{ascending:true}).range(from,from+P-1).then(function(r){
        if(r.error){ cb(r.error); return; } all=all.concat(r.data||[]);
        if((r.data||[]).length===P){ from+=P; page(); } else { var by={}; all.forEach(function(x){ (by[x.invoice_no]=by[x.invoice_no]||[]).push(x); }); cb(null,by); } }); })();
  }
  function loadStored(table, refs, cols, cb){
    var c=client(), out=[], list=refs.slice(), CH=100;
    (function next(){ if(!list.length){ cb(null,out); return; } var part=list.splice(0,CH);
      c.from(table).select(cols).in('ref',part).then(function(r){ if(r.error){ cb(r.error); return; } out=out.concat(r.data||[]); next(); }); })();
  }

  /* ---------------- one file → what it would change ---------------- */
  function newFileState(item){ return { name:item.file.name, kind:item.kind, asOf:asOf(item.file), rows:0, bad:[], nBad:0, blankRef:0,
    header:null, col:null, lines:{}, occ:{}, facts:{}, held:{}, heldLines:0, heldAppr:0, wfrom:null, wto:null, read:0, total:0 }; }
  function colsOf(header, want){ var h=header.map(hk), o={}; for(var k in want){ o[k]=h.indexOf(want[k]); } return o; }
  var TXC={ref:'invoice#',amount:'amountsar',type:'expensetype',status:'status',created:'createdat',submitted:'submissiondate',
    decided:'approvalrejectiondate',merchant:'merchant',idref:'idreference',submitter:'submitter',approver:'approverrejector'};
  var EIC={ref:'invoice#ref#',request:'requestnumber',product:'invoiceproduct',amount:'invoiceamount',status:'invoicestatus',
    type:'invoicetype',assign:'expenseassignments',overdue:'overdue',by:'invoicecreatedby',at:'invoicecreatedat'};
  var RRC={ref:'invoice#ref#',total:'totalexpenseamount'};
  function bad(S, n, why){ S.nBad++; if(S.bad.length<5) S.bad.push(fl('row ','الصف ')+I(n)+': '+why); }
  function takeRows(S, rows, money){
    rows.forEach(function(r){
      if(!S.header){ S.header=r; S.col=colsOf(r, S.kind==='tx'?TXC:(S.kind==='ei'?EIC:RRC)); return; }
      S.rows++; var n=S.rows+1, C=S.col, g=function(k){ return C[k]>=0?r[C[k]]:''; };
      var R=ref(g('ref')); if(!R){ S.blankRef++; return; }
      var mine=!!money[R];
      if(S.kind==='tx'){
        var st=status(g('status')), amt=money_(g('amount')), cr=when(g('created'));
        if(!st){ bad(S,n,fl('no status','لا توجد حالة')); return; }
        if(amt!==amt){ bad(S,n,fl('amount not a number: ','المبلغ ليس رقمًا: ')+String(g('amount')).slice(0,20)); return; }
        if(!cr){ bad(S,n,fl('no readable Created At','لا يوجد تاريخ إنشاء مقروء')); return; }
        if(!S.wfrom||cr<S.wfrom) S.wfrom=cr; if(!S.wto||cr>S.wto) S.wto=cr;
        var typ=String(g('type')==null?'':g('type')).trim(), key=R+'|'+typ.toLowerCase()+'|'+cr;
        S.occ[key]=(S.occ[key]||0)+1; if(S.occ[key]>1) key+='|#'+S.occ[key];
        if(!mine){ var h=S.held[R]=S.held[R]||{n:0,appr:0,sar:0}; h.n++; S.heldLines++; if(st==='approved'){ h.appr++; h.sar+=+amt||0; S.heldAppr+=+amt||0; } return; }
        var sub=when(g('submitted')), dec=when(g('decided'));
        S.lines[key]={ref:R,line_key:key,expense_type:txt(typ),status:st,status_raw:txt(g('status')),amount_sar:amt,id_reference:txt(g('idref')),
          merchant:txt(g('merchant')),created_on:cr,submitted_on:sub||null,decided_on:dec||null,submitter:txt(g('submitter')),approver:txt(g('approver'))};
      } else if(S.kind==='ei'){
        var a=money_(g('amount')); if(a!==a){ bad(S,n,fl('amount not a number','المبلغ ليس رقمًا')); return; }
        if(!mine){ S.held[R]=S.held[R]||{n:0}; S.held[R].n++; return; }
        S.facts[R]={ref:R,kind:'ei',request_number:txt(g('request')),invoice_product:txt(g('product')),invoice_amount_sar:a,invoice_status:txt(g('status')),
          invoice_type:txt(g('type')),expense_assignments:txt(g('assign')),overdue:txt(g('overdue')),created_by:txt(g('by')),created_on:when(g('at'))||null};
      } else {
        var t=money_(g('total')); if(t!==t){ bad(S,n,fl('Total Expense Amount not a number','إجمالي المصروفات ليس رقمًا')); return; }
        if(!mine){ S.held[R]=S.held[R]||{n:0}; S.held[R].n++; return; }
        S.facts[R]={ref:R,kind:'rr',rr_total_expense_sar:t};
      }
    });
  }
  var money_=money;

  /* the same rules as fn_cost_import, run here first so the screen says exactly what the import will change */
  var LF=['amount_sar','id_reference','merchant','submitted_on','decided_on','submitter','approver'], TS={submitted_on:1,decided_on:1};
  function norm(f,v){ if(v==null||v==='') return null; if(f==='amount_sar') return Number(v); if(TS[f]) return Date.parse(v); return String(v); }
  function simulateTx(S, money, stored, facts){
    var byKey={}, byRef={}; stored.forEach(function(l){ byKey[l.line_key]=l; (byRef[l.ref]=byRef[l.ref]||[]).push(l); });
    var out={lNew:0,lChanged:0,lSame:0,lDropped:0,set:0,changed:0,same:0,cleared:0,waiting:0,manual:0,commission:0,several:0,rows:[]};
    var refs={}; Object.keys(S.lines).forEach(function(k){ refs[S.lines[k].ref]=1; });
    var after={}; Object.keys(byRef).forEach(function(r){ if(refs[r]) after[r]=byRef[r].map(function(l){ return Object.assign({},l); }); });
    var asOfT=Date.parse(S.asOf);
    Object.keys(S.lines).forEach(function(k){ var x=S.lines[k], t=byKey[k];
      if(!t){ out.lNew++; (after[x.ref]=after[x.ref]||[]).push(Object.assign({seen_at:S.asOf},x)); return; }
      var cur=(after[x.ref]||[]).find(function(l){ return l.line_key===k; }), nw=!t.seen_at||asOfT>=Date.parse(t.seen_at), ch=false;
      if(nw&&cur.status!==x.status){ cur.status=x.status; ch=true; }
      LF.forEach(function(f){ var a=norm(f,cur[f]), b=norm(f,x[f]);
        if(nw){ if(b!=null&&a!==b){ cur[f]=x[f]; ch=true; } }       // a newer file sets what it carries; a blank never wipes
        else if(a==null&&b!=null){ cur[f]=x[f]; ch=true; } });      // an older file only fills what is empty
      if(ch) out.lChanged++; else out.lSame++; });
    if(S.wfrom&&S.wto){ var f=Date.parse(S.wfrom), to=Date.parse(S.wto);
      Object.keys(after).forEach(function(r){ after[r]=after[r].filter(function(l){ var c=Date.parse(l.created_on);
        var drop=!S.lines[l.line_key]&&c>=f&&c<=to&&(!l.seen_at||Date.parse(l.seen_at)<asOfT); if(drop) out.lDropped++; return !drop; }); }); }
    var prev={}; facts.forEach(function(p){ prev[p.ref]=p.lines_cost_sar; });
    Object.keys(refs).forEach(function(r){ var rows=money[r]||[];
      if(rows.length>1){ out.several++; out.rows.push({ref:r,what:'several',rows:rows}); return; }
      var m=rows[0]; if(!m) return;
      if(m.source&&m.source!=='import'){ out.manual++; return; }
      if(m.revenue_way==='commission'){ out.commission++; return; }
      var appr=(after[r]||[]).filter(function(l){ return l.status==='approved'; });
      var nv=appr.length?Math.round(appr.reduce(function(s,l){ return s+(+l.amount_sar||0); },0)*100)/100:null;
      var cur=m.cost_sar==null?null:Number(m.cost_sar);
      if(nv!=null){ if(cur==null){ out.set++; out.rows.push({ref:r,what:'set',from:null,to:nv,m:m}); }
        else if(Math.abs(cur-nv)>0.004){ out.changed++; out.rows.push({ref:r,what:'changed',from:cur,to:nv,m:m}); } else out.same++; }
      else if(prev[r]!=null&&cur!=null&&Math.abs(cur-Number(prev[r]))<0.005){ out.cleared++; out.rows.push({ref:r,what:'cleared',from:cur,to:null,m:m}); }
      else out.waiting++; });
    return out;
  }
  function simulateFacts(S, stored){
    var by={}; stored.forEach(function(p){ by[p.ref]=p; }); var out={fNew:0,fChanged:0,fSame:0};
    var asOfT=Date.parse(S.asOf);
    Object.keys(S.facts).forEach(function(r){ var x=S.facts[r], t=by[r];
      if(!t){ out.fNew++; return; }
      if(S.kind==='rr'){ var nwr=!t.rr_seen_at||asOfT>=Date.parse(t.rr_seen_at);
        var v=nwr?(x.rr_total_expense_sar!=null?x.rr_total_expense_sar:t.rr_total_expense_sar):(t.rr_total_expense_sar!=null?t.rr_total_expense_sar:x.rr_total_expense_sar);
        if((v==null?null:Number(v))!==(t.rr_total_expense_sar==null?null:Number(t.rr_total_expense_sar))) out.fChanged++; else out.fSame++; return; }
      var nw=!t.ei_seen_at||asOfT>=Date.parse(t.ei_seen_at), diff=false;
      ['expense_assignments','invoice_status','request_number','invoice_product','invoice_amount_sar','invoice_type','created_by','created_on'].forEach(function(f){
        var a=f==='invoice_amount_sar'?(t[f]==null?null:Number(t[f])):(f==='created_on'?(t[f]?Date.parse(t[f]):null):(t[f]==null?null:String(t[f])));
        var b=f==='invoice_amount_sar'?x[f]:(f==='created_on'?(x[f]?Date.parse(x[f]):null):x[f]);
        var keepOld=(f==='created_by'||f==='created_on');            // who made it and when never move once known
        if(nw&&!keepOld){ if(b!=null&&a!==b) diff=true; } else if(a==null&&b!=null) diff=true; });
      if(nw){ if((x.overdue||null)!==(t.overdue||null)) diff=true; }   // overdue is a status: the newer file's, blank included
      else if(t.overdue==null&&x.overdue!=null) diff=true;
      if(diff) out.fChanged++; else out.fSame++; });
    return out;
  }

  /* ---------------- state and the Import-card block ---------------- */
  var STATE=null, GEN=0;
  window.v121Route=function(list, cb){
    list=Array.prototype.slice.call(list||[]); if(!list.length){ cb([]); return; }
    var kinds=new Array(list.length), left=list.length;
    list.forEach(function(f,i){ peek(f,function(k,ctx){ kinds[i]={k:k,ctx:ctx}; if(--left) return;
      var mine=[], rest=[]; list.forEach(function(g,j){ if(kinds[j].k) mine.push({file:g,kind:kinds[j].k,ctx:kinds[j].ctx}); else rest.push(g); });
      cb(rest); if(mine.length) start(mine); }); });
  };
  function start(items){
    var gen=++GEN; STATE={gen:gen, phase:'loading', files:items.map(newFileState), items:items, msg:null, done:null};
    paintNow();
    loadMoney(function(err, money){ if(gen!==GEN) return;
      if(err){ STATE.phase='error'; STATE.msg=String(err.message||err); paintNow(); return; }
      STATE.money=money; STATE.phase='reading'; paintNow();
      var i=0; (function nextFile(){ if(gen!==GEN) return; if(i>=items.length){ preview(gen); return; }
        var S=STATE.files[i], it=items[i]; i++;
        readAll(it,function(rows,seen,total){ if(gen!==GEN) return; takeRows(S,rows,money); S.read=seen; S.total=total; paintSoon(); },
          function(){ nextFile(); },
          function(e){ S.err=String((e&&e.message)||e); nextFile(); }); })();
    });
  }
  function preview(gen){
    var S=STATE, left=0, fail=null;
    S.files.forEach(function(F){ if(F.err||!F.header) return;
      if(F.kind==='tx'){ var refs={}; Object.keys(F.lines).forEach(function(k){ refs[F.lines[k].ref]=1; }); var R=Object.keys(refs);
        left+=2;
        loadStored('finance_expense_lines',R,'ref,line_key,status,amount_sar,created_on,seen_at,id_reference,merchant,submitted_on,decided_on,submitter,approver',function(e,rows){ if(e) fail=e; F._stored=rows||[]; fin(); });
        loadStored('finance_payments_facts',R,'ref,lines_cost_sar',function(e,rows){ if(e) fail=e; F._facts=rows||[]; fin(); });
      } else { left++; loadStored('finance_payments_facts',Object.keys(F.facts),'ref,overdue,expense_assignments,invoice_status,request_number,invoice_product,invoice_amount_sar,invoice_type,created_by,created_on,ei_seen_at,rr_total_expense_sar,rr_seen_at',function(e,rows){ if(e) fail=e; F._facts=rows||[]; fin(); }); }
    });
    if(!left) fin(true);
    function fin(now){ if(!now&&--left>0) return; if(gen!==GEN) return;
      if(fail){ S.phase='error'; S.msg=String(fail.message||fail); paintNow(); return; }
      S.files.forEach(function(F){ if(F.err||!F.header) return; F.sim=F.kind==='tx'?simulateTx(F,S.money,F._stored||[],F._facts||[]):simulateFacts(F,F._facts||[]); });
      S.phase='preview'; paintNow(); }
  }
  function nothingNew(F){ var s=F.sim; if(!s) return true;
    return F.kind==='tx'?!(s.lNew||s.lChanged||s.lDropped||s.set||s.changed||s.cleared):!(s.fNew||s.fChanged); }

  window.v121Import=function(){
    var S=STATE; if(!S||S.phase!=='preview') return;
    if(!canWrite()){ S.msg=fl('View only — importing cost needs Full control of Finance.','عرض فقط — استيراد التكلفة يحتاج صلاحية كاملة على المالية.'); paintNow(); return; }
    var c=client(); if(!c){ S.msg=fl('Not connected — try again.','غير متصل — حاول مجددًا.'); paintNow(); return; }
    var jobs=[]; S.files.forEach(function(F){ if(F.err||!F.header||nothingNew(F)) return;
      var batch='payments-'+F.kind+'-'+F.asOf.slice(0,19);
      if(F.kind==='tx'){ var by={}; Object.keys(F.lines).forEach(function(k){ var l=F.lines[k]; (by[l.ref]=by[l.ref]||[]).push(l); });
        var cur=[]; Object.keys(by).forEach(function(r){ if(cur.length&&cur.length+by[r].length>1500){ jobs.push({F:F,lines:cur,facts:[],batch:batch}); cur=[]; } cur=cur.concat(by[r]); });
        if(cur.length) jobs.push({F:F,lines:cur,facts:[],batch:batch}); }
      else { var fs=Object.keys(F.facts).map(function(r){ return F.facts[r]; }); for(var i=0;i<fs.length;i+=1500) jobs.push({F:F,lines:[],facts:fs.slice(i,i+1500),batch:batch}); } });
    if(!jobs.length){ S.msg=fl('Nothing new to write — these files are already in.','لا جديد لكتابته — هذه الملفات مستوردة من قبل.'); paintNow(); return; }
    S.phase='writing'; S.total=jobs.length; S.doneJobs=0; S.res={}; paintNow();
    var gen=S.gen, k=0;
    (function next(){ if(gen!==GEN) return; if(k>=jobs.length){ S.phase='done'; paintNow(); try{ if(window.FIN){ FIN.rows=null; if(typeof finLoad==='function') finLoad(); } }catch(_){} return; }
      var j=jobs[k++];
      c.rpc('fn_cost_import',{p_lines:j.lines,p_facts:j.facts,p_seen_at:j.F.asOf,p_window_from:j.F.kind==='tx'?j.F.wfrom:null,p_window_to:j.F.kind==='tx'?j.F.wto:null,p_batch:j.batch})
        .then(function(r){ if(gen!==GEN) return;
          if(r.error){ S.phase='error'; S.msg=fl('Stopped at part ','توقف عند الجزء ')+k+fl(' of ',' من ')+jobs.length+': '+String(r.error.message||r.error)+' — '+
            fl('what was written stays; dropping the same files again finishes the rest (it changes nothing twice).','ما كُتب يبقى؛ إفلات الملفات نفسها مرة أخرى يُكمل الباقي (لا يغيّر شيئًا مرتين).'); paintNow(); return; }
          var d=r.data||{}; Object.keys(d).forEach(function(x){ S.res[x]=(S.res[x]||0)+(+d[x]||0); }); S.doneJobs=k; paintSoon(); next(); }); })();
  };
  window.v121Clear=function(){ GEN++; STATE=null; paintNow(); };
  window.v121Held=function(i){ var F=STATE&&STATE.files[i]; if(!F) return;
    var lines=F.kind==='tx'?['reference,lines,approved lines,approved SAR']:['reference'];
    Object.keys(F.held).sort().forEach(function(r){ var h=F.held[r]; lines.push(F.kind==='tx'?[r,h.n,h.appr,h.sar.toFixed(2)].join(','):r); });
    var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'})); a.download='held-references-'+F.kind+'.csv';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500); };

  function fileBlock(F,i){
    var K=KINDS[F.kind], h='<div class="v121-file" data-v121-kind="'+F.kind+'" style="border-top:1px solid var(--line,#E4E7EC);padding:10px 0">';
    h+='<b>'+esc(F.name)+'</b> — '+fl(K.en,K.ar)+' <span style="color:var(--muted)">('+fl('exported ','صُدّر ')+esc(F.asOf.slice(0,16).replace('T',' '))+')</span><br>';
    if(F.err){ return h+'<span style="color:#D92D20">'+fl('Could not be read: ','تعذّرت القراءة: ')+esc(F.err)+'</span></div>'; }
    h+='<span data-v121-rows="'+F.rows+'">'+I(F.rows)+' '+fl('rows read','صفًا مقروءًا')+(F.total&&F.read<F.total?' ('+Math.round(100*F.read/F.total)+'%)':'')+'</span>';
    var s=F.sim, heldN=Object.keys(F.held).length;
    if(s&&F.kind==='tx'){
      h+='<ul style="margin:6px 0 0;padding-inline-start:18px">';
      h+='<li data-v121-cost="'+[s.set,s.changed,s.same,s.cleared,s.waiting].join(',')+'">'+fl('Invoices in Finance: ','الفواتير في المالية: ')+'<b>'+I(s.set)+'</b> '+fl('get their cost','تأخذ تكلفتها')+', <b>'+I(s.changed)+'</b> '+fl('change','تتغيّر')+', '+I(s.same)+' '+fl('unchanged','بلا تغيير')+
        (s.cleared?', <b>'+I(s.cleared)+'</b> '+fl('lose it (every approved line now cancelled)','تفقدها (كل البنود المعتمدة أُلغيت)'):'')+(s.waiting?', '+I(s.waiting)+' '+fl('still waiting (no approved line yet)','ما زالت بانتظار بند معتمد'):'')+'</li>';
      h+='<li data-v121-lines="'+[s.lNew,s.lChanged,s.lSame,s.lDropped].join(',')+'">'+fl('Expense lines: ','بنود المصروفات: ')+I(s.lNew)+' '+fl('new','جديد')+', '+I(s.lChanged)+' '+fl('changed','متغيّر')+', '+I(s.lSame)+' '+fl('unchanged','بلا تغيير')+(s.lDropped?', '+I(s.lDropped)+' '+fl('gone from Payments inside this file\'s dates','اختفت من المدفوعات ضمن تواريخ هذا الملف'):'')+
        ' — '+fl('only Approved lines are cost; Pending, Under Review, Cancelled and Rejected never are.','البنود المعتمدة وحدها تكلفة؛ المعلّقة وقيد المراجعة والملغاة والمرفوضة لا تُحتسب.')+'</li>';
      if(s.manual||s.commission||s.several) h+='<li>'+fl('Left alone: ','تُركت كما هي: ')+(s.manual?I(s.manual)+' '+fl('hand-entered','مُدخلة يدويًا')+' ':'')+(s.commission?I(s.commission)+' '+fl('commission (no cost by nature)','عمولة (بلا تكلفة بطبيعتها)')+' ':'')+(s.several?I(s.several)+' '+fl('with several money rows (a person decides)','بأكثر من صف مالي (يقرّر شخص)'):'')+'</li>';
      h+='<li data-v121-held="'+heldN+'">'+I(F.heldLines)+' '+fl('lines on','بندًا على')+' '+I(heldN)+' '+fl('references not in Finance — held, nothing written (consumer sales, or invoices not imported yet: import the invoice export, then drop this file again)','مرجعًا غير موجود في المالية — محجوزة ولم يُكتب شيء (مبيعات أفراد، أو فواتير لم تُستورد بعد: استورد تصدير الفواتير ثم أفلت هذا الملف مجددًا)')+
        (heldN?' · <a href="javascript:void 0" onclick="v121Held('+i+')">'+fl('download the list','تنزيل القائمة')+'</a>':'')+'</li>';
      h+='</ul>';
      var rows=s.rows.filter(function(x){ return x.what!=='several'; }).slice(0,30);
      if(rows.length) h+='<table class="tbl" style="margin-top:6px;font-size:12px"><thead><tr><th>'+fl('Reference','المرجع')+'</th><th>'+fl('Client','العميل')+'</th><th>'+fl('Cost now','التكلفة الآن')+'</th><th>'+fl('After','بعد')+'</th></tr></thead><tbody>'+
        rows.map(function(x){ return '<tr data-v121-ref="'+esc(x.ref)+'"><td>'+esc(x.ref)+'</td><td>'+esc((x.m&&x.m.client_group)||'')+'</td><td>'+(x.from==null?fl('waiting','بانتظار'):M(x.from))+'</td><td><b>'+(x.to==null?fl('waiting','بانتظار'):M(x.to))+'</b></td></tr>'; }).join('')+'</tbody></table>'+
        (s.rows.length>30?'<div style="font-size:11.5px;color:var(--muted)">'+fl('… and ','… و')+I(s.rows.length-30)+' '+fl('more','أخرى')+'</div>':'');
    } else if(s){
      h+='<ul style="margin:6px 0 0;padding-inline-start:18px"><li data-v121-facts="'+[s.fNew,s.fChanged,s.fSame].join(',')+'">'+fl('References in Finance: ','المراجع في المالية: ')+I(s.fNew)+' '+fl('new','جديد')+', '+I(s.fChanged)+' '+fl('changed','متغيّر')+', '+I(s.fSame)+' '+fl('unchanged','بلا تغيير')+
        (F.kind==='rr'?' — '+fl('only the Total Expense Amount is kept (the submitted expenses — shown as an estimate until approved lines arrive); its revenue and VAT columns are not read.','يُحفظ إجمالي المصروفات فقط (المصروفات المقدَّمة — تظهر تقديرًا حتى تصل البنود المعتمدة)؛ ولا تُقرأ أعمدة الإيراد والضريبة.')
                       :' — '+fl('the expense status and the Overdue flag.','حالة المصروفات وعلامة التأخر.'))+'</li>';
      h+='<li data-v121-held="'+heldN+'">'+I(heldN)+' '+fl('references not in Finance — held, nothing written','مرجعًا غير موجود في المالية — محجوزة ولم يُكتب شيء')+(heldN?' · <a href="javascript:void 0" onclick="v121Held('+i+')">'+fl('download the list','تنزيل القائمة')+'</a>':'')+'</li></ul>';
    }
    if(F.nBad) h+='<div style="color:#B54708;font-size:12px;margin-top:4px" data-v121-bad="'+F.nBad+'">'+I(F.nBad)+' '+fl('rows could not be read and were skipped: ','صفًا تعذّرت قراءته فتُرك: ')+esc(F.bad.join(' · '))+'</div>';
    if(F.blankRef) h+='<div style="color:var(--muted);font-size:12px">'+I(F.blankRef)+' '+fl('rows with no reference skipped','صفًا بلا مرجع تُرك')+'</div>';
    return h+'</div>';
  }
  function html(){
    var S=STATE; if(!S) return '';
    var h='<div class="card" data-v121-phase="'+S.phase+'" style="padding:12px 14px;margin-bottom:12px;border-inline-start:4px solid #0F6E56">';
    h+='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>'+fl('Payments cost files','ملفات التكلفة من المدفوعات')+'</b>'+
       (S.phase==='writing'||S.phase==='reading'||S.phase==='loading'?'':'<button class="btn sm" onclick="v121Clear()">'+fl('Close','إغلاق')+'</button>')+'</div>';
    if(S.phase==='loading') h+='<div style="font-size:13px">'+fl('Loading the invoices in Finance…','جارٍ تحميل فواتير المالية…')+'</div>';
    S.files.forEach(function(F,i){ h+=fileBlock(F,i); });
    if(S.phase==='preview'){
      var any=S.files.some(function(F){ return !F.err&&F.header&&!nothingNew(F); }), w=canWrite();
      if(!any) h+='<div style="font-size:13px;color:#0F6E56;margin-top:6px" data-v121-nothing="1"><b>'+fl('Nothing new','لا جديد')+'</b> — '+fl('these files are already in Finance.','هذه الملفات موجودة في المالية.')+'</div>';
      else if(!w) h+='<div style="font-size:13px;color:#B54708;margin-top:6px">'+fl('View only — importing cost needs Full control of Finance.','عرض فقط — استيراد التكلفة يحتاج صلاحية كاملة على المالية.')+'</div>';
      else h+='<button class="btn pri sm" style="margin-top:8px" data-v121-go="1" onclick="v121Import()">'+fl('Import the cost into Finance','استيراد التكلفة إلى المالية')+'</button>';
    }
    if(S.phase==='writing') h+='<div style="font-size:13px;margin-top:6px">'+fl('Writing part ','كتابة الجزء ')+I(S.doneJobs+1)+fl(' of ',' من ')+I(S.total)+'…</div>';
    if(S.phase==='done'){ var r=S.res||{};
      h+='<div style="font-size:13px;color:#0F6E56;margin-top:6px" data-v121-done="'+[r.cost_set||0,r.cost_changed||0,r.cost_cleared||0,r.lines_new||0,r.lines_changed||0,r.facts_written||0].join(',')+'"><b>'+fl('Done.','تم.')+'</b> '+
        I(r.cost_set||0)+' '+fl('invoices got their cost','فاتورة أخذت تكلفتها')+', '+I(r.cost_changed||0)+' '+fl('changed','تغيّرت')+(r.cost_cleared?', '+I(r.cost_cleared)+' '+fl('back to waiting','عادت إلى الانتظار'):'')+
        ' · '+I(r.lines_new||0)+' '+fl('new lines','بند جديد')+', '+I(r.lines_changed||0)+' '+fl('changed','متغيّر')+(r.facts_written?' · '+I(r.facts_written)+' '+fl('references updated from the other reports','مرجعًا حُدّث من التقارير الأخرى'):'')+
        '. '+fl('Every change is in the change log.','كل تغيير مسجّل في سجل التغييرات.')+'</div>'; }
    if(S.phase==='error') h+='<div style="font-size:13px;color:#D92D20;margin-top:6px" data-v121-error="1">'+esc(S.msg||'')+'</div>';
    else if(S.msg) h+='<div style="font-size:13px;margin-top:6px">'+esc(S.msg)+'</div>';
    return h+'</div>';
  }

  /* ---------------- painting: a box above js/65's preview, kept across renders ---------------- */
  var soon=null;
  function paintSoon(){ if(soon) return; soon=setTimeout(function(){ soon=null; paintNow(); },250); }
  function paintNow(){ var out=document.getElementById('finImpOut'); if(!out) return;
    var box=document.getElementById('v121Out');
    if(!box){ box=document.createElement('div'); box.id='v121Out'; out.parentNode.insertBefore(box,out); }
    box.innerHTML=html(); }
  function wire(){ try{ if(typeof current!=='undefined'&&current==='finance'&&window.FIN&&FIN.tab==='import') paintNow(); }catch(_){} }
  var _r=window.render; window.render=function(){ var o=_r.apply(this,arguments); wire(); return o; };
  if(typeof window.finGo==='function'){ var _g=window.finGo; window.finGo=function(){ var o=_g.apply(this,arguments); wire(); return o; }; }

  /* for the probe and the acceptance script (never used by the screen) */
  window.v121={ kindOf:kindOf, when:when, money:money, ref:ref, status:status, asOf:asOf, csvParser:csvParser, hk:hk, state:function(){ return STATE; } };
  console.info('%c[v121] cost import — the raw Payments cost exports','color:#0F6E56;font-weight:700');
}catch(e){ if(window.console) console.warn('[v121] init',e); }})();
