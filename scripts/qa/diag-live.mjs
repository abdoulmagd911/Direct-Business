/* The three findings, checked as the manager who reported them. */
import { openApp, signIn, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
const fails=[], notes=[];
await signIn(page, TEAM.othman.email, TEAM.othman.pw); await ready(page);

/* Finance must show real money, and the session probe must agree */
await page.evaluate(()=>{ current='finance'; render(); });
await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
await page.waitForTimeout(3500);
const fin = await page.evaluate(async ()=>{
  const c=window.fc?fc():null;
  const rpc=c?await c.rpc('app_role'):null;
  const t=document.getElementById('view').textContent||'';
  return {rows:(FIN.rows||[]).length, roleFromDb:rpc?rpc.data:null,
          revenue:(t.match(/Revenue\s*([\d.,]+[KM]?)/)||[])[1]||null,
          invoices:(t.match(/Invoices\s*(\d+)/)||[])[1]||null,
          sessionBar:!!document.getElementById('sessgone')};
});
if(fin.rows===0) fails.push('Finance still returns zero invoices for a manager');
if(fin.roleFromDb!=='manager') fails.push('the database does not recognise the manager: app_role()='+fin.roleFromDb);
if(fin.sessionBar) fails.push('the expired-session bar is showing for a healthy session');
notes.push('finance rows='+fin.rows+' app_role()='+fin.roleFromDb+' Revenue='+fin.revenue+' Invoices='+fin.invoices+' bar='+fin.sessionBar);

/* Owner column must show the nickname */
await page.evaluate(()=>{ current='leads'; render(); });
await page.waitForTimeout(4500);
const own = await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('#view table tbody tr')];
  const txt=rows.map(r=>r.textContent||'').join(' ');
  return {rows:rows.length, nickname:/Abu Nasser/.test(txt), legal:/Assem Alsweed/.test(txt)};
});
if(!own.nickname) fails.push('the Owner column still does not show the nickname');
if(own.legal) fails.push('the Owner column still shows the legal name');
notes.push('leads owner column: rows='+own.rows+' nickname='+own.nickname+' legal='+own.legal);

/* Sidebar must say Manager, not Business Development */
const foot = await page.evaluate(()=>{
  const f=document.querySelector('.side .foot')||document.querySelector('.foot');
  return f?(f.textContent||'').replace(/\s+/g,' ').trim():'(no footer)';
});
if(/Business Development/.test(foot)) fails.push('the sidebar still says Business Development');
if(!/Manager/i.test(foot)) fails.push('the sidebar does not say Manager: "'+foot+'"');
notes.push('sidebar footer: "'+foot+'"');

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length?'\nFAILS:\n  '+fails.join('\n  '):'\nALL THREE FIXED · finance real, nickname shown, role correct');
await browser.close(); process.exit(fails.length?1:0);
