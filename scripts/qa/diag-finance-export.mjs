/* Finance "Export ▾" dropdown — the four labeled buttons must each produce their OWN
   format, not the same JSON backup file relabeled. Found by the owner's own hands-on
   round-trip testing (hooked URL.createObjectURL, compared blob content across buttons —
   all four non-JSON buttons produced byte-identical JSON output, same 752,714 bytes).

   Root cause: exportCurrent()'s per-page map (core-05-records.js) had no 'finance' entry,
   so every scope fell through to exportData() (the full app-state JSON backup) regardless
   of which button was clicked. Fixed by adding a 'finance' entry that reads FIN._csvRows
   (the currently-filtered Ledger rows — the same source the already-working finCSV()
   button uses) with a summary column list; CSV vs Excel and summary vs full are handled by
   the same generic downloadCSV/downloadXLS logic every other page already uses.          */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9949));
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

/* visit Ledger first so FIN._csvRows is populated, same precondition finCSV() already has */
await page.evaluate(()=>{ finGo('ledger'); });
await page.waitForTimeout(1800);
const rowCount = await page.evaluate(()=>(window.FIN&&FIN._csvRows||[]).length);
notes.push('FIN._csvRows populated: '+rowCount+' rows');
if(!rowCount) fails.push('FIN._csvRows is empty after visiting Ledger — cannot test the export buttons meaningfully');

async function clickExport(scope){
  const [dl] = await Promise.all([
    page.waitForEvent('download', {timeout:15000}),
    page.evaluate(s=>expGo(s), scope)
  ]);
  const path = await dl.path();
  const fs = await import('fs');
  const buf = fs.readFileSync(path);
  return { name: dl.suggestedFilename(), size: buf.length, head: buf.toString('utf8').slice(0,300) };
}

const seen={};
for(const [scope,label] of [['list','CSV - summary'],['full','CSV - full details'],['xlsList','Excel - summary'],['xlsFull','Excel - full details']]){
  try{
    const r = await clickExport(scope);
    seen[scope]=r;
    notes.push(label+' → '+r.name+' ('+r.size+' bytes)');
  }catch(e){ fails.push(label+': export did not trigger a download — '+String(e).slice(0,150)); }
}

/* the actual bug check: none of these four should be the JSON backup */
Object.entries(seen).forEach(([scope,r])=>{
  if(/^\{/.test(r.head.trim())||/"deletedAt"|"businesses"|"assignedTo"/.test(r.head)) fails.push(scope+': looks like the JSON backup, not its own format — head: '+r.head.slice(0,100));
});
/* CSV vs Excel must actually differ in format */
if(seen.list && seen.xlsList){
  if(seen.list.head.slice(0,50)===seen.xlsList.head.slice(0,50)) fails.push('CSV - summary and Excel - summary produced identical output — still not differentiated by format');
  if(!/<table|<html/i.test(seen.xlsList.head)) fails.push('Excel - summary does not look like the HTML-table .xls format downloadXLS() produces');
  if(/<table|<html/i.test(seen.list.head)) fails.push('CSV - summary looks like HTML, not CSV');
}
/* summary vs full must actually differ in column count */
if(seen.list && seen.full){
  const colsSummary=(seen.list.head.split('\n')[0]||'').split(',').length;
  const colsFull=(seen.full.head.split('\n')[0]||'').split(',').length;
  notes.push('CSV columns — summary: '+colsSummary+' · full: '+colsFull);
  if(colsFull<=colsSummary) fails.push('CSV full details does not have more columns than the summary ('+colsFull+' vs '+colsSummary+')');
}
/* headers should be real Finance field names, not JSON keys */
if(seen.list && !/invoice_no|client_group|revenue_sar/.test(seen.list.head)) fails.push('CSV - summary header does not look like real Finance columns: '+seen.list.head.slice(0,120));

/* ---------------- money untouched — this was an export-only fix ---------------- */
await financeReady();
const after = await fingerprint();
notes.push('AFTER: '+JSON.stringify(after));
if(JSON.stringify(before)!==JSON.stringify(after)) fails.push('Finance figures moved from an export-only fix — should be impossible');
else notes.push('Finance figures byte-identical before/after — exporting never writes anything');

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nFIN-EXPORT FAILS:\n  '+fails.join('\n  ') : '\nFIN-EXPORT OK · all four buttons produce their own distinct, correctly-formatted output, real Finance headers, summary has fewer columns than full, and Finance figures did not move');
await browser.close();
process.exit(fails.length?1:0);
