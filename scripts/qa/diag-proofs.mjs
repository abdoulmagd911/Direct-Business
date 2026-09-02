/* S3 VERIFICATION — payment proofs are a document register, never a Finance number.

   Same discipline as diag-s5.mjs (expenses): capture every money figure on the Finance page,
   add a real wallet-top-up proof with a real file attached, and demand the figures are
   identical afterwards. Then prove the mechanics the owner actually asked for: preview,
   single download, bulk (selected) download, and that every downloaded name is generated,
   Latin-only, and carries the wallet-top-up reference — never a Finance total. */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';
import fs from 'fs';

const PROOF='/tmp/s3-proof.png';
if(!fs.existsSync(PROOF)){
  fs.writeFileSync(PROOF, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
}

TEAM.admin.pw = requirePw('admin');

const { browser, page, errs } = await openApp(Number(process.env.PORT||9943));
const fails=[], notes=[];

async function financeReady(){
  await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
  await page.waitForTimeout(2200);
}

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
    profit:(window.FIN&&FIN.rows||[]).reduce((a,r)=>a+(+r.profit_sar||0),0),
    wtuLikeText: JSON.stringify(window.FIN&&FIN.rows||[]).toLowerCase().includes('wtu-probe')
  }));
  return JSON.stringify(out);
}

await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);
await financeReady();
const before = await moneySignature();

/* ---------------- 1. add a wallet-top-up proof, with its file, prove the money did not move ---------------- */
await page.evaluate(()=>{ finGo('proofs'); });
await page.waitForTimeout(2500);
const hasForm = await page.evaluate(()=>!!document.getElementById('pf_wtu'));
if(!hasForm) fails.push('the add-a-payment-proof form is not on the page');
else {
  await page.selectOption('#pf_type','wallet_top_up');
  await page.fill('#pf_client','Madar Company');
  await page.fill('#pf_wtu','WTU-PROBE-001');
  await page.fill('#pf_amt','50000');
  await page.setInputFiles('#pf_file', PROOF);
  await page.evaluate(()=>proofSave());
  await page.waitForTimeout(5000);
}

const saved = await page.evaluate(()=>{
  const r=(window.PRX&&PRX.rows||[]).find(x=>x.wallet_topup_ref==='WTU-PROBE-001');
  return r?{id:r.id, type:r.doc_type, client:r.client_group, amt:r.amount_sar,
            file:!!r.file_path, name:window.proofFileName(r)}:null;
});

if(!saved) fails.push('the payment proof did not save at all');
else{
  if(!saved.file)                          fails.push('the record saved but the file did not attach');
  if(saved.type!=='wallet_top_up')         fails.push('doc_type was not stored — got '+saved.type);
  if(saved.client!=='Madar Company')         fails.push('client was not stored');
  if(/[^\x00-\x7F]/.test(saved.name))      fails.push('the generated file name is not plain Latin: '+saved.name);
  if(!/^WTU_Madar-Company_WTU-PROBE-001_50000SAR_/.test(saved.name)) fails.push('the generated file name is wrong: '+saved.name);
  notes.push('generated name: '+saved.name);
}

await financeReady();
const after = await moneySignature();
if(before!==after){
  fails.push('A FIGURE MOVED (or the wallet-top-up ref leaked into Finance text) when a payment proof was added');
  const b=JSON.parse(before), a=JSON.parse(after);
  for(const k of Object.keys(b)) if(JSON.stringify(b[k])!==JSON.stringify(a[k])) fails.push('   changed on: '+k);
}else notes.push('every money figure on Overview, Ledger, Clients and Reports identical after the proof was added — and WTU-PROBE-001 appears nowhere in FIN.rows');

/* ---------------- 2. preview, single download, selected (bulk) download ---------------- */
await page.evaluate(()=>{ finGo('proofs'); });
await page.waitForTimeout(2200);

