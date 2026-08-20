/* S4 VERIFICATION — cross-import transaction→invoice twin resolution.

   The real gap this closes: a transaction imported as pending TODAY (no tax invoice yet)
   whose tax invoice shows up in a LATER, separate import. parseDP()'s own twin-pairing only
   matches within one file — across two import events, the old pending transaction and its
   new invoice would both sit in the ledger and double-count the same money forever unless
   something retires the old one. This probe reproduces exactly that two-stage scenario
   against the real backend: insert a pending transaction (as import #1 would have), then
   run a real invoice through the real importer's preview→commit pipeline (as import #2
   would), and prove the old transaction is retired and the money is counted exactly once. */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';
import fs from 'fs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9952));
const fails=[], notes=[];

async function financeReady(){
  await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
  await page.waitForTimeout(2200);
}
async function fingerprint(){
  await page.evaluate(()=>{ finGo('overview'); });
  await page.waitForTimeout(1300);
  return page.evaluate(()=>{
    const live=(window.FIN.rows||[]).filter(r=>!r.deleted_at);
    const V=live.filter(r=>r.integrity_status==='verified_paid').filter(window.finInPeriod);
    let rev=0,cost=0,prof=0,rec=0; V.forEach(r=>{rev+=+r.revenue_sar;cost+=+r.cost_sar;prof+=+r.profit_sar;rec+=+r.amount_received_sar;});
    let rem=0; live.filter(window.finInPeriod).forEach(r=>{rem+=+r.amount_remaining_sar||0;});
    return {revenue:rev,cost,profit:prof,received:rec,outstanding:rem,invoices:new Set(V.map(r=>r.invoice_no)).size};
  });
}

await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);
await financeReady();
const before = await fingerprint();
notes.push('BEFORE: '+JSON.stringify(before));

const client='Twin Test Co '+Date.now();
const txRef='TXN-'+Date.now();

