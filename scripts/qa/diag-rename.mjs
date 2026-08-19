/* The rename must hold everywhere the app looks, and must not have disturbed anyone else. */
import { openApp, signIn, signOut, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
const fails=[];
await signIn(page, TEAM.ahmed.email, TEAM.ahmed.pw); await ready(page);
await page.waitForTimeout(3500);
const a = await page.evaluate(()=>({ me: window.meName?meName():'', role: window.__userRole }));
console.log('signed in as ->', JSON.stringify(a));
if(a.me!=='Ahmed Salah') fails.push('the app still calls him '+a.me);
await page.evaluate(()=>{ current='clients'; render(); });
await page.waitForTimeout(3000);
const c = await page.evaluate(()=>{
  const t=document.getElementById('view').textContent||'';
  return { oldName:/Abo El Magd/.test(t), newName:/Ahmed Salah/.test(t) };
});
console.log('clients page ->', JSON.stringify(c));
if(c.oldName) fails.push('the old name still shows on Clients');
await signOut(page);

/* nobody else disturbed */
await signIn(page, TEAM.business.email, TEAM.business.pw); await ready(page);
await page.evaluate(()=>{ current='leads'; render(); });
await page.waitForTimeout(4000);
const o = await page.evaluate(()=>{
  const me=window.meName?meName():'';
  const mine=(DB.businesses||[]).filter(b=>!b.isClient).filter(b=>window.sameOwner?sameOwner(b.assignedTo||b.owner,me):((b.assignedTo||b.owner||'')===me));
  const t=document.getElementById('view').textContent||'';
  return { abdulrahmanOwns:mine.length, oldNameAnywhere:/Abo El Magd/.test(t), nickAbuNasser:/Abu Nasser/.test(t) };
});
console.log('admin view ->', JSON.stringify(o));
if(o.abdulrahmanOwns!==3) fails.push('Abdulrahman owns '+o.abdulrahmanOwns+', expected 3');
if(o.oldNameAnywhere) fails.push('old name still visible on Leads');
if(!o.nickAbuNasser) fails.push('nicknames stopped rendering');
if(errs.length) fails.push('js errors: '+JSON.stringify(errs.slice(0,2)));
console.log(fails.length?'\nFAILS:\n  '+fails.join('\n  '):'\nRENAME CLEAN · Ahmed Salah everywhere, nobody else moved');
await browser.close(); process.exit(fails.length?1:0);