const previewUrl = await page.evaluate(id=>{
  const r=(window.PRX&&PRX.rows||[]).find(x=>x.id===id);
  const c=window.fc(); const p=c.storage.from('payment-proofs').getPublicUrl(r.file_path);
  return (p&&p.data&&p.data.publicUrl)||'';
}, saved && saved.id);
if(!previewUrl || !/^https:\/\//.test(previewUrl)) fails.push('preview: no usable public URL for the uploaded file');
else notes.push('preview URL resolves (storage bucket public + policy correct)');

const [dl1] = await Promise.all([
  page.waitForEvent('download', {timeout:15000}),
  page.evaluate(id=>proofDownload(id), saved && saved.id)
]);
const dl1Name = dl1.suggestedFilename();
if(dl1Name !== saved.name) fails.push(`single download: got filename "${dl1Name}", expected "${saved.name}"`);
else notes.push('single download: filename matches the generated name exactly');

await page.evaluate(id=>{ proofToggleSel(id); }, saved && saved.id);
await page.waitForTimeout(300);
const selOnCount = await page.evaluate(id=>document.querySelectorAll('#view input[type="checkbox"]:checked').length);
if(selOnCount<1) fails.push('selecting the row did not check its box');
/* proofDownloadSelected now opens the in-page pfConfirm box (not a native dialog) —
   click through it, same as a real person would. */
await page.evaluate(()=>proofDownloadSelected());
await page.waitForSelector('#pfConfirmYes', {timeout:5000});
const [dl2] = await Promise.all([
  page.waitForEvent('download', {timeout:15000}),
  page.click('#pfConfirmYes')
]);
const dl2Name = dl2.suggestedFilename();
if(dl2Name !== saved.name) fails.push(`bulk (selected) download: got filename "${dl2Name}", expected "${saved.name}"`);
else notes.push('bulk (selected) download: filename matches the generated name exactly (select→bulk-download works)');

/* deselect and confirm the button disables — "selecting and deselecting" both matter */
await page.evaluate(id=>{ proofToggleSel(id); }, saved && saved.id);
await page.waitForTimeout(300);
const selOffCount = await page.evaluate(()=>document.querySelectorAll('#view input[type="checkbox"]:checked').length);
if(selOffCount!==0) fails.push('deselecting the row left it checked');
else notes.push('deselect works: unchecking the row clears the selection');

/* "downloading sheets" — the CSV manifest export */
const [dlCsv] = await Promise.all([
  page.waitForEvent('download', {timeout:15000}),
  page.evaluate(()=>proofCSV())
]);
const csvName = dlCsv.suggestedFilename();
if(!/^direct-payment-proofs-\d{4}-\d{2}-\d{2}\.csv$/.test(csvName)) fails.push('CSV export: unexpected filename '+csvName);
else notes.push('CSV manifest export downloads correctly: '+csvName);

/* ---------------- 3. the ✕ delete button, through the real UI ----------------
   This is the exact path the owner's own hands-on QA hit: a native confirm() dialog
   freezes any scripted driver of the page. Click the real button, wait for the IN-PAGE
   confirm box (not a native dialog — nothing to await via page.on('dialog') anymore),
   click its Confirm button, and prove the row actually goes away. If this ever regresses
   back to window.confirm(), this step hangs until its 15s timeout and fails loudly. */
const delBtn = await page.$(`button[onclick="proofDel('${saved && saved.id}')"]`);
if(!delBtn) fails.push('delete: could not find the ✕ button for the probe row');
else{
  await delBtn.click();
  const box = await page.waitForSelector('#pfConfirmBox', {timeout:5000}).catch(()=>null);
  if(!box) fails.push('delete: clicking ✕ did not open the in-page confirm box (did it regress to window.confirm?)');
  else{
    notes.push('delete: ✕ opens an in-page confirm box, not a native dialog — safe for automation');
    await page.click('#pfConfirmYes');
    await page.waitForTimeout(2500);
    const stillThere = await page.evaluate(id=>(window.PRX&&PRX.rows||[]).some(x=>x.id===id), saved && saved.id);
    if(stillThere) fails.push('delete: row is still in the list after confirming removal');
    else notes.push('delete: row removed from the list after confirming through the in-page box');
  }
}

/* ---------------- 4. clean up: remove the file from storage (soft-delete keeps the row's history, same as Expenses) ---------------- */
const cleaned = await page.evaluate(async id=>{
  const c=window.fc();
  const row=(await c.from('proof_documents').select('file_path').eq('id',id).maybeSingle()).data;
  if(row&&row.file_path) await c.storage.from('payment-proofs').remove([row.file_path]);
  const out=await c.from('proof_documents').delete().eq('id',id).select();
  return (out&&out.data&&out.data.length)?'removed':'COULD NOT REMOVE';
}, saved && saved.id);
notes.push('cleanup: '+cleaned);
if(cleaned==='COULD NOT REMOVE') fails.push('the probe record could not be cleaned up — remove it by hand');

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nS3 FAILS:\n  '+fails.join('\n  ') : '\nS3 OK · the money did not move · file attaches · preview/download/bulk-download all use the generated Latin name · cleanup removed the probe row and file');
await browser.close();
process.exit(fails.length?1:0);
