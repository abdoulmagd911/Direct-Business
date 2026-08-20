/* S3 part 2 VERIFICATION — an individual booking is a real revenue row, on the same trigger
   path as the other four patterns, and Overview/Invoices count it correctly.

   Fingerprint uses the EXACT same computation the Overview tab renders (verified() + live()
   + finInPeriod, the same primitives rOverview() itself calls) rather than an independent
   re-derivation — the owner's own hands-on check caught a mismatch here once already (S3
   part 1's SQL fingerprint didn't match the dashboard's verified-paid-only figures), so this
   probe reads the app's own logic instead of guessing at it a second time. */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9946));
const fails=[], notes=[];

async function financeReady(){
  await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
  await page.waitForTimeout(2200);
}

/* the exact figures the Overview tab renders — same primitives, same period filter */
async function overviewFingerprint(){
  await page.evaluate(()=>{ finGo('overview'); });
  await page.waitForTimeout(1300);
  return page.evaluate(()=>{
    /* verified()/live() are private to the js/16 IIFE — replicated here by their own exact
       definitions (live = !deleted_at, verified = live + integrity_status==='verified_paid'),
       same as rOverview() itself computes. finInPeriod IS exposed on window, used unchanged. */
    const live=(window.FIN.rows||[]).filter(r=>!r.deleted_at);
    const V=live.filter(r=>r.integrity_status==='verified_paid').filter(window.finInPeriod);
    let rev=0,cost=0,prof=0,rec=0; V.forEach(r=>{rev+=+r.revenue_sar;cost+=+r.cost_sar;prof+=+r.profit_sar;rec+=+r.amount_received_sar;});
    let rem=0; live.filter(window.finInPeriod).forEach(r=>{rem+=+r.amount_remaining_sar||0;});
    const invCount=new Set(V.map(r=>r.invoice_no)).size;
    return {revenue:rev,cost,profit:prof,received:rec,outstanding:rem,invoices:invCount};
  });
}

/* the same tables/numbers diag-s5 and diag-proofs already fingerprint, for a wider net */
async function moneySignature(){
  const tabs=['ledger','clients','reports'];
  const out={};
  for(const t of tabs){
    await page.evaluate(x=>{ finGo(x); }, t);
    await page.waitForTimeout(1300);
    out[t]=await page.evaluate(()=>{
      const v=document.getElementById('view');
      const tables=[...v.querySelectorAll('table')].map(tb=>
        [...tb.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('td,th')].map(c=>c.textContent.trim()).join('|')).join('‖')).join('§');
      return {tables};
    });
  }
  return JSON.stringify(out);
}

await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);
await financeReady();
const before = await overviewFingerprint();
notes.push('BEFORE (Overview tab math): Revenue '+before.revenue+' · Cost '+before.cost+' · Profit '+before.profit+' · Received '+before.received+' · Outstanding '+before.outstanding+' · Invoices '+before.invoices);

