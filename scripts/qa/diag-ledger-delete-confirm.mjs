/* Ledger "Delete invoice" — must use an in-page confirm, not window.confirm().
   Found by the owner's own hands-on QA: the native dialog froze the automation tab (same
   failure mode the Payment proofs chapter had before js/57 introduced pfConfirm). Both
   finDelInv() (by invoice_no, from the invoice detail modal) and finDel() (by row id) are
   fixed here to reuse that same in-page box.                                              */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9950));
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

/* insert a probe row directly (the manual "New invoice" mirror is deliberately folded away —
   this exercises the real delete/restore path exactly like an imported row would) */
const probeNo = 'DELCONFIRM-PROBE-'+Date.now();
const inserted = await page.evaluate(async no=>{
  const c=window.fc();
  const r=await c.from('finance_invoices').insert({
    invoice_no:no, revenue_way:'invoice', record_type:'b2b', client_group:'Delete-Confirm Probe',
    invoice_date:new Date().toISOString().slice(0,10), total_incl_vat_sar:250, wallet_portion_sar:0,
    cost_sar:50, amount_received_sar:250, amount_remaining_sar:0, integrity_status:'verified_paid'
  }).select();
  return r.error ? {error:r.error.message} : {id:r.data[0].id};
}, probeNo);
if(inserted.error){ fails.push('could not insert the probe invoice: '+inserted.error); }
else{
  notes.push('probe invoice inserted: '+probeNo+' (revenue 250, cost 50, profit 200)');
  /* A direct insert bypasses the app entirely — window.FIN.rows only knows about it once
     finLoad() re-fetches. financeReady() alone just re-renders whatever is already cached,
     so it must be forced here or every figure below silently compares against a stale
     snapshot (found the hard way: the first run of this exact probe compared a pre-insert
     baseline against a post-delete state that never actually knew the row existed, and
     "passed" a delete that was never really tested). */
  await page.evaluate(()=>{ FIN.rows=null; finLoad(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1500);
  await financeReady();
  const afterInsert = await fingerprint();
  notes.push('AFTER INSERT (forced reload): '+JSON.stringify(afterInsert));
  if(afterInsert.revenue-before.revenue!==250) fails.push('Revenue did not rise by exactly 250 after inserting the probe — got delta '+(afterInsert.revenue-before.revenue)+' (fingerprint may still be stale)');
  await page.evaluate(()=>{ finGo('ledger'); });
  await page.waitForTimeout(1500);

  /* ---------------- open the REAL invoice detail modal, click the REAL button ----------------
     The first version of this probe called finDelInv() directly via page.evaluate(), which
     never actually created the invoice modal (`ov`, z-index:999999) — so it never caught that
     pfConfirmBox (z-index:99998 at the time) was rendering INVISIBLY BEHIND that modal. The
     owner's own hands-on click on the real button found that; this now reproduces the exact
     real flow: click the row to open the modal, click the actual button inside it. */
  await page.evaluate(no=>{
    const r=(window.FIN.rows||[]).find(x=>x.invoice_no===no); if(r) finRow(r.id);
  }, probeNo);
  await page.waitForTimeout(1200);
  const delBtn = await page.$(`button[onclick^="finDelInv("]`);
  if(!delBtn) fails.push('could not find the real "Delete invoice" button inside the opened modal');
  else await delBtn.click();
  const box = await page.waitForSelector('#pfConfirmBox', {timeout:5000}).catch(()=>null);
  if(!box) fails.push('finDelInv: did not open the in-page confirm box (did it regress to window.confirm?)');
  else{
    const visible = await page.isVisible('#pfConfirmYes').catch(()=>false);
    if(!visible) fails.push('finDelInv: the confirm box exists in the DOM but its Confirm button is not visible/clickable — likely hidden behind another overlay (z-index)');
    notes.push('finDelInv: opens the in-page confirm box, not a native dialog — safe for automation');
    await page.click('#pfConfirmYes');
    await page.waitForTimeout(2500);
    const gone = await page.evaluate(no=>!(window.FIN.rows||[]).some(r=>r.invoice_no===no&&!r.deleted_at), probeNo);
    if(!gone) fails.push('finDelInv: the row is still live after confirming the delete');
    else notes.push('finDelInv: the invoice is soft-deleted after confirming through the in-page box');
  }

  await financeReady();
  const afterDelete = await fingerprint();
  notes.push('AFTER DELETE: '+JSON.stringify(afterDelete));
  if(afterInsert.revenue-afterDelete.revenue!==250) fails.push('Revenue did not drop by exactly 250 after deleting the probe — got delta '+(afterInsert.revenue-afterDelete.revenue));
  if(afterInsert.profit-afterDelete.profit!==200) fails.push('Profit did not drop by exactly 200 after deleting the probe — got delta '+(afterInsert.profit-afterDelete.profit));
  if(JSON.stringify(afterDelete)!==JSON.stringify(before)) fails.push('after deleting, fingerprint should equal the true pre-insert baseline but does not: '+JSON.stringify(afterDelete)+' vs '+JSON.stringify(before));

  /* ---------------- restore, prove it comes back clean ---------------- */
  await page.evaluate(no=>finRestoreInv(no), probeNo);
  await page.waitForTimeout(2500);
  await financeReady();
  const afterRestore = await fingerprint();
  /* restoring brings the probe row BACK — compare against afterInsert (the state WITH the
     row live), not `before` (the state before the row ever existed) */
  if(JSON.stringify(afterRestore)!==JSON.stringify(afterInsert)) fails.push('after restoring, the fingerprint did not return to the with-probe baseline: '+JSON.stringify(afterRestore)+' vs '+JSON.stringify(afterInsert));
  else notes.push('finRestoreInv: fingerprint returned to the exact with-probe baseline after restoring');

  /* ---------------- cleanup: hard-remove the probe row ---------------- */
  const cleaned = await page.evaluate(async id=>{
    const c=window.fc();
    const out=await c.from('finance_invoices').delete().eq('id',id).select();
    return (out&&out.data&&out.data.length)?'removed':'COULD NOT REMOVE';
  }, inserted.id);
  notes.push('cleanup: '+cleaned);
  if(cleaned==='COULD NOT REMOVE') fails.push('the probe invoice could not be cleaned up — remove it by hand: '+probeNo);

  /* another direct DB call bypassing the app — force the reload again before the final check */
  await page.evaluate(()=>{ FIN.rows=null; finLoad(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1500);
  const finalFp = await fingerprint();
  if(JSON.stringify(finalFp)!==JSON.stringify(before)) fails.push('after cleanup, fingerprint is not back to baseline: '+JSON.stringify(finalFp));
}

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nLEDGER-DELETE FAILS:\n  '+fails.join('\n  ') : '\nLEDGER-DELETE OK · finDelInv uses the in-page confirm box, delete/restore move the exact expected amounts, and cleanup returned Finance to the exact baseline');
await browser.close();
process.exit(fails.length?1:0);
