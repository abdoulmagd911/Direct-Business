/* ===== Universal importer — signature router + five-count preview (Spec 9, 2026-08-21) =====

   THE PROBLEM. The importer (js/41-money-in.js) recognises exactly one fixed CSV/Excel
   header — Direct Payments' Invoice Export. Drop anything else and it either falls through
   to the old 15-column legacy format or is rejected outright. Nothing "syncs" from Direct
   Payments; everything that isn't an Invoice Export still arrives by hand.

   THE DESIGN (owner-verified, supersedes the 2026-08-20 plan in the project docs):
     • Identify each dropped file by its COLUMN SIGNATURE — the exact set of header names it
       carries — never by a dropdown the person has to pick from. Drop several files at once,
       in any order; each routes itself.
     • Match every row on its natural key and write in place: a row whose key already exists
       gets UPDATED if its data actually changed, left alone if it didn't. Re-importing the
       same file twice changes nothing the second time — there is no "importing twice."
     • Order never matters and partial imports are fine — a file that references something
       not seen yet just sits unlinked until the file that supplies it arrives, same as the
       existing invoice↔client auto-link pass already does.
     • Preview before any write, always the same five counts: new · updated · unchanged ·
       excluded by rule · needs linking.
     • An unrecognised signature shows its own columns and stops — it does NOT guess. Asking
       once which field is which, and remembering the mapping, is the next piece
       ("teach-once") — deliberately not built in this pass; see the TODO below.

   THE REAL CATALOGUE. Direct Payments' own Excel Exports registry (/en/admin/excel-exports)
   lists ELEVEN real export types, not the six an earlier plan assumed — CATALOGUE below
   records all eleven (plus the two screens named separately) with what's actually verified
   about each: row/run counts from the registry itself, whether it's a real cost source, and
   whether it even carries a client column. Three corrections from the 2026-08-20 plan,
   independently verified before this was written, not assumed:
     1. COG Report Export is EMPTY — proved twice: every filter/date combination tried
        returned zero rows, AND the export itself produced zero rows on both of its two real
        runs in the registry. It is not a cost source and this importer will never treat it
        as one. Real cost lives in Transaction Expense Export (70,682 rows), alongside
        Expense Export (70,679) and Expense Invoice Export (52,445).
     2. Invoice Export is 544,541 rows across 66 runs — any bulk path for it MUST stream or
        chunk. This file already reads the whole thing into memory via FileReader (browser-
        side, one dropped file at a time) — fine for a single export, but chunking becomes
        required the moment this reads server-paginated data directly instead of a dropped
        file. Flagged here for whoever builds that path; not needed for what ships today.
     3. Corporate Transactions and Corporate Invoices carry NO client column at all — not an
        ID, not even a name; client is a filter parameter only, never a row value. The
        exclusion rule (Takamol etc.) cannot be applied to a file shaped like that, and the
        preview must say so honestly — "cannot be checked, this file carries no client" — not
        "0 excluded," which reads as "checked, found none."

   TWO RULES THE COLUMNS ENCODE, for whoever wires the first real cost-source signature:
     • cost counts only when CONFIRMED — a transaction has an invoice number, OR its Expense
       Status is Ready (which only happens once every non-cancelled expense line on it is
       Approved — verified 6 for 6 on real data). Never blend in Pending/Under-review amounts.
     • "Total Submitted Expenses" is NOT a cost figure — it sums Approved AND Under Review and
       excludes Cancelled/Pending. Importing it as cost would silently include money that was
       never actually approved. Do not wire either rule against a guessed column name — both
       are recorded here so the moment a real header sample teaches transaction_expense_export
       (or expense_export / expense_invoice_export), the derivation is already specified.

   WHAT'S ACTUALLY WIRED THIS ROUND. Exactly one signature has a real, verified header:
   invoice_export (Direct Payments' own Invoice Export, already parsed correctly by js/41 —
   reused here via its exposed __v65_* functions, not reimplemented). Every other CATALOGUE
   entry is recorded by name/metadata only, correctly reporting itself as "not recognised"
   rather than being guessed at. That is deliberate, not a shortcut: fabricating a signature
   for a file this session has never seen a real header from would silently corrupt whatever
   Direct Payments actually ships. The router and the five-count preview are real and fully
   tested against the one signature that's real; the other ten slot in the moment a header
   sample teaches them — that's the whole point of building the router first.

   TODO (deliberately not built this round, per the owner's own scoping — "the teach-once
   mapping can follow"): when detectSignature() returns null, the preview currently shows the
   file's columns and stops. The next piece is a one-time "which field is which" prompt whose
   answer is saved (in app_settings, alongside the existing exclusion list — see js/62) and
   auto-applied to every future file with that same signature. */
