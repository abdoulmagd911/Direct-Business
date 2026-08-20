/* Verifies the two fixes from the 2026-08-20 Finance audit:
   1. Ledger's own "Excel (CSV)" export now downloads the Ledger's line-level rows (via
      window.finLedgerCSV), not the Report Builder's grouped summary — checked from a COLD
      session state (Report Builder never visited), which was the silent-no-op case before.
   2. The "Who can open what" access-matrix panel no longer appears on Finance > Performance,
      and still appears correctly on Settings.                                                */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';
import fs from 'fs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9945));
const fails=[], notes=[];

await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);

/* ---------- Fix #1: Ledger export, cold state (never visited Report Builder) ---------- */
await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); if(typeof finGo==='function') finGo('ledger'); });
await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
await page.waitForTimeout(2000);

const coldCheck = await page.evaluate(()=>({ hasLastReport: !!(window.FIN&&FIN._lastReport), hasCsvRows: !!(window.FIN&&FIN._csvRows&&FIN._csvRows.length) }));
notes.push('cold state before clicking: '+JSON.stringify(coldCheck));
if(coldCheck.hasLastReport) fails.push('test setup problem: FIN._lastReport already set before Report Builder was ever visited — cannot prove the cold-state fix cleanly');

const [dl] = await Promise.all([
  page.waitForEvent('download', {timeout:8000}).catch(()=>null),
  page.evaluate(()=>{ try{ finLedgerCSV(); }catch(e){ window.__e=String(e); } })
]);
if(!dl){ fails.push('Ledger export: no download fired at all — '+(await page.evaluate(()=>window.__e||'no error captured'))); }
else{
  const p = await dl.path(); const text = fs.readFileSync(p,'utf8');
  const firstLine = text.split(/\r?\n/)[0];
  const fname = dl.suggestedFilename();
  notes.push('Ledger export fired: filename='+fname+' header='+firstLine);
  if(!/^direct-finance-\d{4}-\d{2}-\d{2}\.csv$/.test(fname)) fails.push('Ledger export filename looks wrong: '+fname);
  if(!/invoice_no/.test(firstLine) || !/invoice_date/.test(firstLine)) fails.push('Ledger export header does not look like invoice-level detail: '+firstLine);
  if(/^﻿Client \(linked\)/.test(firstLine) || /^Client \(linked\)/.test(firstLine)) fails.push('Ledger export is STILL the Report Builder grouped summary — fix did not take');
}

/* Sanity: window.finCSV (Report Builder) should still exist and be unaffected */
const reportFnStillThere = await page.evaluate(()=>typeof window.finCSV==='function');
if(!reportFnStillThere) fails.push('window.finCSV (Report Builder export) is missing — should be untouched');
else notes.push('window.finCSV (Report Builder export) still present and untouched');

/* ---------- Fix #2: access panel should NOT appear on Finance > Performance ---------- */
await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); if(typeof finGo==='function') finGo('overview'); });
await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
await page.waitForTimeout(2000);
const axOnFinance = await page.evaluate(()=>({
  hasAxHost: !!document.getElementById('axHost'),
  hasSaveAccessText: /Save access/.test((document.getElementById('view')||{}).innerText||'')
}));
notes.push('Finance > Performance: '+JSON.stringify(axOnFinance));
if(axOnFinance.hasAxHost || axOnFinance.hasSaveAccessText) fails.push('access-matrix panel STILL appears on Finance > Performance — fix did not take');
await page.screenshot({path:'/tmp/verify-fin-overview-after-fix.png', fullPage:true}).catch(()=>{});

/* ---------- Fix #2 sanity: access panel SHOULD still appear correctly on Settings ---------- */
await page.evaluate(()=>{ current='settings'; if(typeof render==='function') render(); });
await page.waitForTimeout(2500);
const axOnSettings = await page.evaluate(()=>({
  hasAxHost: !!document.getElementById('axHost'),
  hasSaveAccessText: /Save access/.test((document.getElementById('view')||{}).innerText||'')
}));
notes.push('Settings: '+JSON.stringify(axOnSettings));
if(!axOnSettings.hasAxHost || !axOnSettings.hasSaveAccessText) fails.push('access-matrix panel no longer appears on Settings — regression, should still be there');
await page.screenshot({path:'/tmp/verify-settings-after-fix.png', fullPage:true}).catch(()=>{});

/* ---------- also confirm other Finance sub-pages still clean (regression check) ---------- */
for(const tab of ['clients','expenses','proofs','b2c','reports','import']){
  await page.evaluate((t)=>{ current='finance'; if(typeof render==='function') render(); if(typeof finGo==='function') finGo(t); }, tab);
  await page.waitForTimeout(1200);
  const has = await page.evaluate(()=>!!document.getElementById('axHost'));
  if(has) fails.push('access-matrix panel now leaking onto Finance > '+tab+' too');
  else notes.push('Finance > '+tab+': clean (no axHost)');
}

/* ---------- Report Builder export still works (regression check) ---------- */
await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); if(typeof finGo==='function') finGo('reports'); });
await page.waitForTimeout(1500);
const [dl2] = await Promise.all([
  page.waitForEvent('download', {timeout:8000}).catch(()=>null),
  page.evaluate(()=>{ try{ finCSV(); }catch(e){ window.__e2=String(e); } })
]);
if(!dl2) fails.push('Report Builder export: no download fired — '+(await page.evaluate(()=>window.__e2||'no error captured')));
else{
  const p=await dl2.path(); const text=fs.readFileSync(p,'utf8');
  notes.push('Report Builder export still works: '+dl2.suggestedFilename()+' header='+text.split(/\r?\n/)[0]);
}

/* ---------- re-run Ledger export a SECOND time, now that Report Builder has been visited
   (the "warm" case) — must still give the ledger's own rows, not the report's ---------- */
await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); if(typeof finGo==='function') finGo('ledger'); });
await page.waitForTimeout(1500);
const [dl3] = await Promise.all([
  page.waitForEvent('download', {timeout:8000}).catch(()=>null),
  page.evaluate(()=>{ try{ finLedgerCSV(); }catch(e){ window.__e3=String(e); } })
]);
if(!dl3) fails.push('Ledger export (warm state, after visiting Report Builder): no download fired');
else{
  const p=await dl3.path(); const text=fs.readFileSync(p,'utf8');
  const firstLine=text.split(/\r?\n/)[0];
  notes.push('Ledger export warm state: '+dl3.suggestedFilename()+' header='+firstLine);
  if(!/invoice_no/.test(firstLine)) fails.push('Ledger export (warm state) no longer invoice-level — regression');
}

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,5)));

console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nVERIFY FAILS:\n  '+fails.join('\n  ') : '\nVERIFY OK · both fixes confirmed live, no regressions on the other Finance pages or Settings');
await browser.close();
process.exit(fails.length?1:0);
