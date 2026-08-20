/* URGENT BUG VERIFICATION (2026-08-20) — "Wallet top-up" must be impossible to post into
   Finance as a service label, from ANY entry point. Found live by the owner's own hands-on
   testing: the Individual-bookings form's Service dropdown offered "Wallet top-up", and
   saving one flowed straight into Revenue/Profit/Received/Invoices — a direct violation of
   "I don't want any wallet top up details at all... on any reports."

   Two independent fixes verified here:
   1. 'Wallet top-up' removed from SVC_CATALOG — the single list every service dropdown in
      the app reads from (Individual bookings, Expenses, and any future one).
   2. The legacy CSV importer (js/16 rImport/finParse) had NO guard against a row whose
      products/notes mention "wallet"/"top-up" — unlike the Direct Payments Excel importer
      (js/41), which already skips these before they become a row. A matching guard is added
      here, mirroring the existing verification-services rejection already in place.        */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9948));
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

/* ---------------- 1. the reported bug: Individual-bookings Service dropdown ---------------- */
await page.evaluate(()=>{ finGo('b2c'); });
await page.waitForTimeout(2000);
const bcOptions = await page.evaluate(()=>[...document.querySelectorAll('#bc_svc option')].map(o=>o.value));
if(bcOptions.includes('Wallet top-up')) fails.push('Individual bookings: "Wallet top-up" is STILL a selectable Service option');
else notes.push('Individual bookings: "Wallet top-up" is gone from the Service dropdown ('+bcOptions.length+' options remain)');

/* ---------------- 2. same catalog, Expenses tab ---------------- */
await page.evaluate(()=>{ finGo('expenses'); });
await page.waitForTimeout(2000);
const expOptions = await page.evaluate(()=>[...document.querySelectorAll('#xp_svc option')].map(o=>o.value));
if(expOptions.includes('Wallet top-up')) fails.push('Expenses: "Wallet top-up" is STILL a selectable Service option');
else notes.push('Expenses: "Wallet top-up" is gone from the Service dropdown too (same shared catalog)');

/* ---------------- 3. the legacy CSV importer's new guard ---------------- */
await page.evaluate(()=>{ finGo('import'); });
await page.waitForTimeout(2000);
const hasDrop = await page.evaluate(()=>!!document.getElementById('finFile'));
if(!hasDrop) fails.push('import: the CSV file input is not on the page — could not test the guard');
else{
  const header='client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes';
  const row=['Wallet Guard Test Co','August','Q3','WGT-PROBE-001','','Wallet Guard Test','2026-08-19','Direct Wallet top-up','500','500','0','0','0','verified_paid',''].join(',');
  const csv=header+'\n'+row+'\n';
  const path='/tmp/wallet-guard-probe.csv';
  await import('fs').then(fs=>fs.writeFileSync(path,csv));
  await page.setInputFiles('#finFile', path);
  await page.evaluate(()=>finParse());
  await page.waitForTimeout(1500);
  const out = await page.evaluate(()=>document.getElementById('finImpOut').textContent);
  if(!/wallet top-ups are never Finance revenue/i.test(out)) fails.push('import: a row whose products mention "wallet" was NOT flagged/rejected — got: '+out.slice(0,200));
  else notes.push('import: a wallet-mentioning CSV row is correctly flagged and rejected, not offered for import');
  if(/Ready to import: <b>1<\/b>/.test(out)||/Confirm import of 1 rows/.test(out)) fails.push('import: the wallet row still shows as ready-to-import despite being flagged');
}

/* ---------------- 4. money untouched — this was a UI/classifier fix, no data touched ---------------- */
await financeReady();
const after = await fingerprint();
notes.push('AFTER: '+JSON.stringify(after));
if(JSON.stringify(before)!==JSON.stringify(after)) fails.push('Finance figures moved from a pure dropdown/classifier fix — should be impossible: '+JSON.stringify(before)+' vs '+JSON.stringify(after));
else notes.push('Finance figures byte-identical before/after — this was a UI/classifier-only fix, exactly as expected');

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nWALLET-GUARD FAILS:\n  '+fails.join('\n  ') : '\nWALLET-GUARD OK · wallet top-up is unselectable everywhere the shared catalog feeds, the legacy CSV importer now rejects it too, and Finance figures did not move');
await browser.close();
process.exit(fails.length?1:0);