/* ---------------- 1. add an individual booking (Paid), through the real form ---------------- */
await page.evaluate(()=>{ finGo('b2c'); });
await page.waitForTimeout(2200);
const hasForm = await page.evaluate(()=>!!document.getElementById('bc_name'));
if(!hasForm) fails.push('the add-an-individual-booking form is not on the page');
else{
  /* Unique per run — a fixed name risks matching a leftover from a PRIOR run whose own
     cleanup failed (found the hard way: an earlier debug run's row got picked up by a
     later run's name-lookup, which deleted the wrong row and left the fresh one live in
     the real ledger). A fresh marker every run makes each probe self-contained. */
  const marker='S3 probe — Khalid Al-Otaibi '+Date.now();
  await page.fill('#bc_name', marker);
  await page.selectOption('#bc_svc','Hotels').catch(()=>{});
  await page.fill('#bc_amt','500');
  await page.fill('#bc_cost','100');
  await page.selectOption('#bc_status','verified_paid');
  await page.evaluate(()=>b2cSave());
  await page.waitForTimeout(3500);

  const saved = await page.evaluate(m=>{
    const r=(window.B2C&&B2C.rows||[]).find(x=>x.client_group===m);
    return r?{id:r.id, ref:r.invoice_no, way:r.revenue_way, rtype:r.record_type, revenue:r.revenue_sar, profit:r.profit_sar, status:r.integrity_status}:null;
  }, marker);

  if(!saved) fails.push('the individual booking did not save at all');
  else{
    notes.push('saved: ref='+saved.ref+' revenue_sar='+saved.revenue+' profit_sar='+saved.profit+' status='+saved.status);
    if(saved.way!=='b2c_manual') fails.push('revenue_way was not b2c_manual — got '+saved.way);
    if(saved.rtype!=='b2c') fails.push('record_type was not b2c — got '+saved.rtype);
    if(!saved.ref) fails.push('no invoice_no was generated — the Overview "Invoices" count would miss or merge this row');
    if(Number(saved.revenue)!==500) fails.push('revenue_sar should be 500 (total, no wallet) — got '+saved.revenue);
    if(Number(saved.profit)!==400) fails.push('profit_sar should be 400 (500 revenue - 100 cost) — got '+saved.profit);
  }

  await financeReady();
  const after = await overviewFingerprint();
  notes.push('AFTER: Revenue '+after.revenue+' · Cost '+after.cost+' · Profit '+after.profit+' · Received '+after.received+' · Outstanding '+after.outstanding+' · Invoices '+after.invoices);
  const dRev=after.revenue-before.revenue, dCost=after.cost-before.cost, dProf=after.profit-before.profit,
        dRec=after.received-before.received, dOut=after.outstanding-before.outstanding, dInv=after.invoices-before.invoices;
  if(dRev!==500) fails.push('Revenue moved by '+dRev+', expected exactly +500');
  if(dCost!==100) fails.push('Cost moved by '+dCost+', expected exactly +100');
  if(dProf!==400) fails.push('Profit moved by '+dProf+', expected exactly +400');
  if(dRec!==500) fails.push('Received moved by '+dRec+', expected exactly +500 (status=Paid)');
  if(dOut!==0) fails.push('Outstanding moved by '+dOut+', expected 0 (status=Paid → nothing remaining)');
  if(dInv!==1) fails.push('Invoices count moved by '+dInv+', expected exactly +1');
  if(!fails.length) notes.push('every figure moved by exactly the entered amount, nothing else shifted');

  /* ---------------- 2. delete through the real ✕ button + in-page confirm, prove it returns to baseline ---------------- */
  /* overviewFingerprint() switches to the Overview tab internally — switch back to b2c first */
  await page.evaluate(()=>{ finGo('b2c'); });
  await page.waitForTimeout(1500);
  const delBtn = await page.$(`button[onclick="b2cDel('${saved && saved.id}')"]`);
  if(!delBtn) fails.push('delete: could not find the ✕ button for the probe row');
  else{
    await delBtn.click();
    const box = await page.waitForSelector('#pfConfirmBox', {timeout:5000}).catch(()=>null);
    if(!box) fails.push('delete: clicking ✕ did not open the in-page confirm box');
    else{
      await page.click('#pfConfirmYes');
      await page.waitForTimeout(3000);
      await financeReady();
      const back = await overviewFingerprint();
      if(JSON.stringify(back)!==JSON.stringify(before)) fails.push('after removing the probe row, the fingerprint did not return to baseline: '+JSON.stringify(back)+' vs '+JSON.stringify(before));
      else notes.push('delete: fingerprint returned to exact baseline after removing the probe row');
    }
  }
}

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nS3-part2 FAILS:\n  '+fails.join('\n  ') : '\nS3-part2 OK · the booking added exactly the entered revenue/cost/profit/received, moved Outstanding correctly, counted as +1 invoice, and removing it returned every figure to baseline');
await browser.close();
process.exit(fails.length?1:0);
