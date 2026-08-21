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
     • An unrecognised signature shows its own columns and stops — it does NOT guess. It CAN
       be taught, once (see TEACH-ONCE below), rather than guessed at.

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
     2. Invoice Export is 544,541 rows across 66 runs — see CHUNKED READING below, built and
        verified 2026-08-21 after the owner's independent test flagged that a single
        FileReader pass would not survive a real drop of this file.
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

   WHAT'S ACTUALLY WIRED. Exactly one signature has real, verified ROW-LEVEL BUSINESS LOGIC:
   invoice_export (Direct Payments' own Invoice Export, already parsed correctly by js/41 —
   reused here via its exposed __v65_* functions, not reimplemented — twin pairing, wallet/
   verification/client exclusions, the fee-pair math all stay owned by js/41, unchanged).
   Every other CATALOGUE entry is recorded by name/metadata only; this importer will never
   fabricate a signature or a business rule for a file it has never seen a real header from.

   CHUNKED READING (2026-08-21, owner-verified live). 544,541 rows will not survive one
   FileReader pass into memory as a single string plus a single parseDP() call over the whole
   thing — confirmed by the owner testing this file directly, matching this file's own
   original flag that chunking "becomes necessary." Every CSV drop — not just large ones, so
   the path is exercised by ordinary use instead of sitting untested until the day someone
   drops the 544k-row file — is now read via streamCsvFile(): file.slice() chunks decoded
   through a streaming TextDecoder (correct across multi-byte UTF-8 boundaries — Arabic
   customer names split across a chunk boundary decode correctly, unlike naively calling
   FileReader.readAsText on raw byte slices) fed into a resumable character-automaton CSV
   parser (the exact same automaton as js/41's csvParse64, just callback-driven instead of
   building one giant array). Rows are buffered into batches that are NEVER cut in the middle
   of one invoice's item rows (a batch only flushes right before the next 'invoice'/
   'credit_note' row, once the buffer has reached PROCESS_BATCH_ROWS) — each batch runs
   through the exact same parseDP()/toRows() js/41 owns, one small array at a time, so peak
   memory is one batch's worth of invoice objects, not 544,541 of them. The tab yields to the
   event loop between chunk reads so it stays responsive instead of freezing while the import
   runs. One known, honest limitation: js/41's intra-file "twin pairing" (a numbered invoice
   matched to an unnumbered transaction of the same customer+total) only pairs within whatever
   rows are in ONE parseDP() call — a twin split across two different batches won't be caught
   here, same way it already wasn't caught by js/65's non-chunked path (which never ran js/41's
   own cross-import twin-supersede step either — see runDP() in js/41 — a pre-existing gap in
   this file, not introduced by chunking). XLSX is NOT chunked — SheetJS reads the whole
   workbook into memory in one call and true row-streaming would need a different, unverified
   library; flagged honestly rather than pretending to solve it.

   TEACH-ONCE MAPPING (2026-08-21, built this round). When a file's signature isn't
   recognised, "Teach this file's columns" opens a one-time prompt: match this file's actual
   header names to the handful of fields the importer needs (invoice/reference number,
   customer name, date, total — required; a few more, optional). The mapping is saved in
   DB.settings.importSignatureMappings, keyed by the file's signature (its sorted header set,
   same order-independent idea detectSignature() already uses) — the next file with that exact
   header set is recognised and imported automatically, no re-asking. This does NOT reproduce
   Direct Payments' own business rules (fee-pair math, twin pairing, wallet/verification
   exclusions) for an unknown format — those are specific to how Direct Payments' own exports
   are shaped and this session has never seen the other ten real headers to know they even
   apply the same way. What it DOES do: build one finance_invoices row per source row using
   only the mapped columns, apply the SAME client-exclusion rule every other import path
   applies (Takamol etc. — never optional), and run the mapped rows through the same
   natural-key diff / five-count preview / insert-or-update pipeline invoice_export already
   uses. Unmapped optional fields get an honest, clearly-labelled default (pending / not yet
   received) rather than a guessed business rule — the mapping modal says so. This is enough
   to stop the other ten signatures being a hard blocker for a determined user with a real
   file in hand, while never fabricating Direct-Payments-specific logic this session has not
   verified. */
