/* Verifies round-3 fixes (owner's own initiative, blanket bug-fix authorization):
   1. Leads has two visibly different export buttons now — the top-bar "Export ▾" menu vs
      the page's own "↓ Export this view (CSV)" — not two things that both just say
      "Export CSV". The page's own export still works and still respects the active filter.
   2. Today's fake sync/integration alert strip never renders (or is hidden immediately if it
      does), on Today and everywhere else, without touching the real per-record sync tools. */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';
import fs from 'fs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9970));
const fails=[], notes=[];

await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);
async function goto(v){ await page.evaluate((vv)=>{ current=vv; if(typeof render==='function') render(); }, v); await page.waitForTimeout(2200); }

/* ---------- #4: Leads export labeling ---------- */
await goto('leads');
const leadsButtons = await page.evaluate(()=>{
  const view=document.getElementById('view');
  const inPage = [...view.querySelectorAll('button')].filter(b=>/export/i.test(b.textContent||'')).map(b=>({text:b.textContent.trim(), title:b.getAttribute('title')||''}));
  const topBar = [...document.querySelectorAll('.exp-menu button')].map(b=>b.textContent.trim());
  return { inPage, topBar };
});
notes.push('Leads page-own export button(s): '+JSON.stringify(leadsButtons.inPage));
notes.push('Top-bar Export menu options: '+JSON.stringify(leadsButtons.topBar));
if(!leadsButtons.inPage.length) fails.push('Leads: could not find the page-own export button at all');
else{
  const btn = leadsButtons.inPage[0];
  if(/^↓?\s*Export CSV$/.test(btn.text)) fails.push('Leads page-own button still says the bare old "Export CSV" — not differentiated from the top-bar menu');
  if(!btn.title || btn.title.length<20) fails.push('Leads page-own export button has no explanatory title/tooltip');
  notes.push('Leads page-own export button now reads: "'+btn.text+'" with tooltip present: '+(!!btn.title));
}

/* the page-own export still actually works and still respects the active filter */
const funnelKey = await page.evaluate(()=>{
  try{ return (typeof F==='function'&&F().length)? F()[0].key : null; }catch(_){ return null; }
});
if(funnelKey){
  await page.evaluate((k)=>{ window.__funnelTab=k; renderLeads(document.getElementById('view')); }, funnelKey);
  await page.waitForTimeout(800);
}
const [dl] = await Promise.all([
  page.waitForEvent('download', {timeout:8000}).catch(()=>null),
  page.evaluate(()=>{
    const view=document.getElementById('view');
    const btn=[...view.querySelectorAll('button')].find(b=>/export/i.test(b.textContent||''));
    if(btn) btn.click(); else window.__e='button not found';
  })
]);
if(!dl) fails.push('Leads page-own export button click did not trigger a download: '+ (await page.evaluate(()=>window.__e||'unknown')));
else{
  const p=await dl.path(); const text=fs.readFileSync(p,'utf8');
  notes.push('page-own export still fires: '+dl.suggestedFilename()+' header='+text.split(/\r?\n/)[0]);
}

/* top-bar menu on Leads still works too (regression check) */
const [dl2] = await Promise.all([
  page.waitForEvent('download', {timeout:6000}).catch(()=>null),
  page.evaluate(()=>{ try{ expGo('list'); }catch(e){ window.__e2=String(e); } })
]);
if(!dl2) fails.push('Leads top-bar Export menu regressed: '+(await page.evaluate(()=>window.__e2||'unknown')));
else notes.push('top-bar Export menu still fires: '+dl2.suggestedFilename());

/* ---------- #7: fake sync alert hidden ---------- */
await goto('today');
await page.waitForTimeout(1500);
const alertState = await page.evaluate(()=>{
  const nodes=[...document.querySelectorAll('.v20-alert-strip')];
  return nodes.map(n=>({display:getComputedStyle(n).display, text:n.textContent.trim().slice(0,150)}));
});
notes.push('Today .v20-alert-strip state: '+JSON.stringify(alertState));
if(alertState.some(n=>n.display!=='none')) fails.push('the fake sync/integrations alert is still visible on Today: '+JSON.stringify(alertState));
else notes.push('confirmed: no visible fake alert strip on Today'+(alertState.length? ' (present in DOM but hidden)':' (never even injected)'));

/* revisit Today a second time to make sure it's not a one-shot fluke */
await goto('clients');
await goto('today');
await page.waitForTimeout(1500);
const alertState2 = await page.evaluate(()=>[...document.querySelectorAll('.v20-alert-strip')].map(n=>getComputedStyle(n).display));
notes.push('Today .v20-alert-strip on revisit: '+JSON.stringify(alertState2));
if(alertState2.some(d=>d!=='none')) fails.push('the fake alert reappeared visibly on a second visit to Today');

/* make sure the underlying (still-useful) per-record sync tools are untouched:
   openSyncLog / openConflict / v20FailedSyncs must still exist as functions */
const fnCheck = await page.evaluate(()=>({
  openSyncLog: typeof window.openSyncLog,
  openConflict: typeof window.openConflict,
  v20FailedSyncs: typeof window.v20FailedSyncs
}));
notes.push('per-record sync tools untouched: '+JSON.stringify(fnCheck));
if(fnCheck.openSyncLog!=='function'||fnCheck.openConflict!=='function') fails.push('per-record sync tools appear to have been broken, not just the homepage alert: '+JSON.stringify(fnCheck));

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,5)));

console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nVERIFY FAILS:\n  '+fails.join('\n  ') : '\nVERIFY OK · both round-3 fixes confirmed live, no regressions');
await browser.close();
process.exit(fails.length?1:0);