/* ---------------- stage 1: the pending transaction, as a prior import would have left it ---------------- */
const txRow = await page.evaluate(async (args)=>{
  const c=window.fc();
  const r=await c.from('finance_invoices').insert({
    invoice_no:args.txRef, revenue_way:'transaction', record_type:'b2b', client_group:args.client,
    invoice_date:'2026-08-01', total_incl_vat_sar:115, wallet_portion_sar:0, cost_sar:0,
    amount_received_sar:0, amount_remaining_sar:115, integrity_status:'pending'
  }).select();
  return r.error ? {error:r.error.message} : r.data[0];
}, {client, txRef});
if(txRow.error){ fails.push('could not insert the stage-1 pending transaction: '+txRow.error); }
else{
  notes.push('stage 1: pending transaction inserted — '+txRef+', 115 SAR, client "'+client+'"');
  await page.evaluate(()=>{ FIN.rows=null; finLoad(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1500);
  await financeReady();
  const afterStage1 = await fingerprint();
  /* pending, so Revenue/Profit untouched; Outstanding rises by the full 115 */
  if(afterStage1.outstanding-before.outstanding!==115) fails.push('stage 1: Outstanding did not rise by 115 — got delta '+(afterStage1.outstanding-before.outstanding));
  if(afterStage1.revenue!==before.revenue) fails.push('stage 1: Revenue moved for a pending row — should not have');
  notes.push('AFTER STAGE 1: '+JSON.stringify(afterStage1));

  /* ---------------- stage 2: the same amount, now invoiced, through the REAL importer ---------------- */
  const invRef='INV-'+Date.now();
  const invNum='DPIN-'+Date.now();
  const header='Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman';
  const invoiceRow = ['invoice','','"'+client+'"',invRef,invNum,'2026-08-20','Fully Paid','','','','','115','Riyadh','Test'].join(',');
  const itemRow = ['item','Direct Hotels','', invRef, '', '', '', 'Hotel service fee','Yes','0','115','','',''].join(',');
  const csv = [header, invoiceRow, itemRow].join('\n');
  const path='/tmp/s4-twin-probe.csv';
  fs.writeFileSync(path, csv);

  await page.evaluate(()=>{ finGo('import'); });
  await page.waitForTimeout(1500);
  await page.setInputFiles('#finFile', path);
  await page.evaluate(()=>finParse());
  await page.waitForTimeout(2000);

  const previewText = await page.evaluate(()=>document.getElementById('finImpOut').textContent);
  if(!/retire/i.test(previewText)&&!/تتقاعد/.test(previewText)) fails.push('preview did not mention retiring a superseded transaction — got: '+previewText.slice(0,200));
  else notes.push('preview correctly flags the superseded transaction before commit');

  const supCount = await page.evaluate(()=>(window.FIN&&FIN._supersede||[]).length);
  if(supCount!==1) fails.push('FIN._supersede should have exactly 1 entry — got '+supCount);
  else notes.push('FIN._supersede correctly identifies exactly 1 row to retire');

  await page.evaluate(()=>finCommit());
  await page.waitForTimeout(4000);

  const state = await page.evaluate(async (args)=>{
    const c=window.fc();
    const tx=await c.from('finance_invoices').select('id,deleted_at').eq('invoice_no',args.txRef).maybeSingle();
    const inv=await c.from('finance_invoices').select('id,transaction_ref,revenue_sar,profit_sar,integrity_status').eq('invoice_no',args.invRef).maybeSingle();
    return { txDeleted: !!(tx.data&&tx.data.deleted_at), inv: inv.data };
  }, {txRef, invRef});

  if(!state.txDeleted) fails.push('the old pending transaction was NOT retired (deleted_at still null)');
  else notes.push('old pending transaction retired (soft-deleted) after commit');
  if(!state.inv) fails.push('the new invoice row was not found after commit');
  else{
    if(state.inv.transaction_ref!==txRef) fails.push('new invoice transaction_ref should be '+txRef+', got '+state.inv.transaction_ref);
    else notes.push('new invoice correctly links back to the old transaction via transaction_ref');
    /* Found while building this probe: finance_derive_fields (the DB trigger) enforces
       revenue_sar = total_incl_vat_sar - wallet_portion_sar for EVERY row, confirmed against
       real existing invoices — "Revenue" in this app has always meant gross billed
       (cost + fee), not the fee-only pre-VAT figure parseDP() computes client-side. That's
       long-standing, pre-existing app behavior (not something this sitting touches), so the
       probe's expectation is fixed to match reality rather than the app being changed. */
    if(Number(state.inv.revenue_sar)!==115) fails.push('new invoice revenue_sar should be 115 (= total - wallet, the trigger\'s real rule), got '+state.inv.revenue_sar);
  }

  await page.evaluate(()=>{ FIN.rows=null; finLoad(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1500);
  await financeReady();
  const afterStage2 = await fingerprint();
  notes.push('AFTER STAGE 2: '+JSON.stringify(afterStage2));
  /* the money should now be counted EXACTLY ONCE — as the new paid invoice — not twice */
  if(afterStage2.revenue-before.revenue!==115) fails.push('Revenue delta from baseline should be exactly +115 (counted once, not twice) — got '+(afterStage2.revenue-before.revenue));
  if(afterStage2.outstanding!==before.outstanding) fails.push('Outstanding should be back to baseline (paid invoice, retired transaction) — got delta '+(afterStage2.outstanding-before.outstanding));
  if(afterStage2.invoices-before.invoices!==1) fails.push('Invoices count should be exactly +1, not +2 (no double count) — got delta '+(afterStage2.invoices-before.invoices));

  /* ---------------- cleanup ---------------- */
  const cleaned = await page.evaluate(async (args)=>{
    const c=window.fc();
    const r1=await c.from('finance_invoices').delete().eq('invoice_no',args.txRef).select();
    const r2=await c.from('finance_invoices').delete().eq('invoice_no',args.invRef).select();
    return {tx:(r1.data||[]).length, inv:(r2.data||[]).length};
  }, {txRef, invRef});
  notes.push('cleanup: removed '+cleaned.tx+' transaction row(s), '+cleaned.inv+' invoice row(s)');

  await page.evaluate(()=>{ FIN.rows=null; finLoad(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1500);
  const final = await fingerprint();
  if(JSON.stringify(final)!==JSON.stringify(before)) fails.push('after cleanup, fingerprint is not back to the exact baseline: '+JSON.stringify(final)+' vs '+JSON.stringify(before));
  else notes.push('fingerprint returned to the exact original baseline after cleanup');
}

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nS4-TWIN FAILS:\n  '+fails.join('\n  ') : '\nS4-TWIN OK · a transaction imported pending, later invoiced in a separate import, is correctly retired and counted exactly once — no double-counting');
await browser.close();
process.exit(fails.length?1:0);