(function(){try{
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function m0(n){ return Math.round(Number(n)||0).toLocaleString('en-US'); }
  // Safe for dropping into onclick="v65OpenTeach('...')" regardless of what characters a
  // dropped file's OWN NAME happens to contain — escape for the single-quoted JS string
  // literal first, then for the double-quoted HTML attribute it sits inside.
  function attrJsString(s){
    return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")
      .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

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

  /* ================= shared diff / preview state — used by BOTH invoice_export and a
     teach-once mapped file, so there is exactly one "new vs updated vs unchanged, needs
     linking" implementation, not two that could quietly drift apart. ================= */
  function initState(){
    var existingByNo={};
    ((window.FIN&&FIN.rows)||[]).forEach(function(r){ if(r.invoice_no) existingByNo[r.invoice_no]=r; });
    return {
      existingByNo:existingByNo,
      linkByGroup:(window.FIN&&FIN.linkByGroup)||{},
      isNew:[], updated:[], unchangedCount:0,
      excludedByRule:0, excludedDetail:{wallet:0,verif:0,clientExcluded:0,clientExcludedDetail:[]},
      needsLinking:0
    };
  }
  var CMP_FIELDS=['total_incl_vat_sar','integrity_status','amount_received_sar','amount_remaining_sar','revenue_sar','cost_sar','profit_sar'];
  function rowDiffers(oldR,newR){
    return CMP_FIELDS.some(function(f){
      var a=oldR[f], b=newR[f];
      if(typeof a==='number'||typeof b==='number') return Math.abs((Number(a)||0)-(Number(b)||0))>0.01;
      return String(a==null?'':a)!==String(b==null?'':b);
    });
  }
  function isLinked(r,linkByGroup){ var l=linkByGroup[r.client_group]; return !!(l&&(l.business_id||l.is_client===false)); }
  function mergeRowsIntoState(rows,state){
    rows.forEach(function(r){
      var ex=state.existingByNo[r.invoice_no];
      if(!ex){ state.isNew.push(r); if(!isLinked(r,state.linkByGroup))state.needsLinking++; }
      else if(rowDiffers(ex,r)){ var u=Object.assign({},r,{id:ex.id}); state.updated.push(u); if(!isLinked(u,state.linkByGroup))state.needsLinking++; }
      else { state.unchangedCount++; }
    });
  }
  function finalizeState(state,sigKey,hasClientColumn){
    return {
      sigKey:sigKey,
      counts:{ isNew:state.isNew.length, updated:state.updated.length, unchanged:state.unchangedCount,
        excludedByRule:state.excludedByRule, needsLinking:state.needsLinking },
      excludedDetail:state.excludedDetail,
      hasClientColumn:hasClientColumn,
      pendingInsert:state.isNew, pendingUpdate:state.updated
    };
  }

  /* ---------- invoice_export: the one signature with real, verified row-level rules ---------- */
  // one batch (may be the whole file, for xlsx/small drops, or one chunk-boundary-aligned
  // slice of it, for the streamed CSV path below) through js/41's own proven parser.
  function processInvoiceBatch(rows2dBatch, state){
    var parseDP=window.__v65_parseDP, toRows=window.__v65_toRowsDP, exclusions=window.__v65_exclusionCounts;
    if(!parseDP||!toRows) throw new Error('js/41 not loaded'); // should never happen, but never crash silently
    var parsed=parseDP(rows2dBatch);
    // parseDP() resets its wallet/verif/clientExcluded counters at the START of every call
    // (see js/41) — each batch's counts must be ADDED to the running total, never overwrite it.
    var xc=exclusions?exclusions():{wallet:0,verif:0,clientExcluded:0,clientExcludedDetail:[]};
    state.excludedByRule+=xc.wallet+xc.verif+xc.clientExcluded;
    state.excludedDetail.wallet+=xc.wallet; state.excludedDetail.verif+=xc.verif; state.excludedDetail.clientExcluded+=xc.clientExcluded;
    state.excludedDetail.clientExcludedDetail=state.excludedDetail.clientExcludedDetail.concat(xc.clientExcludedDetail||[]);
    mergeRowsIntoState(toRows(parsed), state);
  }

  /* ================= teach-once: map an unrecognised file's columns, once ================= */
  var TARGET_FIELDS=[
    {key:'invoice_no',          label:['Invoice / reference number','رقم الفاتورة / المرجع'], required:true},
    {key:'customer_raw_name',   label:['Customer / company name','اسم العميل / الشركة'],       required:true},
    {key:'invoice_date',        label:['Invoice date','تاريخ الفاتورة'],                        required:true},
    {key:'total_incl_vat_sar',  label:['Total amount (SAR)','الإجمالي (ريال)'],                 required:true},
    {key:'zatca_dpin',          label:['Tax invoice / ZATCA number','رقم الفاتورة الضريبية'],   required:false},
    {key:'products',            label:['Service / product','الخدمة / المنتج'],                  required:false},
    {key:'cost_sar',            label:['Cost (SAR)','التكلفة (ريال)'],                          required:false},
    {key:'profit_sar',          label:['Profit (SAR)','الربح (ريال)'],                          required:false},
    {key:'branch',              label:['Branch','الفرع'],                                       required:false},
    {key:'notes',               label:['Notes','ملاحظات'],                                      required:false}
  ];
  var MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
  function signatureKey(header){ return (header||[]).map(function(h){return String(h||'').trim();}).filter(Boolean).sort().join('|'); }
  function getMappings(){ try{ return (DB.settings&&DB.settings.importSignatureMappings)||[]; }catch(_){ return []; } }
  function getLearnedMapping(header){
    var key=signatureKey(header); if(!key)return null;
    var list=getMappings();
    for(var i=0;i<list.length;i++){ if(list[i].key===key) return list[i]; }
    return null;
  }
  function moneyG(x){ if(typeof x==='number')return x; return parseFloat(String(x==null?'':x).replace(/[^\d.\-]/g,''))||0; }
  function isoDateG(s){
    s=String(s||'').trim();
    var m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(m)return m[3]+'-'+m[2]+'-'+m[1];
    m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m)return m[0];
    return null;
  }
  // one source row + the learned column mapping → one finance_invoices-shaped candidate row.
  // Returns null (skip, silently — there is nothing to key or write) only when the row has no
  // usable invoice/reference number, since that is the natural key everything else keys off.
  function buildGenericRow(row,header,mapping){
    function get(field){ var col=mapping[field]; if(!col)return null; var ix=header.indexOf(col); return ix>=0?row[ix]:null; }
    var invoiceNo=String(get('invoice_no')||'').trim(); if(!invoiceNo)return null;
    var custRaw=String(get('customer_raw_name')||'').trim();
    var date=isoDateG(get('invoice_date'));
    var total=moneyG(get('total_incl_vat_sar'));
    var costField=get('cost_sar'); var cost=costField!=null?moneyG(costField):0;
    var profitField=get('profit_sar'); var profit=profitField!=null?moneyG(profitField):Math.round((total-cost)*100)/100;
    var svc=String(get('products')||'').trim()||null;
    return {
      invoice_no:invoiceNo, zatca_dpin:String(get('zatca_dpin')||'').trim()||null,
      client_group:custRaw, customer_raw_name:custRaw,
      invoice_date:date,
      month:date?MONTH_NAMES[+date.slice(5,7)-1]:null,
      quarter:date?('Q'+(Math.floor((+date.slice(5,7)-1)/3)+1)):null,
      products:svc, service_type:svc, record_type:'b2b',
      total_incl_vat_sar:total, wallet_portion_sar:0, revenue_sar:profit,
      cost_sar:cost, profit_sar:profit,
      vat_sar:0, // this method does not know the file's VAT breakdown — recorded as unknown (0), never guessed at 15%
      discount_sar:0,
      // no payment-status column is asked for in the mapping (kept deliberately simple) — a
      // mapped row is honestly "not yet reconciled" until someone updates it, not assumed paid.
      amount_received_sar:0, amount_remaining_sar:total,
      integrity_status:'pending',
      exclusion_reason:null, notes:String(get('notes')||'').trim()||null,
      source_batch:'mapped-import-'+new Date().toISOString().slice(0,10),
      line_no:1, branch:String(get('branch')||'').trim()||null, salesman:null,
      revenue_way:'invoice', transaction_ref:null
    };
  }
  function processGenericBatch(rawRows, header, mapping, state){
    var candidates=[];
    rawRows.forEach(function(row){
      var built=buildGenericRow(row,header,mapping); if(!built)return;
      var xhit=(typeof window.finExclusionCheck==='function')?window.finExclusionCheck(built.customer_raw_name):null;
      if(xhit){
        state.excludedByRule++; state.excludedDetail.clientExcluded++;
        state.excludedDetail.clientExcludedDetail.push({name:built.customer_raw_name,clientId:xhit.clientId,reason:xhit.reason});
        return;
      }
      candidates.push(built);
    });
    mergeRowsIntoState(candidates, state);
  }

  var PENDING_UNKNOWN={}; // fileKey -> {file, header, rows2d (present only if already fully read)}
  function fileKeyOf(f){ return f.name+'|'+f.size+'|'+(f.lastModified||''); }

  window.v65OpenTeach=function(fileKey){
    var pend=PENDING_UNKNOWN[fileKey]; if(!pend)return;
    if(typeof canFinEdit==='function'&&!canFinEdit())return;
    var header=pend.header;
    var optsHtml='<option value="">'+fl('— not present —','— غير موجود —')+'</option>'+
      header.map(function(h){return '<option value="'+esc(h)+'">'+esc(h)+'</option>';}).join('');
    var fieldsHtml=TARGET_FIELDS.map(function(f){
      return '<div class="field"><label>'+fl(f.label[0],f.label[1])+(f.required?' *':'')+'</label>'+
        '<select id="v65t_'+f.key+'">'+optsHtml+'</select></div>';
    }).join('');
    openModal(fl('Teach this file’s columns','عيّن أعمدة هذا الملف'),
      '<div class="ch-sub">'+fl('Match each field to one of this file\u2019s columns, once. Saved and reused automatically for every future file with these exact columns — never asked again for this shape. Fields left "not present" import as pending / not yet reconciled, never a guessed amount.','طابق كل حقل مع أحد أعمدة هذا الملف، مرة واحدة. يُحفظ ويُستخدم تلقائيًا مع كل ملف مستقبلي بنفس هذه الأعمدة — لن يُطلب منك ذلك مجددًا لهذا الشكل. الحقول التي تُترك "غير موجود" تُستورد كمعلّقة/غير مُسواة، وليست مبلغًا مُخمَّنًا.')+'</div>'+
      '<div class="grid2">'+fieldsHtml+'</div>',
      function(){
        var mapping={}, missing=[];
        TARGET_FIELDS.forEach(function(f){
          var v=val('v65t_'+f.key);
          if(v)mapping[f.key]=v; else if(f.required)missing.push(fl(f.label[0],f.label[1]));
        });
        if(missing.length){ alert(fl('Required: ','مطلوب: ')+missing.join(', ')); return false; }
        DB.settings=DB.settings||{}; DB.settings.importSignatureMappings=DB.settings.importSignatureMappings||[];
        DB.settings.importSignatureMappings.push({
          key:signatureKey(header), header:header, mapping:mapping,
          addedBy:(typeof meName==='function'?meName():'Unknown'), addedAt:new Date().toISOString()
        });
        if(typeof save==='function')save();
        reprocessNowMapped(fileKey, mapping);
      });
  };

  function reprocessNowMapped(fileKey, mapping){
    var pend=PENDING_UNKNOWN[fileKey]; if(!pend)return;
    var idx=RESULT_INDEX[fileKey]; if(idx==null)return;
    var header=pend.header;
    // Capture the array OBJECT itself, not just the module-level RESULTS variable — a large
    // file's re-stream below is asynchronous and can run for a while; if the user drops
    // something new in the meantime, RESULTS gets reassigned to a different array, and this
    // reprocess must stop touching/repainting the one it started with rather than clobbering
    // whatever the user is now looking at (same reasoning as GENERATION in processFileList).
    var myResults=RESULTS;
    function repaint(){ if(RESULTS===myResults) renderCombinedPreview(myResults); }
    if(pend.rows2d){
      // small file, already fully read — the fast, synchronous path.
      var state=initState();
      processGenericBatch(pend.rows2d.slice(1), header, mapping, state);
      myResults[idx]=Object.assign({name:pend.file.name, recognized:true, label:fl('Mapped file','ملف مُعيَّن')}, finalizeState(state,signatureKey(header),true));
      delete PENDING_UNKNOWN[fileKey];
      repaint();
      return;
    }
    // large file — only the header was read (streaming aborted early); re-stream it now that
    // a mapping exists, this time reading the whole thing.
    myResults[idx]={name:pend.file.name, recognized:false, header:header, streaming:true, rowsRead:0};
    repaint();
    var state2=initState();
    var buf=[], totalRows=0;
    streamCsvFile(pend.file, {
      onRow:function(row,isFirst){
        if(isFirst)return; // header — mapping already known, nothing to decide
        totalRows++;
        buf.push(row);
        if(buf.length>=GENERIC_BATCH_ROWS){ processGenericBatch(buf,header,mapping,state2); buf=[]; }
      },
      afterChunk:function(next){
        myResults[idx].rowsRead=totalRows;
        repaint();
        setTimeout(next,0);
      },
      onDone:function(){
        if(buf.length){ processGenericBatch(buf,header,mapping,state2); buf=[]; }
        myResults[idx]=Object.assign({name:pend.file.name, recognized:true, label:fl('Mapped file','ملف مُعيَّن')}, finalizeState(state2,signatureKey(header),true));
        delete PENDING_UNKNOWN[fileKey];
        repaint();
      },
      onError:function(e){
        myResults[idx]={name:pend.file.name, recognized:false, header:header, err:String(e&&e.message||e)};
        repaint();
      }
    });
  }

  /* ================= streaming CSV reader — the chunked-reading fix ================= */
  // A resumable version of js/41's own csvParse64 automaton: feed() can be called many times
  // with successive chunks of text and keeps its quote/field/row state across calls, instead
  // of requiring the whole file's text already in memory as one string.
  function makeCsvStreamParser(onRow){
    var cur='', row=[], inQ=false, firstChunk=true;
    function feed(text){
      if(firstChunk){ text=text.replace(/^\ufeff/,''); firstChunk=false; }
      for(var i=0;i<text.length;i++){
        var ch=text[i];
        if(inQ){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else inQ=false; } else cur+=ch; }
        else if(ch==='"')inQ=true;
        else if(ch===','){row.push(cur);cur='';}
        else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n')i++; row.push(cur);cur=''; if(row.length>1||row[0]!=='')onRow(row); row=[]; }
        else cur+=ch;
      }
    }
    function finish(){
      if(cur!==''||row.length)row.push(cur);
      if(row.length>1||(row.length===1&&row[0]!==''))onRow(row);
      row=[];cur='';
    }
    return {feed:feed,finish:finish};
  }
  var READ_CHUNK_BYTES=2*1024*1024; // 2MB per file.slice()/arrayBuffer() read
  // file.slice() + a streaming TextDecoder handles multi-byte UTF-8 characters split across a
  // chunk boundary correctly (it holds back an incomplete trailing byte sequence to prepend to
  // the next chunk) — unlike calling FileReader.readAsText on raw byte slices, which does not.
  function streamCsvFile(file, opts){
    var decoder=new TextDecoder('utf-8');
    var offset=0, rowIndex=0, aborted=false;
    var parser=makeCsvStreamParser(function(row){ opts.onRow(row, rowIndex===0); rowIndex++; });
    function step(){
      if(aborted)return;
      if(offset>=file.size){
        try{ parser.finish(); }catch(e){ opts.onError&&opts.onError(e); return; }
        opts.onDone&&opts.onDone();
        return;
      }
      var slice=file.slice(offset, offset+READ_CHUNK_BYTES);
      offset+=READ_CHUNK_BYTES;
      slice.arrayBuffer().then(function(buf){
        if(aborted)return;
        try{ parser.feed(decoder.decode(buf,{stream:true})); }catch(e){ opts.onError&&opts.onError(e); return; }
        if(aborted)return;
        if(opts.afterChunk) opts.afterChunk(step); else step();
      }).catch(function(e){ opts.onError&&opts.onError(e); });
    }
    step();
    return { abort:function(){ aborted=true; } };
  }

  var PROCESS_BATCH_ROWS=5000; // physical rows buffered before flushing an invoice_export batch
  var GENERIC_BATCH_ROWS=5000; // rows buffered before flushing a mapped-file batch

  /* routes one CSV File through the streamed pipeline: peek the header, decide invoice_export
     vs a learned mapping vs "not recognised — offer to teach it" (aborting the read early in
     that last case, so a huge unrecognised file is never fully read for nothing), then batch
     and process the body accordingly. */
  function routeCsvStreamed(f, fileKey, onProgress, done){
    var header=null, mode=null, mapping=null, state=null, buf=[], ctrl=null, finished=false, typeColIdx=-1, totalRows=0;
    ctrl=streamCsvFile(f, {
      onRow:function(row,isFirst){
        if(isFirst){
          header=row;
          var sig=detectSignature(header);
          if(sig&&sig.key==='invoice_export'){ mode='invoice_export'; state=initState(); typeColIdx=header.indexOf('Type'); return; }
          var learned=getLearnedMapping(header);
          if(learned){ mode='mapped'; mapping=learned.mapping; state=initState(); return; }
          mode='unknown';
          PENDING_UNKNOWN[fileKey]={file:f, header:header, rows2d:null};
          finished=true; ctrl.abort();
          done({name:f.name, recognized:false, header:header, needsMapping:true, fileKey:fileKey});
          return;
        }
        totalRows++;
        if(mode==='invoice_export'){
          buf.push(row);
          // Column order isn't guaranteed run to run (see file header) — look the Type column
          // up by the header's own position, never assume it sits at row[0].
          var t=String((typeColIdx>=0?row[typeColIdx]:'')||'').trim();
          if(buf.length>=PROCESS_BATCH_ROWS&&(t==='invoice'||t==='credit_note')){
            var boundary=buf.pop(); // this row starts the NEXT batch — never split an invoice's items
            processInvoiceBatch([header].concat(buf), state);
            buf=[boundary];
          }
        } else if(mode==='mapped'){
          buf.push(row);
          if(buf.length>=GENERIC_BATCH_ROWS){ processGenericBatch(buf,header,mapping,state); buf=[]; }
        }
      },
      afterChunk:function(next){
        if(finished)return;
        if(onProgress) onProgress(totalRows);
        setTimeout(next,0);
      },
      onDone:function(){
        if(finished)return;
        if(!header){ done({name:f.name, recognized:false, header:[], err:fl('Empty file.','ملف فارغ.')}); return; }
        if(mode==='invoice_export'){
          if(buf.length) processInvoiceBatch([header].concat(buf), state);
          done(Object.assign({name:f.name, recognized:true, label:CATALOGUE.invoice_export.label}, finalizeState(state,'invoice_export',true)));
        } else if(mode==='mapped'){
          if(buf.length) processGenericBatch(buf,header,mapping,state);
          done(Object.assign({name:f.name, recognized:true, label:fl('Mapped file','ملف مُعيَّن')}, finalizeState(state,signatureKey(header),true)));
        }
      },
      onError:function(e){ if(!finished) done({name:f.name, recognized:false, header:header||[], err:String(e&&e.message||e)}); }
    });
  }

  /* ---------- xlsx: kept on the existing, proven full-read path (see file header re: why) ----------
     fileKey is passed in from processFileList's fileKeyOf(f) — MUST be the same key
     RESULT_INDEX was built with, or a "Teach this file" click on an xlsx file would look up
     an index that was never stored and silently do nothing. */
  function routeRows2d(name, rows2d, fileKey, done){
    var hdr=(rows2d&&rows2d[0])||[];
    var sig=detectSignature(hdr);
    if(sig&&sig.key==='invoice_export'){
      var state=initState();
      try{ processInvoiceBatch(rows2d,state); }
      catch(e){ done({name:name,recognized:false,header:hdr,err:String(e&&e.message||e)}); return; }
      done(Object.assign({name:name,recognized:true,label:CATALOGUE[sig.catalogueKey].label}, finalizeState(state,'invoice_export',true)));
      return;
    }
    var learned=getLearnedMapping(hdr);
    if(learned){
      var state2=initState();
      processGenericBatch(rows2d.slice(1), hdr, learned.mapping, state2);
      done(Object.assign({name:name,recognized:true,label:fl('Mapped file','ملف مُعيَّن')}, finalizeState(state2,learned.key,true)));
      return;
    }
    PENDING_UNKNOWN[fileKey]={file:null, header:hdr, rows2d:rows2d};
    done({name:name, recognized:false, header:hdr, needsMapping:true, fileKey:fileKey});
  }

  /* ---------- combined multi-file preview ---------- */
  var FILES_STATE=null;   // last computed preview, kept for the confirm step
  var LAST_DONE_HTML=null; // the "Done." message after a commit, repainted the same way
  var RESULTS=null, RESULT_INDEX={}; // live results array + fileKey→index, so teach-once can
                                       // update one file's entry in place after a re-stream

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
    if(RESULTS) renderCombinedPreview(RESULTS);
    else if(LAST_DONE_HTML) out.innerHTML=LAST_DONE_HTML;
  }

  function renderCombinedPreview(results){
    FILES_STATE=results; RESULTS=results;
    var totals={isNew:0,updated:0,unchanged:0,excludedByRule:0,needsLinking:0};
    var rowsHtml=results.map(function(r){
      if(r.streaming){
        return '<div class="card" style="margin-top:8px;padding:12px 14px">'+
          '<b>'+esc(r.name)+'</b> — '+fl('processing…','جارٍ المعالجة…')+' '+m0(r.rowsRead||0)+' '+fl('rows read so far','صف مقروء حتى الآن')+
        '</div>';
      }
      if(!r.recognized){
        return '<div class="card" style="margin-top:8px;padding:12px 14px">'+
          '<b>'+esc(r.name)+'</b> — '+fl('not recognized','غير معروف')+(r.err?(' — '+esc(r.err)):'')+'<br>'+
          '<span style="font-size:11.5px;color:var(--muted)">'+fl('Columns found','الأعمدة الموجودة')+': '+esc((r.header||[]).join(', ') || '—')+'</span>'+
          (r.fileKey?('<br><button class="btn ghost sm" style="margin-top:6px" onclick="v65OpenTeach(\''+attrJsString(r.fileKey)+'\')">'+fl('Teach this file’s columns…','عيّن أعمدة هذا الملف…')+'</button>'):'')+
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
    var stillStreaming=results.some(function(r){return r.streaming;});
    var h='<div style="font-size:13px;line-height:1.7">'+
      '<b>'+fl('Files dropped: ','الملفات المُسقطة: ')+results.length+' · '+fl('recognized: ','معروف: ')+recognizedCount+'</b>'+
      rowsHtml+
      (writeCount&&!stillStreaming?('<button class="btn pri sm" style="margin-top:10px" onclick="v65Commit()">'+fl('Confirm import — ','تأكيد الاستيراد — ')+totals.isNew+' '+fl('new','جديد')+', '+totals.updated+' '+fl('updated','محدَّث')+'</button>'):'')+
    '</div>';
    document.getElementById('finImpOut').innerHTML=h;
  }

  /* Look the element up live and also remember the HTML in LAST_DONE_HTML, repainted by
     paintPersisted() on every render() — a captured element reference goes stale the moment
     any of this app's many unrelated background renders rebuilds the import tab mid-commit
     (the insert/update loop below is several HTTP round trips long), same reasoning as the
     preview fix above. */
  function paintDone(html){ LAST_DONE_HTML=html; RESULTS=null; var out=document.getElementById('finImpOut'); if(out)out.innerHTML=html; }

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
  var GENERATION=0; // bumped on every new drop, so a slow streaming file from an EARLIER drop
                     // can never repaint over a preview the user has already moved on from.
  function processFileList(files){
    var list=Array.prototype.slice.call(files||[]);
    if(!list.length)return;
    document.getElementById('finImpOut').innerHTML='<div style="font-size:13px">'+fl('Reading ','جارٍ القراءة ')+list.length+' '+fl('file(s)…','ملف(ات)…')+'</div>';
    var myGen=++GENERATION;
    var results=[];
    RESULTS=results; RESULT_INDEX={};
    function repaint(){ if(myGen===GENERATION) renderCombinedPreview(results); }
    list.forEach(function(f,idx){
      results.push({name:f.name, recognized:false, header:[], streaming:true, rowsRead:0});
      var fileKey=fileKeyOf(f);
      RESULT_INDEX[fileKey]=idx;
      function finishFile(r){ r.streaming=false; results[idx]=r; repaint(); }
      if(/\.xlsx?$/i.test(f.name)){
        if(window.__v65_readXlsx) window.__v65_readXlsx(f, function(rows2d){ routeRows2d(f.name, rows2d||[], fileKey, finishFile); });
        else finishFile({name:f.name, recognized:false, header:[], err:'Excel reader unavailable'});
        return;
      }
      routeCsvStreamed(f, fileKey, function(rowsRead){ results[idx].rowsRead=rowsRead; repaint(); }, finishFile);
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

  console.info('%c[v65-router] universal importer — chunked reading + teach-once mapping loaded','color:#B54708;font-weight:700');
}catch(e){ if(window.console)console.warn('[v65-router] init',e); }})();
