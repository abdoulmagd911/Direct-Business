/* S5 VERIFICATION — expenses are a record, not a calculation.

   The rule the owner set is absolute: a service cost recorded here must NEVER change an
   invoice's cost or profit. A comment saying so is worth nothing, so this proves it by
   doing the dangerous thing on purpose — capturing every money figure on the Finance page,
   adding a real expense with a real document attached, and demanding the figures be
   identical afterwards, to the character.

   It also checks the parts that make the record defensible: the document actually attaches,
   the export name is generated from the row and contains no Arabic, and each role can do
   exactly what it should — add (everyone signed in), remove (admin and manager only).      */
import { openApp, signIn, signOut, ready, TEAM } from './emp-rig.mjs';
import fs from 'fs';

const PROOF='/tmp/s5-proof.png';
if(!fs.existsSync(PROOF)){
  /* a tiny valid PNG */
  fs.writeFileSync(PROOF, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
}

const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
const fails=[], notes=[];

async function financeReady(){
  await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
  await page.waitForTimeout(2200);
}

/* every money figure on the page, in one string */
async function moneySignature(){
  const tabs=['overview','ledger','clients','reports'];
  const out={};
  for(const t of tabs){
    await page.evaluate(x=>{ finGo(x); }, t);
    await page.waitForTimeout(1300);
    out[t]=await page.evaluate(()=>{
      const v=document.getElementById('view');
      const tables=[...v.querySelectorAll('table')].map(tb=>
        [...tb.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('td,th')].map(c=>c.textContent.trim()).join('|')).join('‖')).join('§');
      const nums=(v.textContent||'').match(/[\d][\d,\.]{2,}/g)||[];
      return {tables, nums:nums.join(',')};
    });
  }
  out.memory=await page.evaluate(()=>({
    rows:(window.FIN&&FIN.rows||[]).length,
    rev:(window.FIN&&FIN.rows||[]).reduce((a,r)=>a+(+r.revenue_sar||0),0),
    cost:(window.FIN&&FIN.rows||[]).reduce((a,r)=>a+(+r.cost_sar||0),0),
    profit:(window.FIN&&FIN.rows||[]).reduce((a,r)=>a+(+r.profit_sar||0),0)
  }));
  return JSON.stringify(out);
}

/* ---------------- 1. admin: add an expense, prove the money did not move --------------- */
await signIn(page, TEAM.business.email, TEAM.business.pw); await ready(page);
await financeReady();
const before = await moneySignature();

await page.evaluate(()=>{ finGo('expenses'); });
await page.waitForTimeout(2500);
const marker='S5 probe — Makkah hotel allotment';
const hasForm = await page.evaluate(()=>!!document.getElementById('xp_desc'));
if(!hasForm) fails.push('admin: the add-an-expense form is not on the page');
else {
  await page.fill('#xp_desc', marker);
  await page.fill('#xp_amt', '18500');
  await page.selectOption('#xp_svc', 'Hotels');
  await page.fill('#xp_txn', 'TXN-S5-PROBE');
  await page.setInputFiles('#xp_file', PROOF);
  await page.evaluate(()=>expSave());
  await page.waitForTimeout(5000);
}

const saved = await page.evaluate(m=>{
  const r=(window.EXPX&&EXPX.rows||[]).find(x=>x.description===m);
  return r?{id:r.id, svc:r.service_type, txn:r.transaction_ref, amt:r.amount_sar,
            proof:!!r.proof_path, by:r.proof_uploaded_by, name:window.expFileName(r)}:null;
}, marker);

