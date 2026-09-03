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
    corporate_invoices:         {label:'Corporate Invoices',     rows:null,runs:null,isCostSource:false,hasClientColumn:false},
    // 2026-08-24 — the second real cost source, wired as TWO joined files, TWO LEVELS of
    // aggregation. NOT one of the eleven registry exports above and NOT the earlier Corporate
    // Expenses "View Assignments" modal path (abandoned — required a per-invoice iframe read
    // that returned a previous invoice's stale figures under load, caught before any number
    // reached this file). SUPERSEDES the 2026-08-23 single-level version of this same two-file
    // join, which assumed the expense report's own INVOICE # was directly our
    // finance_invoices.invoice_no. Proven wrong the same day, on a real record end to end —
    // see below.
    //
    // THE REAL CHAIN, verified 2026-08-24 on a live example: expense line INVOICE # 1163760881
    // is the TRANSACTION's own reference, not a tax invoice number. That transaction's own
    // INVOICE ISSUING column reads "Issued 1163762432" — 1163762432 IS a real, live
    // finance_invoices row (5,600.00 SAR), matching the transaction's own amount and its single
    // Approved expense line exactly. So: expense lines join to a TRANSACTION (many lines, one
    // transaction), and a transaction joins to a TAX INVOICE via its own "Issued <no>" text
    // (many transactions, one invoice — confirmed on a real 7-transaction group, all issuing
    // into the same invoice). Grouping expense lines by their own INVOICE # directly, as the
    // 2026-08-23 version did, would never have produced a correct number — it would have
    // treated 46 separate transaction-level partial sums as 46 separate (wrong) invoices.
    //
    // FILE 1 — expense_lines_capture. Direct Payments' admin.stats.expense-report
    // (?of_corporate_client=true, 219 corporate rows, one row per expense line) — found by
    // reading the app's own Ziggy route registry rather than guessing URLs, cross-verified
    // against the abandoned modal path on one invoice before trusting it (both independently
    // read 12,247.00 for invoice 1163597647). Its own columns are INVOICE # | AMOUNT (SAR) |
    // STATUS | APPROVAL DATE | MERCHANT. Required (this app's normalized contract, not a raw
    // Direct Payments header): transaction_ref (the report's own INVOICE # column — it IS the
    // transaction's reference, confirmed above, so it is named for what it actually is, not
    // what it looked like on first read), amount_sar, expense_status (this LINE's own
    // Approved/Pending/Cancelled/Under Review — the report's own expense_status URL filter does
    // NOT apply server-side, verified: filtering for Approved still returned
    // Pending/Cancelled/Under Review rows, so filtering happens on this column's actual value,
    // in code, never the query string). Repeated (amount) pairs on one transaction are real,
    // separate expenses (owner's notes, verified: three RateHawk "Hotel Cost" lines, two at an
    // identical amount, three different approval timestamps) — every Approved line is summed,
    // none deduplicated.
    //
    // FILE 2 — expense_gate_capture. /en/admin/corporate_clients/transactions, columns
    // RECEIPT REF. | PRODUCT | AMOUNT (SAR) | INVOICE ISSUING | CREATED AT | EXPENSE STATUS
    // (153 rows, vs 219 expense lines — the expected many-lines-to-one-transaction shape, not a
    // mismatch; "zero orphans," verified by the capturer's own page-count math, 100+100+19 and
    // 100+53, both exact). Required: transaction_ref (RECEIPT REF. — the SAME number space as
    // file 1's transaction_ref, now proven on a real matching pair, not just believed),
    // txn_expense_status (EXPENSE STATUS, verbatim), invoice_issuing_raw (INVOICE ISSUING,
    // verbatim — e.g. "Issued 1163762432" or "Need to issue"; parsed in code below via
    // parseInvoiceIssuing(), never pre-parsed by the capture step, so the parse itself is
    // testable and survives past the session that captured the file — P1).
    //
    // ⚠ EXPENSE STATUS CORRECTION, verified 2026-08-24: blank is NOT "unknown" or "not ready" —
    // it IS the "Issued" half of the Ready/Issued gate (owner's Aug 20/21 notes). Confirmed:
    // blank always co-occurs with invoice_issuing_raw = "Issued <no>" (45 of the first 100
    // transactions read blank, all of them already issued); the on-screen badge itself renders
    // with no text at all (class badge-light-warning, empty). "Ready" means expenses are
    // complete but no tax invoice yet; blank means the tax invoice has already been issued —
    // BOTH mean the transaction's own expenses are done. Treating blank as not-ready (the
    // 2026-08-23 version's READY_STATUSES=['ready','issued'] check, which blank never matched)
    // would have dropped nearly half of all transactions and produced a clean-looking, badly
    // understated cost — caught before it ever ran against real data.
    //
    // THE JOIN happens in this file, in code, never by hand, in two levels — see
    // resolveExpenseJoin() below for the full resolution and every guard it applies:
    //   Level 1 — sum this transaction's own Approved expense lines (file 1, keyed by
    //             transaction_ref).
    //   Level 2 — group transactions by the tax invoice their invoice_issuing_raw parses to
    //             (file 2), and sum Level 1 across every transaction in that group — but ONLY
    //             when every single contributing transaction is individually clean (status
    //             genuinely done, lines present, lines well-formed, no self-conflicting gate
    //             row). One dirty transaction holds back the WHOLE invoice's write, reported
    //             loudly with which transaction and why — never a partial sum from only the
    //             transactions that happened to be clean, which would silently understate cost
    //             exactly as the whole path exists to prevent.
    // A transaction not yet issued into any invoice ("Need to issue") has nothing to attribute
    // its cost to yet — reported as waiting, never guessed at. EXPENSE_JOIN persists for the
    // page's lifetime (not reset per drop), so the two files may be dropped together or in two
    // separate sessions — either way.
    expense_lines_capture:      {label:'Expense Report — lines',                    rows:null,runs:null,isCostSource:true, hasClientColumn:true},
    expense_gate_capture:       {label:'Expense Report — transaction status (join)', rows:null,runs:null,isCostSource:false,hasClientColumn:false},
    // 2026-08-24 — the third real source: /en/admin/corporate_clients/invoices, "the owner's
    // 'final phase' source" (oversight session's words), 65 tax invoices, columns
    // INVOICE NUMBER (carries the tax code inline on a second line) | ISSUE DATE | DUE DATE |
    // AMOUNT (SAR) | STATUS. Required (normalized contract): invoice_no, tax_code,
    // total_incl_vat_sar, invoice_status, issue_date.
    //
    // THE OWNER'S RULE, applied literally: an invoice's tax code and total are only trusted
    // automatically once it has BOTH a real tax code AND a status other than "Waiting for
    // Issuing" — anything short of that goes to manual review, reported, never guessed at.
    // Never inserts a new row — this signature carries no client name at all, and
    // finance_invoices.client_group is NOT NULL, so there is nothing to create a brand-new row
    // WITH; an invoice_no with no existing match is reported as needing manual review, exactly
    // like every other "not a live invoice" case in this importer, never fabricated.
    //
    // ⚠ THE TTIN/DPIN TRAP, caught by the oversight session BEFORE it shipped — this is the
    // Takamol mistake's shape happening again, on a different column, months after the first
    // one: a first-pass regex matched only DPIN- codes and reported 21 invoices as having no
    // tax code at all. Wrong — 10 of those 21 carry TTIN- codes instead, and all ten are
    // Takamol invoices already `integrity_status='excluded'` in finance_invoices (the five
    // largest invoices in the whole system, every one over a million SAR — total 6,724,291.12).
    // An import of "all finalised tax invoices" done on tax-code-presence alone would have
    // silently re-imported the entire excluded Takamol book. TTIN appears to BE the Takamol
    // invoice series (10 for 10 on this sample) — but that is a hypothesis from one sample, not
    // a proven rule, so this signature does NOT special-case the TTIN prefix at all. It gates
    // on `finExclusionCheck()` against the EXISTING row's own client_group, the same exclusion
    // list every other import path already uses — so exclusion holds regardless of what any
    // future tax-code prefix turns out to look like. Regression-guarded, including a sabotage
    // case (a would-otherwise-qualify TTIN row targeting the seeded Takamol fixture, asserted
    // to never be written), by scripts/qa/probe-tax-invoice-capture.mjs.
    tax_invoice_capture:        {label:'Tax Invoices — final phase', rows:null,runs:null,isCostSource:false,hasClientColumn:true}
  };
  window.v65Catalogue=CATALOGUE;

  /* A signature is the exact set of header names a file must ALL carry — order-independent,
     since Direct Payments' own column order isn't stable run to run, only presence is. Add
     an entry the instant a real header sample is captured; nothing here is ever guessed. */
  var SIGNATURES=[
    { key:'invoice_export', catalogueKey:'invoice_export',
      requiredColumns:['Type','Invoice Reference #','Customer Name','Item Is Taxable'] },
    { key:'expense_lines_capture', catalogueKey:'expense_lines_capture',
      requiredColumns:['transaction_ref','amount_sar','expense_status'] },
    { key:'expense_gate_capture', catalogueKey:'expense_gate_capture',
      requiredColumns:['transaction_ref','txn_expense_status','invoice_issuing_raw'] },
    { key:'tax_invoice_capture', catalogueKey:'tax_invoice_capture',
      requiredColumns:['invoice_no','tax_code','total_incl_vat_sar','invoice_status','issue_date'] }
  ];
  // 2026-09-02 (landmine L6, shared since watch cycle 5): a binary file (PDF, Excel, zip) whose
  // bytes were read as text — used by BOTH the streamed CSV route and the pre-parsed rows route,
  // so a pasted/scripted drop is refused the same way a dragged file is.
  var BINARY_MSG_EN='Header does not match any known export — this is a binary file (PDF, Excel or zip), not a text CSV. Export the report as CSV and drop that.',
      BINARY_MSG_AR='الترويسة لا تطابق أي تصدير معروف — هذا ملف ثنائي (PDF أو Excel أو zip) وليس ملف CSV نصيًا. صدّر التقرير بصيغة CSV ثم أفلته.';
  function looksBinaryHeader(header){
    var h0=String((header&&header[0])||''), joined=(header||[]).join('');
    return /^(%PDF|PK\x03\x04|ÿþ|þÿ|\ufffd)/.test(h0)||/[\x00-\x08\x0e-\x1f]/.test(joined);
  }
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
  /* 2026-09-02 (overnight cycle, scripts/qa/probe-deleted-invoice-attacks.mjs) — finLoad()
     selects finance_invoices with NO deleted_at filter on purpose (the Ledger offers Restore),
     so FIN.rows carries soft-deleted rows too. This index used to treat every one of them as
     "already exists": re-importing an invoice the owner had DELETED matched the deleted row,
     reported "1 updated", and wrote the new figures into a row that stays invisible on every
     screen. From the owner's chair: "I deleted it, dropped the file again, it said updated, and
     the invoice never came back." Deleted numbers are now kept apart and reported, never
     written to and never silently resurrected — restoring is his decision, not the importer's.
     A number that has BOTH a live and a deleted row (deleted one line, re-imported later) is
     matched on the live row, exactly as before. */
  function initState(){
    var existingByNo={}, deletedByNo={};
    ((window.FIN&&FIN.rows)||[]).forEach(function(r){ if(r.invoice_no&&!r.deleted_at) existingByNo[r.invoice_no]=r; });
    ((window.FIN&&FIN.rows)||[]).forEach(function(r){ if(r.invoice_no&&r.deleted_at&&!existingByNo[r.invoice_no]) deletedByNo[r.invoice_no]=r; });
    return {
      existingByNo:existingByNo, deletedByNo:deletedByNo,
      linkByGroup:(window.FIN&&FIN.linkByGroup)||{},
      isNew:[], updated:[], unchangedCount:0,
      excludedByRule:0, excludedDetail:{wallet:0,verif:0,clientExcluded:0,clientExcludedDetail:[],costCaptureDetail:[]},
      needsLinking:0
    };
  }
  // zatca_dpin/invoice_date added 2026-08-24 for tax_invoice_capture — without them, a row
  // whose ONLY real change is a newly-attached tax code (nothing else differing) would report
  // as "unchanged" and silently never get its tax code written at all.
  var CMP_FIELDS=['total_incl_vat_sar','integrity_status','amount_received_sar','amount_remaining_sar','revenue_sar','cost_sar','profit_sar','zatca_dpin','invoice_date'];
  // M13, 2026-08-25 — real live bug: `year` on finance_invoices is `GENERATED ALWAYS AS
  // (EXTRACT(year FROM invoice_date))::integer STORED` (verified against the live schema, not
  // guessed) — Postgres refuses ANY statement that assigns it explicitly, even a matching value,
  // and PostgREST sends one batch's rows as ONE insert/upsert statement, so a single generated
  // column in ONE row's payload fails the WHOLE batch. Two update sites below built their payload
  // by spreading a live finance_invoices row (`Object.assign({},existing,{...delta})`) straight
  // from FIN.rows (a real `select *`), which carries `year` — every field on that row rides along
  // into the write. Fixed by routing every update/insert payload through this explicit allowlist
  // instead of ever spreading a full row object again, so a future generated or DB-managed column
  // (audited against the live schema: only `year` is GENERATED today; `month`/`quarter` are plain
  // columns the finance_derive_fields trigger recomputes regardless of what is sent, safe to
  // include) can't ride along the same way. `id`/`created_at`/`updated_at`/`deleted_at` are
  // deliberately excluded too — `id` is added back explicitly by each call site that needs it for
  // upsert matching, the rest are DB-managed and this importer never sets them.
  var WRITABLE_INVOICE_FIELDS=['invoice_no','zatca_dpin','client_group','customer_raw_name','invoice_date',
    'month','quarter','products','service_type','record_type','total_incl_vat_sar','wallet_portion_sar',
    'revenue_sar','cost_sar','profit_sar','amount_received_sar','amount_remaining_sar','collection_due_date',
    'integrity_status','exclusion_reason','notes','source_batch','line_no','branch','salesman','project_tag',
    'discount_sar','origin','proposal_ref','items','transaction_ref','direct_uuid','vat_sar','revenue_way'];
  function pickWritable(row){
    var out={};
    WRITABLE_INVOICE_FIELDS.forEach(function(f){ if(Object.prototype.hasOwnProperty.call(row,f)) out[f]=row[f]; });
    return out;
  }
  function rowDiffers(oldR,newR){
    return CMP_FIELDS.some(function(f){
      var a=oldR[f], b=newR[f];
      if(typeof a==='number'||typeof b==='number') return Math.abs((Number(a)||0)-(Number(b)||0))>0.01;
      return String(a==null?'':a)!==String(b==null?'':b);
    });
  }
  function isLinked(r,linkByGroup){ var l=linkByGroup[r.client_group]; return !!(l&&(l.business_id||l.is_client===false)); }
  /* 2026-09-03 (watch cycle 16): invoice_date is NOT NULL with no default on the live table
     (information_schema, read the same day). A file row whose date column is blank or unreadable
     produced invoice_date:null, which the database refuses — and since PostgREST sends a batch as
     ONE statement, that single row loses EVERY row in the file. The preview said "4 new" and the
     commit said "0 new"; the owner has lived through this exact shape once already, with the
     generated `year` column. Such rows are now named and held back like a deleted invoice, so the
     rest of the file still lands and the person can see which line to fix. */
  function noDateNote(){
    return fl('no readable invoice date — the invoice date is required, so this row was held back; the rest of the file still imports',
              'لا يوجد تاريخ فاتورة مقروء — تاريخ الفاتورة مطلوب، لذا حُجز هذا الصف؛ وبقية الملف تُستورد كالمعتاد');
  }
  function deletedHereNote(no){
    return fl('deleted in this app — restore it first, then re-import; nothing was written',
              'محذوفة في هذا التطبيق — استرجعها أولًا ثم أعد الاستيراد؛ لم يُكتب شيء');
  }
  function mergeRowsIntoState(rows,state){
    rows.forEach(function(r){
      if(r.invoice_date==null||r.invoice_date===''){
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:r.invoice_no,reason:noDateNote()});
        return;
      }
      if(!state.existingByNo[r.invoice_no]&&state.deletedByNo&&state.deletedByNo[r.invoice_no]){
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:r.invoice_no,reason:deletedHereNote(r.invoice_no)});
        return;
      }
      var ex=state.existingByNo[r.invoice_no];
      if(!ex){ var nr=pickWritable(r); state.isNew.push(nr); if(!isLinked(nr,state.linkByGroup))state.needsLinking++; }
      else if(rowDiffers(ex,r)){ var u=Object.assign({},pickWritable(r),{id:ex.id}); state.updated.push(u); if(!isLinked(u,state.linkByGroup))state.needsLinking++; }
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
  /* 2026-09-02 (attack round 14, importer premortem #2 on the teach-once path): moneyG stripped
     every non-ASCII digit, so an amount typed with Arabic-Indic digits ("١٬٢٥٠٫٥٠") became 0
     — a silent zero, the exact "looks cleaner than expected" shape P5 warns about; an
     accounting negative "(500)" lost its sign; a European "1.250,50" read as 1.25. Digits are
     normalised first, parentheses mean negative, and a trailing ",dd" with a "." before it is a
     decimal comma. isoDateG accepted only dd/mm/yyyy and ISO: "2026/06/15" or "15-06-2026" became
     no date at all, and a US "06/15/2026" became month 15 → quarter "Q5". */
  var AR_DIGITS={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٫':'.','٬':',','−':'-'};
  function asciiDigits(s){ return String(s==null?'':s).replace(/[٠-٩۰-۹٫٬−]/g,function(c){return AR_DIGITS[c]||c;}); }
  function moneyG(x){
    if(typeof x==='number')return x;
    var s=asciiDigits(x).trim(); if(!s)return 0;
    var neg=/^\(.*\)$/.test(s)||/^-/.test(s.replace(/[^\d.,\-]/g,''));
    s=s.replace(/[^\d.,]/g,'');
    if(/,\d{1,2}$/.test(s)&&s.indexOf('.')>=0&&s.lastIndexOf('.')<s.lastIndexOf(',')) s=s.replace(/\./g,'').replace(',','.');   // 1.250,50
    else if(/,\d{1,2}$/.test(s)&&s.indexOf('.')<0&&(s.match(/,/g)||[]).length===1) s=s.replace(',','.');                    // 1250,50
    else s=s.replace(/,/g,'');                                                                                                // 1,250.50
    var v=parseFloat(s)||0; return neg?-Math.abs(v):v;
  }
  function isoDateG(s){
    s=asciiDigits(s).trim();
    var y,mo,d,m;
    if((m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))){ y=+m[1]; mo=+m[2]; d=+m[3]; }
    else if((m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))){ d=+m[1]; mo=+m[2]; y=+m[3]; if(mo>12&&d<=12){ var t=mo; mo=d; d=t; } }
    else return null;
    if(!(mo>=1&&mo<=12&&d>=1&&d<=31))return null;
    /* 2026-09-03 (watch cycle 16): "31" passed for every month, so 2026-02-30 came through as a
       string that LOOKS like a date. invoice_date is a real DATE column — Postgres rejects it
       ("date/time field value out of range"), and because PostgREST sends one batch as ONE
       statement, that single row loses the WHOLE import. Check the real calendar day. */
    var _t=new Date(Date.UTC(y,mo-1,d));
    if(_t.getUTCFullYear()!==y||_t.getUTCMonth()!==mo-1||_t.getUTCDate()!==d)return null;
    return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  try{ window.__v65MoneyG=moneyG; window.__v65IsoDateG=isoDateG; }catch(_){}
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
    /* 2026-09-02 (watch cycle 5, scripts/qa/probe-importer-attacks.mjs): derive money EXACTLY
       the way the database trigger finance_derive_fields() will store it — revenue = total −
       wallet (wallet is 0 on this path), profit = revenue − cost. This row used to send
       revenue_sar = profit; the trigger silently corrected it on disk, but the preview's
       new/updated/unchanged diff compared the client's value against the stored one, so every
       mapped row with a cost re-imported as "updated" for ever (a history entry per invoice per
       re-drop, for nothing) and "re-importing the same file twice changes nothing" was untrue.
       A mapped profit column, if the file has one, is still honoured as the profit figure — the
       trigger then keeps it only when it equals revenue − cost, same as before. */
    var revenue=Math.round(total*100)/100;
    var profitField=get('profit_sar'); var profit=profitField!=null?moneyG(profitField):Math.round((revenue-cost)*100)/100;
    var svc=String(get('products')||'').trim()||null;
    return {
      invoice_no:invoiceNo, zatca_dpin:String(get('zatca_dpin')||'').trim()||null,
      client_group:custRaw, customer_raw_name:custRaw,
      invoice_date:date,
      month:date?MONTH_NAMES[+date.slice(5,7)-1]:null,
      quarter:date?('Q'+(Math.floor((+date.slice(5,7)-1)/3)+1)):null,
      products:svc, service_type:svc, record_type:'b2b',
      total_incl_vat_sar:total, wallet_portion_sar:0, revenue_sar:revenue,
      cost_sar:cost, profit_sar:profit,
      vat_sar:0, // this method does not know the file's VAT breakdown — recorded as unknown (0), never guessed at 15%
      discount_sar:0,
      // no payment-status column is asked for in the mapping (kept deliberately simple) — a
      // mapped row is honestly "not yet reconciled" until someone updates it, not assumed paid.
      // 2026-09-03 (watch cycle 16): a NEGATIVE total is a credit note, and the live table says
      // so — fin_nonneg_chk allows total < 0 only when integrity_status='credit_note'. Sending
      // such a row as 'pending' is rejected by the database, and one rejected row loses the whole
      // batch. amount_remaining is never negative either (the same constraint), so a credit note
      // carries nothing outstanding: there is nothing left for the client to pay on it.
      amount_received_sar:0, amount_remaining_sar:(total<0?0:total),
      integrity_status:(total<0?'credit_note':'pending'),
      exclusion_reason:null, notes:String(get('notes')||'').trim()||null,
      source_batch:'mapped-import-'+new Date().toISOString().slice(0,10),
      line_no:1, branch:String(get('branch')||'').trim()||null, salesman:null,
      revenue_way:'invoice', transaction_ref:null
    };
  }
  function processGenericBatch(rawRows, header, mapping, state){
    var candidates=[];
    /* 2026-09-02 (attack round 14): two rows carrying the SAME reference number in one file
       used to become two inserts with the same (invoice_no, line_no) — the database's unique
       key then failed the WHOLE commit, with nothing telling the person which row. The first
       row is kept; every later duplicate is reported for manual review, never guessed at. */
    state.seenGenericNo=state.seenGenericNo||{};
    rawRows.forEach(function(row){
      var built=buildGenericRow(row,header,mapping); if(!built)return;
      if(state.seenGenericNo[built.invoice_no]){
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:built.invoice_no,reason:fl('appears more than once in this file — the first row was kept, this one needs manual review','يتكرر في هذا الملف — احتُفظ بالصف الأول، وهذا الصف يحتاج مراجعة يدوية')});
        return;
      }
      state.seenGenericNo[built.invoice_no]=1;
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

  /* ---------- tax_invoice_capture: the third real source, update-only, never inserted ----------
     See the CATALOGUE comment above for the full TTIN/DPIN trap this signature exists to defend
     against. Never creates a finance_invoices row (this source carries no client name at all,
     and client_group is NOT NULL — there is nothing to create a new row WITH). Exclusion is
     checked against the EXISTING row's own client_group via finExclusionCheck(), never against
     the tax-code prefix — a hypothesis ("TTIN looks like the Takamol series") is not a rule. */
  function processTaxInvoiceBatch(rawRows, header, state){
    var ixNo=header.indexOf('invoice_no'), ixCode=header.indexOf('tax_code'),
        ixTot=header.indexOf('total_incl_vat_sar'), ixSt=header.indexOf('invoice_status'),
        ixDate=header.indexOf('issue_date');
    if(ixNo<0||ixCode<0||ixTot<0||ixSt<0||ixDate<0)return; // detectSignature() already guarantees these; defensive only
    rawRows.forEach(function(row){
      var invNo=String(row[ixNo]||'').trim(); if(!invNo)return;
      var taxCode=String(row[ixCode]||'').trim();
      var status=String(row[ixSt]||'').trim();
      var existing=state.existingByNo[invNo];
      if(!existing&&state.deletedByNo&&state.deletedByNo[invNo]){
        // a deleted invoice is a different problem from an invoice this app has never seen
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:invNo,reason:deletedHereNote(invNo)});
        return;
      }
      if(!existing){
        // Never inserted — see the module comment above. Reported the same way every other
        // "not a live invoice" case is reported across this importer.
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:invNo,reason:fl('not a live invoice — no client name available to create one, needs manual review','ليست فاتورة قائمة — لا يوجد اسم عميل لإنشائها، تحتاج مراجعة يدوية')});
        return;
      }
      // Exclusion is checked BEFORE the eligibility gate below, on purpose: a row that would
      // otherwise sail straight through (has a tax code, status is final) must still never
      // touch an excluded client's row — this is the sabotage case
      // scripts/qa/probe-tax-invoice-capture.mjs proves directly.
      var xhit=(typeof window.finExclusionCheck==='function')?(window.finExclusionCheck(existing.client_group)||window.finExclusionCheck(existing.customer_raw_name)):null;
      if(xhit){
        state.excludedByRule++; state.excludedDetail.clientExcluded++;
        state.excludedDetail.clientExcludedDetail.push({name:existing.client_group,clientId:xhit.clientId,reason:xhit.reason});
        return;
      }
      // THE OWNER'S RULE, applied literally: a tax code AND a status past "Waiting for
      // Issuing" — anything short of either goes to manual review, never guessed at.
      if(!taxCode){
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:invNo,reason:fl('no tax code yet — needs manual review','لا يوجد رمز ضريبي بعد — تحتاج مراجعة يدوية')});
        return;
      }
      if(status.toLowerCase()==='waiting for issuing'){
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:invNo,reason:fl('status is "Waiting for Issuing" — not final yet, needs manual review','الحالة "بانتظار الإصدار" — غير نهائية بعد، تحتاج مراجعة يدوية')});
        return;
      }
      // Never fabricate a number to fill a gap (docs/DECISIONS.md): a malformed/blank total or
      // date on this row leaves the existing value exactly as it was, rather than zeroing or
      // nulling a real figure.
      var parsedTotal=moneyG(row[ixTot]);
      var newTotal=(parsedTotal>0)?parsedTotal:(+existing.total_incl_vat_sar||0);
      var parsedDate=isoDateG(row[ixDate]);
      var newDate=parsedDate||existing.invoice_date;
      var updated=Object.assign({},pickWritable(existing),{zatca_dpin:taxCode, total_incl_vat_sar:newTotal, invoice_date:newDate});
      if(rowDiffers(existing,updated)) state.updated.push(Object.assign({},updated,{id:existing.id}));
      else state.unchangedCount++;
    });
  }

  /* ---------- expense_lines_capture + expense_gate_capture: cost, joined across two files ----------
     Never creates a finance_invoices row. Two prior single-file designs were abandoned in the
     same day (see docs/BACKLOG.md 2026-08-23 for the full trail — a per-invoice-modal read
     killed by a stale-iframe near-miss, then a single-file design that assumed the real
     expense-report source carried the transaction-level gate, which it does not: its own
     columns are INVOICE # | AMOUNT (SAR) | STATUS | APPROVAL DATE | MERCHANT, confirmed by
     checking, not assumed). The gate — the transaction's own Expense Status, Ready/Issued vs
     Pending — has to come from a SECOND source and be joined in, in code, not by hand: a join
     done in a capture script is invisible to every probe here and doesn't survive past that
     one session; a join done here is testable and lasts (docs/DECISIONS.md, principle P1).

     The join is entirely in-memory, and persists for the lifetime of the page — NOT reset per
     drop batch. That matters: the two files are captured from different Direct Payments pages
     and may genuinely arrive in separate sessions (lines today, transaction status tomorrow).
     An earlier version of this reset EXPENSE_JOIN at the start of every processFileList() call,
     which would have silently thrown away an already-captured file the moment the second one
     was dropped later — caught by re-reading this code against the importer's own stated rule
     (see file header) before it ever shipped: "a file that references something not seen yet
     just sits unlinked until the file that supplies it arrives." Only a page reload clears it.
     Either file dropped alone sits waiting for the other; its invoices show up in the joined
     preview as "waiting", listed individually, never guessed at and never silently dropped. */
  var EXPENSE_JOIN=null; // {lines:{txnRef:[{amount,status}]}, gates:{txnRef:{status,raw,issuedInvoiceNo,conflict,__fromThisDrop}}}
  function ensureExpenseJoin(){ if(!EXPENSE_JOIN) EXPENSE_JOIN={lines:{},gates:{}}; return EXPENSE_JOIN; }
  function resetExpenseJoin(){ EXPENSE_JOIN=null; }

  // M15, 2026-08-25 — owner-directed: "if I get a new export and want to add it, I want it to
  // accept it and update the values... and it would spread it automatically, so I don't have
  // to import all the files." Page-lifetime memory (the comment above) was the right instinct
  // but not enough — it means a fresh browser tab, or the SAME tab tomorrow, has forgotten
  // everything previously captured, and a single updated file can no longer resolve against
  // what's already known without re-supplying every other file alongside it.
  //
  // DESIGN DECISION (asked for explicitly before building): the join's raw captured facts now
  // live in Supabase (finance_expense_lines_capture / finance_expense_gate_capture — migration
  // finance_expense_capture_persistence), not only in this tab's memory. loadCaptureBaseline()
  // fetches both tables ONCE per page session and seeds EXPENSE_JOIN with them BEFORE any
  // newly-dropped file is resolved against it — so a lone updated file always joins against
  // everything captured in every PRIOR session, not just this one. Written only on Confirm
  // (v65Commit → fn_commit_finance_import RPC, M16), through the app's own import path, matching D1 and the
  // "nothing written until you confirm the preview" promise.
  var CAPTURE_BASELINE_STATE='none'; // 'none' | 'loading' | 'loaded'
  var CAPTURE_BASELINE_WAITERS=[];
  var PENDING_CAPTURE={lines:[],gates:[]}; // raw rows from THIS session's drop(s), flushed to Supabase on Confirm
  var LINES_TOUCHED_THIS_SESSION={}; // transaction_refs a fresh drop has replaced this session — see processExpenseLinesBatch
  function loadCaptureBaseline(cb){
    cb=cb||function(){};
    if(CAPTURE_BASELINE_STATE==='loaded'){ cb(); return; }
    CAPTURE_BASELINE_WAITERS.push(cb);
    if(CAPTURE_BASELINE_STATE==='loading')return;
    CAPTURE_BASELINE_STATE='loading';
    function done(){ CAPTURE_BASELINE_STATE='loaded'; var ws=CAPTURE_BASELINE_WAITERS; CAPTURE_BASELINE_WAITERS=[]; ws.forEach(function(w){try{w();}catch(_){}}); }
    var c=fc(); if(!c){ done(); return; }
    var j=ensureExpenseJoin();
    /* 2026-09-03 (watch cycle 13): both capture reads page now. They were single unpaged selects,
       and the API hands back at most 1000 rows without saying so — expense LINES grow faster than
       anything else in Finance (one transaction can carry many), so past 1000 the join would have
       quietly stopped seeing recorded costs and reported the invoices as "an import gap" while
       their profit read as if the cost were zero. js/16 owns the helper; the local fallback keeps
       this file working on its own if the load order ever changes. */
    var _pageAll=(typeof window.finPageAll==='function')?window.finPageAll:function(mk,cb){
      var all=[]; (function _p(from){ mk().range(from,from+999).then(function(r){
        if(r&&r.error){cb({data:null,error:r.error});return;}
        var d=(r&&r.data)||[]; all=all.concat(d);
        if(d.length===1000)_p(from+1000); else cb({data:all,error:null});
      },function(e){cb({data:null,error:e});}); })(0);
    };
    _pageAll(function(){return c.from('finance_expense_lines_capture').select('transaction_ref,amount_sar,expense_status').order('transaction_ref',{ascending:true});}, function(rl){
      (rl.data||[]).forEach(function(row){
        (j.lines[row.transaction_ref]=j.lines[row.transaction_ref]||[]).push({amount:row.amount_sar, status:row.expense_status||''});
      });
      _pageAll(function(){return c.from('finance_expense_gate_capture').select('transaction_ref,txn_expense_status,invoice_issuing_raw').order('transaction_ref',{ascending:true});}, function(rg){
        (rg.data||[]).forEach(function(row){
          // __fromThisDrop deliberately unset here — a baseline-loaded entry that a fresh drop
          // later disagrees with is a normal UPDATE (superseded), never flagged as a conflict;
          // conflict stays reserved for two rows disagreeing within the SAME session's drop(s).
          j.gates[row.transaction_ref]={status:row.txn_expense_status||'', raw:row.invoice_issuing_raw||'', issuedInvoiceNo:parseInvoiceIssuing(row.invoice_issuing_raw), conflict:false};
        });
        done();
      });
    });
  }
  function processExpenseLinesBatch(rawRows, header, gen){
    // M17 (found by hands-on driving 2026-08-26): the file input's own change event AND the
    // "Check file" button both call processFileList on the same selection — the natural owner
    // flow (pick files, then click the button) processed everything twice, and the session-level
    // accumulators here doubled every expense line (900 became 1800). Two guards fix it:
    // (1) a batch arriving from a SUPERSEDED drop (its stream still finishing after a newer
    // processFileList started) is discarded outright, same philosophy as the myGen repaint
    // guard; (2) first-touch tracking is per-DROP, not per-page-session, so a duplicate or
    // deliberately re-dropped file REPLACES that transaction's lines instead of appending —
    // which is also exactly the owner's incremental-update model within one sitting.
    if(gen!==undefined&&gen!==GENERATION)return;
    var j=ensureExpenseJoin();
    var ixRef=header.indexOf('transaction_ref'), ixAmt=header.indexOf('amount_sar'), ixSt=header.indexOf('expense_status');
    if(ixRef<0||ixAmt<0||ixSt<0)return; // detectSignature() already guarantees these; defensive only
    var batchTag='dp-import-'+new Date().toISOString().slice(0,10);
    rawRows.forEach(function(row){
      var ref=String(row[ixRef]||'').trim(); if(!ref)return;
      var status=String(row[ixSt]||'').trim();
      // M15: the FIRST time this drop touches a given transaction_ref, clear whatever lines
      // exist for it — the persisted baseline of an earlier session AND anything a previous
      // drop (or a duplicate run of this one) pushed this session — before pushing. A
      // re-export is that transaction's complete current line list, replacing the stale one,
      // never summed alongside it. Repeated rows for the SAME ref later in this SAME drop
      // still accumulate normally — real, separate expenses.
      if(LINES_TOUCHED_THIS_SESSION[ref]!==GENERATION){
        LINES_TOUCHED_THIS_SESSION[ref]=GENERATION;
        j.lines[ref]=[];
        PENDING_CAPTURE.lines=PENDING_CAPTURE.lines.filter(function(x){return x.transaction_ref!==ref;});
      }
      (j.lines[ref]=j.lines[ref]||[]).push({amount:row[ixAmt], status:status});
      PENDING_CAPTURE.lines.push({transaction_ref:ref, amount_sar:moneyG(row[ixAmt]), expense_status:status, source_batch:batchTag});
    });
  }
  // "Issued 1163762432" → "1163762432". "Need to issue" (or anything else that doesn't start
  // with "issued") → null, meaning this transaction has no tax invoice yet. Kept as a pure
  // function, deliberately never trusted to a capture script — see the FILE 2 comment above.
  function parseInvoiceIssuing(raw){
    var m=String(raw||'').trim().match(/^issued\s+(\S+)/i);
    return m?m[1]:null;
  }
  function processExpenseGateBatch(rawRows, header, gen){
    if(gen!==undefined&&gen!==GENERATION)return; // superseded drop's late batch — discard (M17)
    var j=ensureExpenseJoin();
    var ixRef=header.indexOf('transaction_ref'), ixSt=header.indexOf('txn_expense_status'), ixRaw=header.indexOf('invoice_issuing_raw');
    if(ixRef<0||ixSt<0||ixRaw<0)return;
    var batchTag='dp-import-'+new Date().toISOString().slice(0,10);
    rawRows.forEach(function(row){
      var ref=String(row[ixRef]||'').trim(); if(!ref)return;
      var status=String(row[ixSt]||'').trim();
      var raw=String(row[ixRaw]||'').trim();
      var cur=j.gates[ref];
      if(cur&&cur.__dropGen===GENERATION){
        // seen twice within THIS drop — a genuine self-conflict if they disagree, exactly the
        // old behavior.
        if(cur.status.toLowerCase()!==status.toLowerCase()||cur.raw.toLowerCase()!==raw.toLowerCase()) cur.conflict=true;
      } else {
        // brand new, baseline-loaded from a PRIOR session, or captured by an earlier (or
        // duplicate — M17) drop this session — a fresh drop's data properly supersedes it
        // (M15: the owner's incremental-update requirement), never treated as a conflict just
        // because it differs from what was captured before this drop.
        j.gates[ref]={status:status, raw:raw, issuedInvoiceNo:parseInvoiceIssuing(raw), conflict:false, __dropGen:GENERATION};
        PENDING_CAPTURE.gates=PENDING_CAPTURE.gates.filter(function(x){return x.transaction_ref!==ref;});
      }
      PENDING_CAPTURE.gates.push({transaction_ref:ref, txn_expense_status:status, invoice_issuing_raw:raw, source_batch:batchTag});
    });
  }
  // M16, 2026-08-25: the raw-capture write that used to happen here (delete-then-insert for
  // lines, upsert for gates, via several separate REST calls) now happens server-side, inside
  // the SAME atomic transaction as the invoice write — see fn_commit_finance_import()
  // (migration finance_commit_import_rpc) and window.v65Commit() below. PENDING_CAPTURE is
  // still accumulated by processExpenseLinesBatch()/processExpenseGateBatch() above exactly as
  // before; only how it gets flushed changed — one RPC call instead of a client-driven
  // sequential loop.

  // The Ready/Issued gate at TRANSACTION level (owner's Aug 20/21 notes; blank-means-Issued
  // correction verified 2026-08-24 — see the FILE 2 comment above for the full evidence: blank
  // always co-occurs with an "Issued <no>" invoice_issuing_raw, and the on-screen badge itself
  // renders with no text). "Ready" and blank both mean this transaction's own expenses are
  // done; anything else (e.g. "Pending") means they are not, full stop.
  function txnStatusDone(status){
    var s=String(status||'').trim().toLowerCase();
    return s===''||s==='ready';
  }
  // Called after every file in a drop batch finishes — see processFileList(). Two-level
  // resolution: Level 1 sums each transaction's own Approved expense lines (file 1). Level 2
  // groups transactions by the tax invoice their invoice_issuing_raw parses to (file 2) and
  // sums Level 1 across the whole group — but only when EVERY contributing transaction is
  // individually clean. One dirty transaction holds back the WHOLE invoice, reported loudly
  // with which transaction and why, never a partial sum from only the clean ones.
  function resolveExpenseJoin(){
    var j=ensureExpenseJoin();
    var state=initState();
    var notes=[];

    // ---- Level 1: per-transaction sum of Approved lines, computed once, reused below ----
    var txnSum={}, txnMalformed={};
    Object.keys(j.lines).forEach(function(ref){
      var sum=0, malformed=false;
      j.lines[ref].forEach(function(r){
        if(r.status.toLowerCase()!=='approved')return; // Pending/Cancelled/Under Review never count
        var amt=(typeof window.parseMoneyInput==='function')?window.parseMoneyInput(r.amount):parseFloat(r.amount);
        if(amt==null||isNaN(amt)||amt<0){ malformed=true; return; }
        sum+=amt; // never deduplicated — repeated identical amounts are real, separate expenses
      });
      txnSum[ref]=Math.round(sum*100)/100;
      txnMalformed[ref]=malformed;
    });

    // ---- Cross-cutting "waiting" cases — informational counts, not per-invoice holds, since
    // there is no invoice-level candidate to suppress here (we either don't know the
    // transaction's status yet, or it genuinely has no tax invoice yet at Direct Payments). ----
    var waitingForGate=0;
    Object.keys(j.lines).forEach(function(ref){ if(!(ref in j.gates)) waitingForGate++; });
    if(waitingForGate) notes.push(fl(waitingForGate+' transaction(s) have expense lines but no transaction-status row yet.',waitingForGate+' معاملة لديها أسطر مصروفات لكن بلا صف حالة معاملة بعد.'));

    var waitingForLinesIssued=0, waitingForLinesNotIssued=0, notYetIssued=0;
    Object.keys(j.gates).forEach(function(ref){
      var g=j.gates[ref];
      if(!(ref in j.lines)){ if(g.issuedInvoiceNo) waitingForLinesIssued++; else waitingForLinesNotIssued++; }
      else if(!g.issuedInvoiceNo && !g.conflict) notYetIssued++;
    });
    if(waitingForLinesIssued) notes.push(fl(waitingForLinesIssued+' transaction(s) are already issued into a tax invoice but have no expense lines captured yet — the invoice(s) they belong to are held back, not partially applied.',waitingForLinesIssued+' معاملة صدرت بالفعل إلى فاتورة ضريبية لكن بلا أسطر مصروفات ملتقطة بعد — الفاتورة (الفواتير) التابعة لها محجوزة، لم تُطبَّق جزئيًا.'));
    if(waitingForLinesNotIssued) notes.push(fl(waitingForLinesNotIssued+' transaction(s) have a status captured but no expense lines yet, and are not yet issued into any invoice.',waitingForLinesNotIssued+' معاملة لديها حالة ملتقطة لكن بلا أسطر مصروفات بعد، ولم تصدر بعد لأي فاتورة.'));
    if(notYetIssued) notes.push(fl(notYetIssued+' transaction(s) are not yet issued into any tax invoice ("Need to issue") — nothing to attribute their cost to yet.',notYetIssued+' معاملة لم تصدر بعد لأي فاتورة ضريبية ("بحاجة للإصدار") — لا يوجد ما تُنسب إليه تكلفتها بعد.'));

    // ---- Level 2: group every transaction that IS issued into an invoice, by that invoice ----
    var invoiceGroups={}; // invNo -> [transaction_ref,...]
    Object.keys(j.gates).forEach(function(ref){
      var g=j.gates[ref];
      if(g.issuedInvoiceNo) (invoiceGroups[g.issuedInvoiceNo]=invoiceGroups[g.issuedInvoiceNo]||[]).push(ref);
    });

    Object.keys(invoiceGroups).forEach(function(invNo){
      var refs=invoiceGroups[invNo];
      var existing=state.existingByNo[invNo];
      if(!existing&&state.deletedByNo&&state.deletedByNo[invNo]){
        // deleted here is a different problem from "this app has never seen that invoice"
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:invNo,reason:deletedHereNote(invNo)+fl(' ('+refs.length+' transaction(s) issue into it)',' ('+refs.length+' معاملة تصدر إليها)')});
        return;
      }
      if(!existing){
        // Not a live invoice — a real gap between Direct Payments' own tax-invoice list and
        // this app's finance_invoices table (2026-08-24 finding: 3 such gaps, all with real
        // cost behind them), which is a different problem from this capture and never fixed
        // here — never inserted, only reported.
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:invNo,reason:fl('not a live invoice — skipped ('+refs.length+' transaction(s) issue into it, likely an invoice-import gap)','ليست فاتورة قائمة — تم التخطي ('+refs.length+' معاملة تصدر إليها، غالبًا فجوة في استيراد الفواتير)')});
        return;
      }
      var xhit=(typeof window.finExclusionCheck==='function')?(window.finExclusionCheck(existing.client_group)||window.finExclusionCheck(existing.customer_raw_name)):null;
      if(xhit){
        state.excludedByRule++; state.excludedDetail.clientExcluded++;
        state.excludedDetail.clientExcludedDetail.push({name:existing.client_group,clientId:xhit.clientId,reason:xhit.reason});
        return;
      }
      // Every contributing transaction must itself be clean — one dirty transaction holds back
      // the whole invoice, never a partial sum from only the clean ones.
      var problems=[], sum=0;
      refs.forEach(function(ref){
        var g=j.gates[ref];
        if(g.conflict){ problems.push(fl('transaction '+ref+': its transaction-status file disagrees with itself','معاملة '+ref+': ملف حالة المعاملة يختلف مع نفسه')); return; }
        if(!txnStatusDone(g.status)){ problems.push(fl('transaction '+ref+': issued but status reads "'+g.status+'" — contradiction, not trusted','معاملة '+ref+': صدرت لكن الحالة تقرأ "'+g.status+'" — تناقض، لم تُعتمد')); return; }
        if(!(ref in j.lines)){ problems.push(fl('transaction '+ref+': no expense lines captured yet','معاملة '+ref+': لا توجد أسطر مصروفات ملتقطة بعد')); return; }
        if(txnMalformed[ref]){ problems.push(fl('transaction '+ref+': a line has a malformed amount','معاملة '+ref+': أحد الأسطر بمبلغ غير صالح')); return; }
        sum+=txnSum[ref];
      });
      if(problems.length){
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:invNo,reason:fl('held back, needs review — '+problems.join('; '),'محجوزة، تحتاج مراجعة — '+problems.join('؛ '))});
        return;
      }
      sum=Math.round(sum*100)/100;
      var tot=+existing.total_incl_vat_sar||0;
      if(sum>tot){
        // The exact shape of the stale-iframe bug this whole path exists to catch: a
        // well-formed number that is simply impossible for this invoice. May also be a real
        // loss-making booking rather than a join error (2026-08-24 finding: invoice 1163692466,
        // cost 28,998.18 over a 26,536.00 total) — either way, never applied, always reported
        // loudly as needs-review, never silently dropped.
        state.excludedByRule++;
        state.excludedDetail.costCaptureDetail.push({invoice_no:invNo,reason:fl('approved cost ('+sum+') exceeds invoice total ('+tot+') across '+refs.length+' transaction(s) — needs review, not applied','التكلفة المعتمدة ('+sum+') أكبر من إجمالي الفاتورة ('+tot+') عبر '+refs.length+' معاملة — تحتاج مراجعة، لم تُطبَّق')});
        return;
      }
      var rev=+existing.revenue_sar||0;
      var updated=Object.assign({},pickWritable(existing),{cost_sar:sum,profit_sar:Math.round((rev-sum)*100)/100});
      if(rowDiffers(existing,updated)) state.updated.push(Object.assign({},updated,{id:existing.id}));
      else state.unchangedCount++;
    });

    var out=Object.assign({
      name:fl('Expense report ↔ transactions ↔ tax invoices','تقرير المصروفات ↔ المعاملات ↔ الفواتير الضريبية'),
      recognized:true, label:fl('Cost — joined and resolved','التكلفة — مدموجة ومحلولة')
    }, finalizeState(state,'expense_join',true));
    if(notes.length) out.joinNote=notes.join(' ');
    return out;
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
  function routeCsvStreamed(f, fileKey, onProgress, done, gen){
    var header=null, mode=null, mapping=null, state=null, buf=[], ctrl=null, finished=false, typeColIdx=-1, totalRows=0;
    ctrl=streamCsvFile(f, {
      onRow:function(row,isFirst){
        if(isFirst){
          header=row;
          // 2026-09-02 (landmine L6): a binary file renamed .csv (PDF, Excel, zip) used to be
          // shown as "not recognized — Columns found: %PDF-1.4 …" with a Teach button, as if
          // its garbage were a header. Say what it is and stop reading it.
          if(looksBinaryHeader(header)){
            finished=true; ctrl.abort();
            done({name:f.name, recognized:false, header:[], err:fl(BINARY_MSG_EN,BINARY_MSG_AR)});
            return;
          }
          var sig=detectSignature(header);
          if(sig&&sig.key==='invoice_export'){ mode='invoice_export'; state=initState(); typeColIdx=header.indexOf('Type'); return; }
          if(sig&&sig.key==='expense_lines_capture'){ mode='expense_lines'; return; }
          if(sig&&sig.key==='expense_gate_capture'){ mode='expense_gate'; return; }
          if(sig&&sig.key==='tax_invoice_capture'){ mode='tax_invoice'; state=initState(); return; }
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
        } else if(mode==='expense_lines'){
          buf.push(row);
          if(buf.length>=GENERIC_BATCH_ROWS){ processExpenseLinesBatch(buf,header,gen); buf=[]; }
        } else if(mode==='expense_gate'){
          buf.push(row);
          if(buf.length>=GENERIC_BATCH_ROWS){ processExpenseGateBatch(buf,header,gen); buf=[]; }
        } else if(mode==='tax_invoice'){
          buf.push(row);
          if(buf.length>=GENERIC_BATCH_ROWS){ processTaxInvoiceBatch(buf,header,state); buf=[]; }
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
        } else if(mode==='expense_lines'){
          if(buf.length) processExpenseLinesBatch(buf,header,gen);
          var linesN=Object.keys(ensureExpenseJoin().lines).length;
          done({name:f.name, recognized:true, label:CATALOGUE.expense_lines_capture.label,
            counts:{isNew:0,updated:0,unchanged:0,excludedByRule:0,needsLinking:0}, excludedDetail:{clientExcludedDetail:[],costCaptureDetail:[]},
            hasClientColumn:true, pendingInsert:[], pendingUpdate:[],
            joinNote:fl(linesN+' transaction(s) worth of expense lines captured — resolved together with the transaction-status join below.', linesN+' معاملة من أسطر المصروفات تم التقاطها — تُحل مع دمج حالة المعاملة أدناه.')});
        } else if(mode==='expense_gate'){
          if(buf.length) processExpenseGateBatch(buf,header,gen);
          var gatesN=Object.keys(ensureExpenseJoin().gates).length;
          done({name:f.name, recognized:true, label:CATALOGUE.expense_gate_capture.label,
            counts:{isNew:0,updated:0,unchanged:0,excludedByRule:0,needsLinking:0}, excludedDetail:{clientExcludedDetail:[],costCaptureDetail:[]},
            hasClientColumn:true, pendingInsert:[], pendingUpdate:[],
            joinNote:fl(gatesN+' transaction(s) worth of status captured — resolved together with the expense-lines join below.', gatesN+' معاملة من الحالة تم التقاطها — تُحل مع دمج أسطر المصروفات أدناه.')});
        } else if(mode==='tax_invoice'){
          if(buf.length) processTaxInvoiceBatch(buf,header,state);
          done(Object.assign({name:f.name, recognized:true, label:CATALOGUE.tax_invoice_capture.label}, finalizeState(state,'tax_invoice_capture',true)));
        }
      },
      onError:function(e){ if(!finished) done({name:f.name, recognized:false, header:header||[], err:String(e&&e.message||e)}); }
    });
  }

  /* ---------- xlsx: kept on the existing, proven full-read path (see file header re: why) ----------
     fileKey is passed in from processFileList's fileKeyOf(f) — MUST be the same key
     RESULT_INDEX was built with, or a "Teach this file" click on an xlsx file would look up
     an index that was never stored and silently do nothing. */
  function routeRows2d(name, rows2d, fileKey, done, gen){
    var hdr=(rows2d&&rows2d[0])||[];
    if(looksBinaryHeader(hdr)){ done({name:name, recognized:false, header:[], err:fl(BINARY_MSG_EN,BINARY_MSG_AR)}); return; }
    var sig=detectSignature(hdr);
    if(sig&&sig.key==='invoice_export'){
      var state=initState();
      try{ processInvoiceBatch(rows2d,state); }
      catch(e){ done({name:name,recognized:false,header:hdr,err:String(e&&e.message||e)}); return; }
      done(Object.assign({name:name,recognized:true,label:CATALOGUE[sig.catalogueKey].label}, finalizeState(state,'invoice_export',true)));
      return;
    }
    if(sig&&sig.key==='expense_lines_capture'){
      try{ processExpenseLinesBatch(rows2d.slice(1),hdr,gen); }
      catch(e){ done({name:name,recognized:false,header:hdr,err:String(e&&e.message||e)}); return; }
      var linesN2=Object.keys(ensureExpenseJoin().lines).length;
      done({name:name, recognized:true, label:CATALOGUE.expense_lines_capture.label,
        counts:{isNew:0,updated:0,unchanged:0,excludedByRule:0,needsLinking:0}, excludedDetail:{clientExcludedDetail:[],costCaptureDetail:[]},
        hasClientColumn:true, pendingInsert:[], pendingUpdate:[],
        joinNote:fl(linesN2+' transaction(s) worth of expense lines captured — resolved together with the transaction-status join below.', linesN2+' معاملة من أسطر المصروفات تم التقاطها — تُحل مع دمج حالة المعاملة أدناه.')});
      return;
    }
    if(sig&&sig.key==='expense_gate_capture'){
      try{ processExpenseGateBatch(rows2d.slice(1),hdr,gen); }
      catch(e){ done({name:name,recognized:false,header:hdr,err:String(e&&e.message||e)}); return; }
      var gatesN2=Object.keys(ensureExpenseJoin().gates).length;
      done({name:name, recognized:true, label:CATALOGUE.expense_gate_capture.label,
        counts:{isNew:0,updated:0,unchanged:0,excludedByRule:0,needsLinking:0}, excludedDetail:{clientExcludedDetail:[],costCaptureDetail:[]},
        hasClientColumn:true, pendingInsert:[], pendingUpdate:[],
        joinNote:fl(gatesN2+' transaction(s) worth of status captured — resolved together with the expense-lines join below.', gatesN2+' معاملة من الحالة تم التقاطها — تُحل مع دمج أسطر المصروفات أدناه.')});
      return;
    }
    if(sig&&sig.key==='tax_invoice_capture'){
      var state3=initState();
      try{ processTaxInvoiceBatch(rows2d.slice(1),hdr,state3); }
      catch(e){ done({name:name,recognized:false,header:hdr,err:String(e&&e.message||e)}); return; }
      done(Object.assign({name:name,recognized:true,label:CATALOGUE.tax_invoice_capture.label}, finalizeState(state3,'tax_invoice_capture',true)));
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

  // 2026-08-25 (density/copy pass, owner-directed) — groups a detail list by keyFn(), so 20
  // byte-identical "Takamol excluded" rows collapse into one line with a count instead of the
  // same sentence printed 20 times. The B6 rule stays intact: the reason text itself is never
  // shortened or dropped, only the REPETITION of it.
  function groupDupes(list,keyFn){
    var groups={},order=[];
    (list||[]).forEach(function(d){
      var k=keyFn(d);
      if(!groups[k]){ groups[k]={items:[],first:d}; order.push(k); }
      groups[k].items.push(d);
    });
    return order.map(function(k){return groups[k];});
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
        var ceParts=[];
        if(r.excludedDetail&&r.excludedDetail.clientExcludedDetail&&r.excludedDetail.clientExcludedDetail.length){
          groupDupes(r.excludedDetail.clientExcludedDetail,function(d){return d.name+'|'+d.clientId+'|'+(d.reason||'');}).forEach(function(g){
            var d=g.first;
            ceParts.push(esc(d.name+' (#'+d.clientId+(d.reason?(': '+d.reason):'')+')')+(g.items.length>1?(' — <b>'+g.items.length+'</b> '+fl('rows','صف')):''));
          });
        }
        var ccParts=[];
        if(r.excludedDetail&&r.excludedDetail.costCaptureDetail&&r.excludedDetail.costCaptureDetail.length){
          groupDupes(r.excludedDetail.costCaptureDetail,function(d){return d.reason||'';}).forEach(function(g){
            var nums=g.items.map(function(d){return d.invoice_no;});
            if(nums.length<=3){ ccParts.push(esc(nums.join(', ')+': '+g.first.reason)); }
            else {
              ccParts.push('<details style="display:inline"><summary style="cursor:pointer;display:inline;color:#667085">'+nums.length+' '+fl('invoices','فاتورة')+': '+esc(g.first.reason)+'</summary><div style="font-size:11px;color:var(--muted);margin-top:2px">'+esc(nums.join(', '))+'</div></details>');
            }
          });
        }
        exclLine=String(r.counts.excludedByRule)+((ceParts.length||ccParts.length)?(' — '+ceParts.concat(ccParts).join('; ')):'');
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
        (r.joinNote?('<div style="font-size:11.5px;color:#B54708;margin-top:4px">'+esc(r.joinNote)+'</div>'):'')+
      '</div>';
    }).join('');

    var recognizedCount=results.filter(function(r){return r.recognized;}).length;
    var writeCount=totals.isNew+totals.updated;
    var stillStreaming=results.some(function(r){return r.streaming;});
    // M17 premortem finding (2026-08-26): a capture-only drop — the gate file alone, or
    // expense files whose join resolves no invoice yet — used to offer NO commit button at
    // all, so the captured facts silently died with the tab and the counterpart file dropped
    // in a LATER session could never resolve (the exact "gate today, lines next week" flow
    // the incremental-update promise is for). If there is nothing to write to invoices but
    // there ARE pending raw captures, offer saving just the facts; v65Commit already sends
    // them through the same atomic RPC with empty insert/update arrays.
    var capCount=PENDING_CAPTURE.lines.length+PENDING_CAPTURE.gates.length;
    var btnHtml='';
    if(!stillStreaming){
      if(writeCount) btnHtml='<button class="btn pri sm" style="margin-top:10px" onclick="v65Commit()">'+fl('Confirm import — ','تأكيد الاستيراد — ')+totals.isNew+' '+fl('new','جديد')+', '+totals.updated+' '+fl('updated','محدَّث')+'</button>';
      else if(capCount) btnHtml='<button class="btn pri sm" style="margin-top:10px" onclick="v65Commit()">'+fl('Save captured expense facts — ','حفظ وقائع المصروفات الملتقطة — ')+capCount+' '+fl('row(s), no invoice changes yet','صف/صفوف، دون تغييرات على الفواتير بعد')+'</button>'+
        '<div style="font-size:11.5px;color:var(--muted);margin-top:4px">'+fl('Saving keeps these facts for a later import — drop the matching file another day and the cost resolves without re-supplying this one.','الحفظ يُبقي هذه الوقائع لاستيراد لاحق — أسقط الملف المقابل في يوم آخر وستُحلّ التكلفة دون إعادة هذا الملف.')+'</div>';
    }
    var h='<div style="font-size:13px;line-height:1.7">'+
      '<b>'+fl('Files dropped: ','الملفات المُسقطة: ')+results.length+' · '+fl('recognized: ','معروف: ')+recognizedCount+'</b>'+
      rowsHtml+
      btnHtml+
    '</div>';
    document.getElementById('finImpOut').innerHTML=h;
  }

  /* Look the element up live and also remember the HTML in LAST_DONE_HTML, repainted by
     paintPersisted() on every render() — a captured element reference goes stale the moment
     any of this app's many unrelated background renders rebuilds the import tab mid-commit
     (the insert/update loop below is several HTTP round trips long), same reasoning as the
     preview fix above. */
  function paintDone(html){ LAST_DONE_HTML=html; RESULTS=null; var out=document.getElementById('finImpOut'); if(out)out.innerHTML=html; }

  // M13, 2026-08-25 — real live bug: the owner ran a real import and read "Done. Imported 0
  // new, updated 27." while the database had written NOTHING (the `year` GENERATED-column
  // rejection failed the whole batch statement, confirmed in Supabase immediately after:
  // with_cost still 0, cost still 0.00). The error text WAS present in the same message, but
  // subordinated under a green "Done" headline that led with the INTENDED count — a reasonable
  // person reads "Done, updated 27" and stops, exactly as B2 in docs/DECISIONS.md already
  // names: a refused write that looks identical to a successful one. Fixed by reporting only
  // what the database actually confirmed, never a success count derived from intent.
  //
  // M16, 2026-08-25 — the oversight session's browser-extension injection context dies
  // mid-request ("Failed to execute forEach on Headers: the provided callback is no longer
  // runnable" — an "extension context invalidated" shape, the same root cause as the dead
  // file-I/O layer documented 2026-08-24, unrelated to M13). The OLD commit here made SEVERAL
  // sequential .insert()/.upsert() round trips (one per 50-row batch), each one a fresh window
  // for that teardown to land mid-batch — verified live: cost_sar still 0.00, nothing written,
  // clean failure, but also nowhere near durable against a context that can die at any moment.
  // Rebuilt as ONE call to fn_commit_finance_import() (migration finance_commit_import_rpc): a
  // single Postgres function, one transaction, one round trip. Two things this buys that
  // patching the client-side fetch call could not: (1) TRUE atomicity — either the whole batch
  // lands or none of it does, strictly stronger than the old per-50-row-batch behavior, where a
  // batch midway through could succeed while a later one failed; (2) the write is durable the
  // MOMENT Postgres commits the transaction — if the calling context dies while parsing the
  // response afterward (exactly the reported symptom), the data is already saved regardless,
  // because response-reading happens strictly after the server-side commit, not before it. This
  // is also why patching "don't hold a live Headers reference across the await" (the client-side
  // fix first considered) would not have helped: the failure is inside the browser/extension's
  // own fetch/Headers internals, code this app does not control or wrap either way — moving the
  // durability guarantee onto the server, where it does not depend on the client surviving at
  // all, is the only fix that actually reaches the reported failure. The RPC's explicit
  // jsonb_to_recordset() column lists ARE the M13 write allowlist enforced again, server-side: a
  // stray `year` key is silently ignored, never fails the statement — stricter than the direct-
  // REST path this replaces. Sabotage-tested: scripts/qa/probe-false-success-commit.mjs forces
  // the RPC call itself to fail, asserts the headline says FAILED with a written-count of 0 and
  // never prints the intended count as if it were the written count;
  // scripts/qa/probe-commit-survives-context-death.mjs proves the NEW guarantee directly — the
  // page is closed the instant after the RPC request is sent (before any response is read), and
  // the write is still found committed in the database on reconnect.
  // M17 (found by hands-on driving 2026-08-26): two files in ONE drop can both update the
  // SAME invoice — the tax capture sets zatca_dpin/total, the expense join sets cost. Each
  // builder spreads the same FIN.rows base row into a full-column payload, so applying them
  // sequentially made the LAST one's stale copies of the OTHER's fields win: the tax fields
  // were silently reverted by the cost update in the same commit. Merge per invoice before
  // sending: a field that differs from the shared base row is that payload's intentional
  // change (unchanged fields are literal copies of base, so === identifies them); layer the
  // changes, in file order, onto one payload per invoice. Derived money fields stay
  // consistent server-side — trg_fin_inv_derive is BEFORE INSERT OR UPDATE.
  function mergeUpdatesByInvoice(list){
    var base={}; (FIN.rows||[]).forEach(function(r){ if(r&&r.invoice_no!=null) base[r.invoice_no]=r; });
    var byInv={}, out=[];
    list.forEach(function(u){
      var k=u&&u.invoice_no; if(k==null){ out.push(u); return; }
      if(!byInv[k]){ byInv[k]=Object.assign({},u); out.push(byInv[k]); return; }
      var m=byInv[k], b=base[k];
      Object.keys(u).forEach(function(f){ if(!b||u[f]!==b[f]) m[f]=u[f]; });
    });
    return out;
  }
  window.v65Commit=function(){
    /* 2026-09-02: the Import tab already refuses to render for a non-editor, but the commit
       itself writes every invoice in the batch — guard the function too, so a stale tab (or a
       role changed while it was open) cannot push a whole import through. */
    try{ if(typeof window.finCanWrite==='function'?!window.finCanWrite():(typeof window.canFinEdit==='function'&&!window.canFinEdit()))return; }catch(_){}
    if(!FILES_STATE)return;
    var toInsert=[],toUpdate=[];
    FILES_STATE.forEach(function(r){ if(!r.recognized)return; toInsert=toInsert.concat(r.pendingInsert||[]); toUpdate=toUpdate.concat(r.pendingUpdate||[]); });
    FILES_STATE=null;
    toUpdate=mergeUpdatesByInvoice(toUpdate);
    var intendedInsert=toInsert.length, intendedUpdate=toUpdate.length;
    var capLines=PENDING_CAPTURE.lines, capGates=PENDING_CAPTURE.gates;
    PENDING_CAPTURE={lines:[],gates:[]};
    paintDone('<div style="font-size:13px">'+fl('Importing ','جارٍ الاستيراد ')+(intendedInsert+intendedUpdate)+' '+fl('rows…','صف…')+'</div>');
    var c=fc();
    if(!c){ paintDone('<div style="font-size:13px;color:#D92D20">'+fl('Not connected — try again.','غير متصل — حاول مجددًا.')+'</div>'); return; }
    c.rpc('fn_commit_finance_import',{p_insert:toInsert, p_update:toUpdate, p_capture_lines:capLines, p_capture_gates:capGates}).then(function(r){
      var failed=!!r.error;
      var got=(r.data)||{};
      // Atomic: on failure NOTHING landed (the whole transaction rolled back) — never report a
      // partial count derived from what might have happened before the error.
      var insertedCount=failed?0:(+got.inserted||0), updatedCount=failed?0:(+got.updated||0);
      var msg=failed
        ? ('<div style="font-size:13px;color:#D92D20"><b>'+fl('FAILED — nothing landed for the failing batch(es).','فشل — لم يُكتب شيء للدفعة (الدفعات) الفاشلة.')+'</b><br>'+
           fl('The database actually wrote: ','ما كتبته قاعدة البيانات فعليًا: ')+'<b>'+insertedCount+'</b> '+fl('new, ','جديد، ')+'<b>'+updatedCount+'</b> '+fl('updated','محدَّث')+
           ' ('+fl('intended ','المقصود ')+intendedInsert+' '+fl('new, ','جديد، ')+intendedUpdate+' '+fl('updated','محدَّث')+'). '+
           fl('Errors: ','أخطاء: ')+esc((r.error&&r.error.message)||'unknown error')+
           '</div>')
        : ('<div style="font-size:13px;color:#0F6E56"><b>'+fl('Done.','تم.')+'</b> '+
           fl('Imported ','تم استيراد ')+insertedCount+' '+fl('new, updated ','جديد، وتحديث ')+updatedCount+'.'+
           // M17 premortem: a capture-only save would otherwise read "Imported 0 new, updated
           // 0." — say what actually happened, from the database's own counts (M13 doctrine).
           ((!insertedCount&&!updatedCount&&((+got.capture_lines||0)+(+got.capture_gates||0)>0))
             ?(' '+fl('Saved ','تم حفظ ')+((+got.capture_lines||0)+(+got.capture_gates||0))+' '+fl('captured expense fact(s) for a later import.','من وقائع المصروفات الملتقطة لاستيراد لاحق.'))
             :'')+
           '</div>');
      paintDone(msg);
      FIN.rows=null; finLoad();
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
    // EXPENSE_JOIN is deliberately NOT reset here — it persists across separate drop batches
    // within the page's lifetime, so the lines file and the gate file can arrive in two
    // different sessions and still join correctly. See expense_lines/gate_capture header
    // comment above ensureExpenseJoin(). Only a page reload clears it.
    var joinIndex=-1;
    function repaint(){ if(myGen===GENERATION) renderCombinedPreview(results); }
    // Re-resolves the expense-lines↔transaction-status join after every file in this batch
    // finishes, and keeps its result at one stable slot in `results` (never appended twice) —
    // list.forEach below pushes every file's streaming placeholder synchronously before any
    // async finishFile() can fire, so results.length is already the final file count the first
    // time this runs, and joinIndex only ever gets set once.
    // M15: waits for the persisted capture baseline (a prior session's already-known facts) to
    // load before resolving, so a lone freshly-dropped file always joins against everything
    // captured before it, not just this tab's memory. Most calls return instantly once the
    // baseline has loaded once per page session — only the very first expense-file drop pays
    // the one-time round trip.
    function refreshJoin(cb){
      cb=cb||function(){};
      var j=ensureExpenseJoin();
      if(!Object.keys(j.lines).length&&!Object.keys(j.gates).length){ cb(); return; }
      loadCaptureBaseline(function(){
        if(myGen!==GENERATION)return; // a newer drop superseded this one — never mutate a discarded results array
        var joined=resolveExpenseJoin();
        if(joinIndex<0){ joinIndex=results.length; results.push(joined); }
        else results[joinIndex]=joined;
        cb();
      });
    }
    // M15: the baseline MUST be in EXPENSE_JOIN.lines/.gates before any file's raw rows are
    // processed — processExpenseLinesBatch()'s "replace on first touch this session" logic only
    // works if there is something baseline-loaded to replace yet. Loading it AFTER dispatch (the
    // first version of this fix) let a fresh drop's rows land first, and the baseline load then
    // pushed on top of them instead of being cleared by them — silently summing old + new
    // (caught by scripts/qa/probe-expense-capture-persistence.mjs, session 2 read 2500 instead
    // of 1500). Gating the WHOLE dispatch here costs one round trip on the very first drop of a
    // page session (already-loaded on every drop after that, including files unrelated to the
    // expense join) and is the only ordering that is actually correct.
    loadCaptureBaseline(function(){
      if(myGen!==GENERATION)return;
      list.forEach(function(f,idx){
        results.push({name:f.name, recognized:false, header:[], streaming:true, rowsRead:0});
        var fileKey=fileKeyOf(f);
        RESULT_INDEX[fileKey]=idx;
        function finishFile(r){ r.streaming=false; results[idx]=r; refreshJoin(function(){ if(myGen===GENERATION)repaint(); }); }
        // Pre-parsed text ingestion (window.v65IngestText) — already a full rows2d array in
        // memory, so it skips File I/O entirely and goes straight through the SAME
        // detectSignature → batch → refreshJoin → renderCombinedPreview path as every other
        // file. Checked first since f is a plain object here, not a real File — the .xlsx? test
        // below would still work on its .name, but there is nothing to read.
        if(f.__rows2d){ routeRows2d(f.name, f.__rows2d, fileKey, finishFile, myGen); return; }
        if(/\.xlsx?$/i.test(f.name)){
          if(window.__v65_readXlsx) window.__v65_readXlsx(f, function(rows2d){ routeRows2d(f.name, rows2d||[], fileKey, finishFile); });
          else finishFile({name:f.name, recognized:false, header:[], err:'Excel reader unavailable'});
          return;
        }
        routeCsvStreamed(f, fileKey, function(rowsRead){ results[idx].rowsRead=rowsRead; repaint(); }, finishFile, myGen);
      });
    });
  }

  /* ================= window.v65IngestText — CSV text in, same path, no File object =========
     Built 2026-08-24 for the oversight session's own capture workflow: it drives this importer
     by injecting JavaScript into a live Direct Payments tab, and that injection context's async
     layer is dead (setTimeout, Blob.text(), FileReader.readAsText, File.slice().arrayBuffer() —
     all confirmed to never resolve, silently, not an error). streamCsvFile() was correctly
     asking the browser for file bytes and just never getting an answer back — the importer
     itself was never at fault, and the earlier "freeze" reports the same session sent about the
     File-reading path were retracted once this was understood. This does not weaken anything:
     it reuses parseCsvTextToRows2d() (the same tokenizer streamCsvFile() itself is built on)
     and routeRows2d() (the same synchronous dispatcher the .xlsx path already uses) verbatim —
     every guard, the Ready/Issued gate, every exclusion check, the cost-exceeds-total refusal,
     the whole preview-then-commit flow all sit downstream of the parse and are completely
     untouched. It also makes a real-size import scriptable end to end without a human dragging
     a file, which is the actual P1 answer here — and it lets a QA probe drive the real
     `processFileList` → `resolveExpenseJoin()` path at real row counts instead of only a
     handful of synthetic fixture rows (scripts/qa/probe-cost-join-performance.mjs). */
  function parseCsvTextToRows2d(text){
    var rows=[];
    var parser=makeCsvStreamParser(function(row){ rows.push(row); });
    parser.feed(String(text||''));
    parser.finish();
    return rows;
  }
  window.v65IngestText=function(fileName, csvText){
    var rows2d=parseCsvTextToRows2d(csvText);
    if(!rows2d.length) return false;
    processFileList([{ name:String(fileName||'pasted.csv'), size:String(csvText||'').length, lastModified:0, __rows2d:rows2d }]);
    return true;
  };

  /* Found live 2026-08-24: the owner opened Import, dropped a real (correct)
     tax_invoice_capture file, clicked "Check file", and got a red "Header does not match
     the expected format" — his file, verified correct, was rejected because the multi-file
     wiring below had NOT attached yet. Root cause, confirmed by direct measurement: on the
     common path — the user is already on the Finance page and clicks the "Import" sub-tab —
     window.finGo() (js/16) calls renderFinance(v) DIRECTLY, never the global window.render()
     this wiring hooks into:
       window.finGo=function(t){ FIN.tab=t; var v=...; if(v&&current==='finance')
         renderFinance(v); else render(); };
     So the FIRST paint of the Import tab is drawn by rImport()'s raw HTML (the button still
     reads onclick="finParse()", the OLD single-format legacy checker), and nothing rewires it
     until some LATER, unrelated global render() happens to fire (a poller, a nav click) —
     which is exactly why a bare `window.render()` call "fixed" it: it was never a signature
     problem, the new importer simply hadn't mounted yet. This is the worst kind of guard
     failure: it never says "not ready", it says "your file is wrong", in red, and teaches the
     next person to distrust correct data. Fixed by wiring on BOTH paths — window.finGo() is
     now ALSO wrapped, identically to window.render() below, so the very first paint of the
     Import tab is already fully wired, whichever path drew it. Regression-guarded,
     including a sabotage case, by scripts/qa/probe-import-tab-wiring.mjs. */
  function v65WireImportPanel(){
    if(typeof current==='undefined'||current!=='finance'||!window.FIN||FIN.tab!=='import')return;
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
  }

  var _rf65=window.render;
  window.render=function(){
    var out=_rf65.apply(this,arguments);
    try{ v65WireImportPanel(); }catch(e){ if(window.console)console.warn('[v65] wire',e); }
    return out;
  };

  if(typeof window.finGo==='function'){
    var _fg65=window.finGo;
    window.finGo=function(){
      var out=_fg65.apply(this,arguments);
      try{ v65WireImportPanel(); }catch(e){ if(window.console)console.warn('[v65] wire (finGo)',e); }
      return out;
    };
  }
  window.v65CheckFiles=function(){ var inp=document.getElementById('finFile'); if(inp&&inp.files&&inp.files.length)processFileList(inp.files); else { var m=fl('Choose one or more files first.','اختر ملفًا واحدًا أو أكثر أولاً.'); if(typeof toast==='function')toast(m); else alert(m); } };

  console.info('%c[v65-router] universal importer — chunked reading + teach-once mapping loaded','color:#B54708;font-weight:700');
}catch(e){ if(window.console)console.warn('[v65-router] init',e); }})();
