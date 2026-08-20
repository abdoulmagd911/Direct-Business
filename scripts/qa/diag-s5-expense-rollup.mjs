/* S5 VERIFICATION — expenses show up next to their invoice, and NEVER move its cost/profit.
   "Roll-up" is display only: open an invoice, see what Direct Business has on file as the
   real cost behind it, right next to the invoice's own numbers from Direct Payments —
   without the two ever being merged into one figure (Decision 1, unchanged since S5 first
   shipped). This proves both halves: the panel actually shows the linked expense, and the
   invoice's own Revenue/Cost/Profit are byte-identical before and after it's shown.        */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9956));
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

const invNo = 'S5-ROLLUP-'+Date.now();
const marker = 'S5 rollup probe — hotel deposit';

const setup = await page.evaluate(async (args)=>{
  const c=window.fc();
  const inv=await c.from('finance_invoices').insert({
    invoice_no:args.invNo, revenue_way:'invoice', record_type:'b2b', client_group:'S5 Rollup Test',
    invoice_date:'2026-08-20', total_incl_vat_sar:300, wallet_portion_sar:0, cost_sar:200,
    amount_received_sar:300, amount_remaining_sar:0, integrity_status:'verified_paid'
  }).select();
  if(inv.error) return {error:'invoice: '+inv.error.message};
  const exp=await c.from('finance_expenses').insert({
    expense_date:'2026-08-19', description:args.marker, service_type:'Hotels',
    transaction_ref:args.invNo, amount_sar:180, paid_via:'bank_transfer', created_by:'QA'
  }).select();
  if(exp.error) return {error:'expense: '+exp.error.message, invId:inv.data[0].id};
  return {invId:inv.data[0].id, expId:exp.data[0].id};
}, {invNo, marker});

if(setup.error){ fails.push('setup failed: '+setup.error); }
else{
  notes.push('setup: invoice '+invNo+' (300 SAR, cost 200) + one linked expense (180 SAR) inserted');
  await page.evaluate(()=>{ FIN.rows=null; finLoad(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1500);
  await financeReady();

  await page.evaluate(no=>{
    const r=(window.FIN.rows||[]).find(x=>x.invoice_no===no); if(r) finRow(r.id);
  }, invNo);
  await page.waitForTimeout(1500);

  const rollup = await page.evaluate(m=>{
    const box=document.querySelector('#finModal .s5rollup');
    if(!box) return {found:false};
    return {found:true, text:box.textContent, mentionsMarker:box.textContent.indexOf(m)>=0, mentionsAmount:box.textContent.indexOf('180')>=0};
  }, marker);

  if(!rollup.found) fails.push('the expense roll-up panel did not appear in the invoice modal at all');
  else{
    if(!rollup.mentionsMarker) fails.push('roll-up panel did not show the linked expense description');
    else notes.push('roll-up panel correctly shows the linked expense');
    if(!rollup.mentionsAmount) fails.push('roll-up panel did not show the expense amount (180)');
    else notes.push('roll-up panel shows the correct amount');
  }

  /* the invoice's OWN numbers must be untouched by the expense existing */
  const invRow = await page.evaluate(no=>(window.FIN.rows||[]).find(x=>x.invoice_no===no), invNo);
  if(Number(invRow.cost_sar)!==200) fails.push('invoice cost_sar changed by the linked expense — should stay 200, got '+invRow.cost_sar);
  else notes.push('invoice cost_sar (200) untouched by the linked 180 SAR expense — record only, as required');
  if(Number(invRow.profit_sar)!==100) fails.push('invoice profit_sar should be 100 (300-200), got '+invRow.profit_sar);

  await page.evaluate(()=>{ var m=document.getElementById('finModal'); if(m)m.remove(); });

  await financeReady();
  const after = await fingerprint();
  notes.push('AFTER (with the expense existing, panel shown): '+JSON.stringify(after));
  /* the new invoice DOES add to the fingerprint (it's a real row) — check the delta matches
     exactly the invoice's own numbers, proving the expense contributed NOTHING to it */
  if(after.revenue-before.revenue!==300) fails.push('Revenue delta should be exactly +300 (the invoice only) — got '+(after.revenue-before.revenue));
  if(after.cost-before.cost!==200) fails.push('Cost delta should be exactly +200 (the invoice only, NOT +200+180) — got '+(after.cost-before.cost));
  if(after.profit-before.profit!==100) fails.push('Profit delta should be exactly +100 — got '+(after.profit-before.profit));

  const cleaned = await page.evaluate(async (args)=>{
    const c=window.fc();
    const r1=await c.from('finance_expenses').delete().eq('id',args.expId).select();
    const r2=await c.from('finance_invoices').delete().eq('id',args.invId).select();
    return {exp:(r1.data||[]).length, inv:(r2.data||[]).length};
  }, setup);
  notes.push('cleanup: removed '+cleaned.exp+' expense row(s), '+cleaned.inv+' invoice row(s)');

  await page.evaluate(()=>{ FIN.rows=null; finLoad(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1500);
  const final = await fingerprint();
  if(JSON.stringify(final)!==JSON.stringify(before)) fails.push('after cleanup, fingerprint is not back to the exact baseline: '+JSON.stringify(final)+' vs '+JSON.stringify(before));
  else notes.push('fingerprint returned to the exact original baseline after cleanup');
}

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nS5-ROLLUP FAILS:\n  '+fails.join('\n  ') : '\nS5-ROLLUP OK · the panel shows the linked expense correctly, and it never moves the invoice’s own cost/profit');
await browser.close();
process.exit(fails.length?1:0);
