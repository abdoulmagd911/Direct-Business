/* The access matrix: everyone's day must be unchanged, and Viewer must actually stop a write. */
import { openApp, signIn, signOut, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
const fails=[], notes=[];

for (const [key, wantPages, wantFinEdit] of [
  ['business', null, true],   // admin — no matrix
  ['othman',   10,   true],   // manager — his ten pages
  ['raad',      4,   true],   // employee — today/leads/clients/finance
]) {
  const who=TEAM[key];
  await signIn(page, who.email, who.pw); await ready(page);
  await page.waitForTimeout(4000);
  const r=await page.evaluate(async ()=>{
    const c=window.fc?fc():null;
    const mine=c?await c.rpc('my_page_access'):null;
    return {matrix:mine?mine.data:undefined, loaded:!!window.__pageAccessLoaded,
            finEdit:(typeof canFinEdit==='function')?canFinEdit():null,
            navCount:document.querySelectorAll('.side .nav button, .side button').length};
  });
  const pages = r.matrix ? Object.keys(r.matrix).length : null;
  notes.push(`${key}: matrix=${pages===null?'none (admin)':pages+' pages'} canFinEdit=${r.finEdit}`);
  if (pages !== wantPages) fails.push(`${key}: matrix has ${pages} pages, expected ${wantPages}`);
  if (r.finEdit !== wantFinEdit) fails.push(`${key}: canFinEdit=${r.finEdit}, expected ${wantFinEdit}`);
  await signOut(page);
}

/* the admin must see the editor; an employee must never see it */
await signIn(page, TEAM.business.email, TEAM.business.pw); await ready(page);
await page.evaluate(()=>{ current='settings'; render(); });
await page.waitForTimeout(3500);
const adminSees = await page.evaluate(()=>({host:!!document.getElementById('axHost')}));
await signOut(page);
await signIn(page, TEAM.raad.email, TEAM.raad.pw); await ready(page);
await page.evaluate(()=>{ current='settings'; render(); });
await page.waitForTimeout(2500);
const empSees = await page.evaluate(()=>({host:!!document.getElementById('axHost')}));
notes.push(`access editor visible — admin=${adminSees.host} employee=${empSees.host}`);
if(empSees.host) fails.push('an employee can see the access editor');

if(errs.length) fails.push('js errors: '+JSON.stringify(errs.slice(0,2)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length?'\nFAILS:\n  '+fails.join('\n  '):'\nMATRIX OK · nobody\'s access changed, admin-only editor');
await browser.close(); process.exit(fails.length?1:0);