(function(){try{
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function m0(n){ return Math.round(Number(n)||0).toLocaleString('en-US'); }

  var CATALOGUE={
    invoice_export:             {label:'Invoice Export',                            rows:544541,runs:66,isCostSource:false,hasClientColumn:true},
    revenue_report_export:      {label:'Revenue Report Export',                     rows:72875, runs:1, isCostSource:false,hasClientColumn:null},
    transaction_expense_export: {label:'Transaction Expense Export',                rows:70682, runs:2, isCostSource:true, hasClientColumn:null},
    expense_export:             {label:'Expense Export',                           rows:70679, runs:4, isCostSource:true, hasClientColumn:null},
    expense_invoice_export:     {label:'Expense Invoice Export',                   rows:52445, runs:4, isCostSource:true, hasClientColumn:null},
    gmv_transaction_breakdown:  {label:'GMV Transaction Breakdown',                rows:20889, runs:3, isCostSource:false,hasClientColumn:null},
    corp_client_dashboard_inv:  {label:'Corporate Client Dashboard Invoices Export',rows:44,    runs:8, isCostSource:false,hasClientColumn:null},
    corp_clients_export:        {label:'Corporate Clients Export',                 rows:43,    runs:5, isCostSource:false,hasClientColumn:null},
    promo_code_invoice_export:  {label:'Promo Code Invoice Export',                rows:27,    runs:3, isCostSource:false,hasClientColumn:null},
    expense_gmv_export:         {label:'Expense GMV Export',                       rows:13,    runs:2, isCostSource:false,hasClientColumn:null},
    cog_report_export:          {label:'COG Report Export',                        rows:0,     runs:2, isCostSource:false,hasClientColumn:null,
                                  deprecated:'Confirmed empty on every filter tried, and zero rows on both real runs. Never a cost source — do not import.'},
    // screens, not registry exports — named explicitly because of what they DON'T carry
    corporate_transactions:     {label:'Corporate Transactions', rows:null,runs:null,isCostSource:false,hasClientColumn:false},
    corporate_invoices:         {label:'Corporate Invoices',     rows:null,runs:null,isCostSource:false,hasClientColumn:false}
  };
  window.v65Catalogue=CATALOGUE;

  /* A signature is the exact set of header names a file must ALL carry — order-independent,
     since Direct Payments' own column order isn't stable run to run, only presence is. Add
     an entry the instant a real header sample is captured; nothing here is ever guessed. */
  var SIGNATURES=[
    { key:'invoice_export', catalogueKey:'invoice_export',
      requiredColumns:['Type','Invoice Reference #','Customer Name','Item Is Taxable'] }
  ];
  function detectSignature(headerRow){
    var h=(headerRow||[]).map(function(x){return String(x||'').trim();});
    for (var i=0;i<SIGNATURES.length;i++){
      if (SIGNATURES[i].requiredColumns.every(function(c){return h.indexOf(c)>=0;})) return SIGNATURES[i];
    }
    return null;
  }
  window.v65DetectSignature=detectSignature;

  /* ---------- invoice_export: the one fully-wired signature ---------- */
  function processInvoiceExport(rows2d){
    var parseDP=window.__v65_parseDP, toRows=window.__v65_toRowsDP, exclusions=window.__v65_exclusionCounts;
    if(!parseDP||!toRows) return null; // js/41 not loaded — should never happen, but never crash silently
    var parsed=parseDP(rows2d);
    var xc=exclusions?exclusions():{wallet:0,verif:0,clientExcluded:0,clientExcludedDetail:[]};
    var rows=toRows(parsed);

    var existingByNo={};
    ((window.FIN&&FIN.rows)||[]).forEach(function(r){ if(r.invoice_no) existingByNo[r.invoice_no]=r; });
    var CMP=['total_incl_vat_sar','integrity_status','amount_received_sar','amount_remaining_sar','revenue_sar','cost_sar','profit_sar'];
    function differs(oldR,newR){
      return CMP.some(function(f){
        var a=oldR[f], b=newR[f];
        if(typeof a==='number'||typeof b==='number') return Math.abs((Number(a)||0)-(Number(b)||0))>0.01;
        return String(a==null?'':a)!==String(b==null?'':b);
      });
    }
    var isNew=[],updated=[],unchanged=[];
    rows.forEach(function(r){
      var ex=existingByNo[r.invoice_no];
      if(!ex){ isNew.push(r); }
      else if(differs(ex,r)){ var u=Object.assign({},r,{id:ex.id}); updated.push(u); }
      else { unchanged.push(r); }
    });

    var linkByGroup=(window.FIN&&FIN.linkByGroup)||{};
    function isLinked(r){ var l=linkByGroup[r.client_group]; return !!(l&&(l.business_id||l.is_client===false)); }
    var needsLinking=isNew.concat(updated).filter(function(r){ return !isLinked(r); }).length;

    return {
      sigKey:'invoice_export',
      counts:{
        isNew:isNew.length, updated:updated.length, unchanged:unchanged.length,
        excludedByRule:xc.wallet+xc.verif+xc.clientExcluded, needsLinking:needsLinking
      },
      excludedDetail:{wallet:xc.wallet,verif:xc.verif,clientExcluded:xc.clientExcluded,clientExcludedDetail:xc.clientExcludedDetail},
      hasClientColumn:true,
      pendingInsert:isNew, pendingUpdate:updated
    };
  }

  /* ---------- generic per-file router: parse the header, dispatch, or report unknown ---------- */
  function routeFile(name, rows2d, done){
    var hdr=(rows2d&&rows2d[0])||[];
    var sig=detectSignature(hdr);
    if(!sig){
      done({name:name, recognized:false, header:hdr});
      return;
    }
    if(sig.key==='invoice_export'){
      var r=processInvoiceExport(rows2d);
      done(r?Object.assign({name:name, recognized:true, label:CATALOGUE[sig.catalogueKey].label}, r):{name:name, recognized:false, header:hdr, err:'internal: invoice_export processor unavailable'});
      return;
    }
    done({name:name, recognized:false, header:hdr}); // no other signature is wired yet
  }

  function readOneFile(f, cb){
    if(/\.xlsx?$/i.test(f.name)){
      if(window.__v65_readXlsx) window.__v65_readXlsx(f, function(rows2d){ cb(rows2d||[]); });
      else cb([]);
      return;
    }
    var rd=new FileReader();
    rd.onload=function(){
      var parse=window.__v65_csvParse;
      cb(parse?parse(String(rd.result)):[]);
    };
    rd.onerror=function(){ cb([]); };
    rd.readAsText(f);
  }

  /* ---------- combined multi-file preview ---------- */
  var FILES_STATE=null;   // last computed preview, kept for the confirm step
  var LAST_DONE_HTML=null; // the "Done." message after a commit, repainted the same way

  /* This app re-runs the FULL render() chain from many independent, unrelated places — a
     dozen+ setInterval pollers scattered across other layers (session watch, nav tagging,
     access-model pass(), team-roster refresh, etc.), none of which know or care about the
     import tab. rImport() (js/16) always regenerates its HTML from scratch with a BLANK
     #finImpOut, so any of those timers firing after a preview or commit-result paints wipes
     it — found live: the preview held its 5-count summary for one instant, then a totally
     unrelated background render() call reset #finImpOut to empty a moment later. Writing the
     preview as a one-off innerHTML write (the first version of this file) is fragile against
     that; repainting FILES_STATE/LAST_DONE_HTML on every render() call (below, in the wrap)
     is the same "survive a re-render" pattern the rest of this codebase already uses for its
     injected cards (v33/v34/v35/v36 etc.) — it makes the preview immune to being wiped by
     code that has never heard of the importer. */
  function paintPersisted(){
    var out=document.getElementById('finImpOut'); if(!out)return;
    if(FILES_STATE) renderCombinedPreview(FILES_STATE);
    else if(LAST_DONE_HTML) out.innerHTML=LAST_DONE_HTML;
  }

  function renderCombinedPreview(results){
    FILES_STATE=results;
    var totals={isNew:0,updated:0,unchanged:0,excludedByRule:0,needsLinking:0};
    var rowsHtml=results.map(function(r){
      if(!r.recognized){
        return '<div class="card" style="margin-top:8px;padding:12px 14px">'+
          '<b>'+esc(r.name)+'</b> — '+fl('not recognized','غير معروف')+'<br>'+
          '<span style="font-size:11.5px;color:var(--muted)">'+fl('Columns found','الأعمدة الموجودة')+': '+esc((r.header||[]).join(', ') || '—')+'</span><br>'+
          '<span style="font-size:11.5px;color:var(--muted)">'+fl('No field mapping yet — teach-once is not built in this round; nothing was written for this file.','لا يوجد تعيين للحقول بعد — هذه الخطوة لم تُبنَ بعد؛ لم يُكتب شيء لهذا الملف.')+'</span>'+
        '</div>';
      }
      totals.isNew+=r.counts.isNew; totals.updated+=r.counts.updated; totals.unchanged+=r.counts.unchanged;
      totals.needsLinking+=r.counts.needsLinking;
      var exclLine;
      if(r.hasClientColumn===false){
        exclLine='<span style="color:#B54708">'+fl('cannot be checked — this file carries no client','لا يمكن التحقق — هذا الملف لا يحتوي على عميل')+'</span>';
      } else {
        totals.excludedByRule+=r.counts.excludedByRule;
        exclLine=String(r.counts.excludedByRule)+(r.excludedDetail&&r.excludedDetail.clientExcludedDetail&&r.excludedDetail.clientExcludedDetail.length
          ? (' — '+esc(r.excludedDetail.clientExcludedDetail.map(function(d){return d.name+' (#'+d.clientId+(d.reason?(': '+d.reason):'')+')';}).join('; ')))
          : '');
      }
      return '<div class="card" style="margin-top:8px;padding:12px 14px">'+
        '<b>'+esc(r.name)+'</b> — '+esc(r.label)+'<br>'+
        '<div style="font-size:12.5px;line-height:1.9;margin-top:4px">'+
          fl('New','جديد')+' <b>'+r.counts.isNew+'</b> · '+
          fl('Updated','مُحدَّث')+' <b>'+r.counts.updated+'</b> · '+
          fl('Unchanged','بدون تغيير')+' <b>'+r.counts.unchanged+'</b> · '+
          fl('Excluded by rule','مستبعد بحسب القاعدة')+' <b>'+exclLine+'</b> · '+
          fl('Needs linking','بحاجة لربط')+' <b>'+r.counts.needsLinking+'</b>'+
        '</div>'+
      '</div>';
    }).join('');

    var recognizedCount=results.filter(function(r){return r.recognized;}).length;
    var writeCount=totals.isNew+totals.updated;
    var h='<div style="font-size:13px;line-height:1.7">'+
      '<b>'+fl('Files dropped: ','الملفات المُسقطة: ')+results.length+' · '+fl('recognized: ','معروف: ')+recognizedCount+'</b>'+
      rowsHtml+
      (writeCount?('<button class="btn pri sm" style="margin-top:10px" onclick="v65Commit()">'+fl('Confirm import — ','تأكيد الاستيراد — ')+totals.isNew+' '+fl('new','جديد')+', '+totals.updated+' '+fl('updated','محدَّث')+'</button>'):'')+
    '</div>';
    document.getElementById('finImpOut').innerHTML=h;
  }

  /* Look the element up live and also remember the HTML in LAST_DONE_HTML, repainted by
     paintPersisted() on every render() — a captured element reference goes stale the moment
     any of this app's many unrelated background renders rebuilds the import tab mid-commit
     (the insert/update loop below is several HTTP round trips long), same reasoning as the
     preview fix above. */
  function paintDone(html){ LAST_DONE_HTML=html; var out=document.getElementById('finImpOut'); if(out)out.innerHTML=html; }

  window.v65Commit=function(){
    if(!FILES_STATE)return;
    var toInsert=[],toUpdate=[];
    FILES_STATE.forEach(function(r){ if(!r.recognized)return; toInsert=toInsert.concat(r.pendingInsert||[]); toUpdate=toUpdate.concat(r.pendingUpdate||[]); });
    FILES_STATE=null;
    paintDone('<div style="font-size:13px">'+fl('Importing ','جارٍ الاستيراد ')+(toInsert.length+toUpdate.length)+' '+fl('rows…','صف…')+'</div>');
    var c=fc(); var errs=[];
    function doInsert(cb){
      if(!toInsert.length)return cb();
      var i=0;
      (function next(){
        if(i>=toInsert.length)return cb();
        var batch=toInsert.slice(i,i+50); i+=50;
        c.from('finance_invoices').insert(batch).then(function(r){ if(r.error)errs.push(r.error.message); next(); });
      })();
    }
    function doUpdate(cb){
      if(!toUpdate.length)return cb();
      var i=0;
      (function next(){
        if(i>=toUpdate.length)return cb();
        var batch=toUpdate.slice(i,i+50); i+=50;
        // upsert on the primary key IS an update-in-place for a row whose id already exists —
        // this is the "match on natural key, write in place" rule, not a fresh insert.
        c.from('finance_invoices').upsert(batch,{onConflict:'id'}).then(function(r){ if(r.error)errs.push(r.error.message); next(); });
      })();
    }
    doInsert(function(){
      doUpdate(function(){
        paintDone('<div style="font-size:13px;color:'+(errs.length?'#D92D20':'#0F6E56')+'"><b>'+fl('Done.','تم.')+'</b> '+
          fl('Imported ','تم استيراد ')+toInsert.length+' '+fl('new, updated ','جديد، وتحديث ')+toUpdate.length+'.'+
          (errs.length?(' '+fl('Errors: ','أخطاء: ')+esc(errs.slice(0,5).join('; '))):'')+
        '</div>');
        FIN.rows=null; finLoad();
      });
    });
  };

  /* ---------- multi-file input + drop wiring ---------- */
  function processFileList(files){
    var list=Array.prototype.slice.call(files||[]);
    if(!list.length)return;
    document.getElementById('finImpOut').innerHTML='<div style="font-size:13px">'+fl('Reading ','جارٍ القراءة ')+list.length+' '+fl('file(s)…','ملف(ات)…')+'</div>';
    var results=[], done=0;
    list.forEach(function(f){
      readOneFile(f, function(rows2d){
        routeFile(f.name, rows2d, function(r){ results.push(r); done++; if(done===list.length) renderCombinedPreview(results); });
      });
    });
  }

  var _rf65=window.render;
  window.render=function(){
    var out=_rf65.apply(this,arguments);
    try{
      if(typeof current==='undefined'||current!=='finance'||!window.FIN||FIN.tab!=='import')return out;
      var inp=document.getElementById('finFile');
      if(inp&&!inp.multiple){
        inp.multiple=true;
        inp.onchange=function(){ if(inp.files&&inp.files.length)processFileList(inp.files); };
        // the "Check file" button already calls finParse(); redirect it to the multi-file path
        var btn=[...document.querySelectorAll('#view button')].find(function(b){return /finParse\(\)/.test(b.getAttribute('onclick')||'');});
        if(btn) btn.setAttribute('onclick','v65CheckFiles()');
      }
      var dz=document.getElementById('finDrop');
      if(dz&&!dz.__v65){
        dz.__v65=1;
        // Replace, not append: the existing listener (js/16) only ever takes the FIRST
        // dropped file into a single-file input and calls the old single-file finParse().
        // Cloning strips that listener so dropping five files at once actually reads all
        // five, instead of racing the old handler for control of #finFile.
        var clean=dz.cloneNode(true);
        dz.parentNode.replaceChild(clean,dz);
        clean.__v65=1;
        clean.innerHTML='⬇ '+fl('Drop one or more Direct Payments exports here (Excel or CSV) — each routes itself by its columns','أفلت هنا ملف تصدير واحد أو أكثر من Direct Payments (إكسل أو CSV) — يتم توجيه كل ملف تلقائيًا حسب أعمدته');
        clean.onclick=function(){ var i=document.getElementById('finFile'); if(i)i.click(); };
        clean.addEventListener('dragover',function(e){e.preventDefault();clean.style.borderColor='#F47A1F';clean.style.background='#FFF3EC';});
        clean.addEventListener('dragleave',function(){clean.style.borderColor='#C9CDD6';clean.style.background='';});
        clean.addEventListener('drop',function(e){
          e.preventDefault(); clean.style.borderColor='#C9CDD6'; clean.style.background='';
          var fl2=e.dataTransfer&&e.dataTransfer.files; if(!fl2||!fl2.length)return;
          processFileList(fl2);
        });
      }
      // Repaint whatever preview/commit-result is current EVERY time — see paintPersisted()'s
      // own comment for why: this tab gets rebuilt from scratch by render() calls that have
      // nothing to do with the importer, and rImport() always emits a blank #finImpOut.
      paintPersisted();
    }catch(e){ if(window.console)console.warn('[v65] wire',e); }
    return out;
  };
  window.v65CheckFiles=function(){ var inp=document.getElementById('finFile'); if(inp&&inp.files&&inp.files.length)processFileList(inp.files); else { var m=fl('Choose one or more files first.','اختر ملفًا واحدًا أو أكثر أولاً.'); if(typeof toast==='function')toast(m); else alert(m); } };

  console.info('%c[v65-router] universal importer — signature router + five-count preview loaded','color:#B54708;font-weight:700');
}catch(e){ if(window.console)console.warn('[v65-router] init',e); }})();