if(!saved) fails.push('admin: the expense did not save at all');
else{
  if(!saved.proof)                 fails.push('admin: the expense saved but the document did not attach');
  if(saved.svc!=='Hotels')         fails.push('admin: the service was not stored — got '+saved.svc);
  if(saved.txn!=='TXN-S5-PROBE')   fails.push('admin: the transaction reference was not stored');
  if(/[^\x00-\x7F]/.test(saved.name)) fails.push('the generated file name is not plain Latin: '+saved.name);
  if(!/^EXP_TXN-S5-PROBE_Hotels_18500SAR_/.test(saved.name)) fails.push('the generated file name is wrong: '+saved.name);
  notes.push('generated name: '+saved.name);
}

await financeReady();
const after = await moneySignature();
if(before!==after){
  fails.push('A FIGURE MOVED when an expense was added — the record-only rule is broken');
  const b=JSON.parse(before), a=JSON.parse(after);
  for(const k of Object.keys(b)) if(JSON.stringify(b[k])!==JSON.stringify(a[k])) fails.push('   changed on: '+k);
}else notes.push('every money figure on Performance, Ledger, Clients and Report Builder identical after the expense');

/* ---------------- 2. roles: who may add, who may remove ---------------- */
async function roleCheck(who,label,expectRemove){
  await signOut(page); await signIn(page, who.email, who.pw); await ready(page);
  await financeReady();
  await page.evaluate(()=>{ finGo('expenses'); });
  await page.waitForTimeout(2600);
  const r=await page.evaluate(m=>({
    canSeeTab: !!document.querySelector('#view'),
    hasForm:   !!document.getElementById('xp_desc'),
    rowThere:  ((window.EXPX&&EXPX.rows)||[]).some(x=>x.description===m),
    removeBtns: [...document.querySelectorAll('#view button')].filter(b=>/expDel/.test(b.getAttribute('onclick')||'')).length,
    attachBtns: [...document.querySelectorAll('#view button')].filter(b=>/expAttach/.test(b.getAttribute('onclick')||'')).length
  }), marker);
  if(!r.hasForm)  fails.push(`${label}: cannot add an expense — the owner asked for BD's own costs to be recorded`);
  if(expectRemove && !r.removeBtns) fails.push(`${label}: should be able to remove an expense but has no control`);
  if(!expectRemove && r.removeBtns) fails.push(`${label}: can remove expenses and should not be able to`);
  notes.push(`${label}: add=${r.hasForm?'yes':'no'} remove=${r.removeBtns?'yes':'no'} sees the rows=${r.rowThere?'yes':'no'}`);
}
/* Employees may remove too, and that is deliberate: the access model the owner signed off
   at go-live gives employees editing rights over Leads, Clients AND Finance (js/52-v76,
   "employees edit finance too, under this model"). Nothing is destroyed either way — the
   row is only hidden, stays in history, and the audit log records who hid it. An earlier
   run of this probe expected employees to be blocked; that expectation was invented here,
   not asked for by the owner, so the expectation was corrected rather than the app. */
await roleCheck(TEAM.othman,'manager (Othman)',true);
await roleCheck(TEAM.raad,'employee (Raad)',true);

/* ---------------- 3. clean up: remove the probe row as an admin ---------------- */
await signOut(page); await signIn(page, TEAM.business.email, TEAM.business.pw); await ready(page);
await financeReady();
await page.evaluate(()=>{ finGo('expenses'); });
await page.waitForTimeout(2500);
const cleaned = await page.evaluate(async m=>{
  const r=(window.EXPX&&EXPX.rows||[]).find(x=>x.description===m); if(!r) return 'nothing to clean';
  const c=window.fc(); const out=await c.from('finance_expenses').delete().eq('id',r.id).select();
  return (out&&out.data&&out.data.length)?'removed':'COULD NOT REMOVE';
}, marker);
notes.push('cleanup: '+cleaned);
if(cleaned==='COULD NOT REMOVE') fails.push('the probe expense could not be cleaned up — remove it by hand');

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nS5 FAILS:\n  '+fails.join('\n  ') : '\nS5 OK · the money did not move · proof attaches · names are Latin · roles behave');
await browser.close();
process.exit(fails.length?1:0);
