/* Full-audit login sweep: 4 role types, every reachable page, watching for the specific
   failure shapes seen today — session-expired banner, "Not signed in", zero-figure Finance,
   console errors — on pages beyond Leads/Finance/Team&Access too. */
import { openApp, signIn, signOut, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
const report = {};

async function sweepPages(key, pages){
  const who=TEAM[key];
  await signIn(page, who.email, who.pw); await ready(page);
  await page.waitForTimeout(3000);
  const identity = await page.evaluate(()=>({me:window.meName?meName():'', role:window.__userRole, roleKnown:window.__roleKnown}));
  const perPage = {};
  for (const p of pages) {
    await page.evaluate((pg)=>{ current=pg; if(typeof render==='function') render(); }, p);
    await page.waitForTimeout(2200);
    perPage[p] = await page.evaluate(()=>{
      const v=document.getElementById('view'); const t=v?(v.textContent||''):'(no view)';
      return {
        notSignedIn: /Not signed in/i.test(t),
        sessionBar: !!document.getElementById('sessgone'),
        undefinedLeak: (t.match(/\bundefined\b/g)||[]).length,
        nanLeak: (t.match(/\bNaN\b/g)||[]).length,
        blank: t.trim().length < 20,
      };
    });
  }
  await signOut(page);
  return {identity, perPage};
}

const PAGES = ['today','leads','clients','finance','settings','offers'];
for (const key of ['business','othman','assem','kareem']) {
  report[key] = await sweepPages(key, PAGES);
  console.log(key.padEnd(9), JSON.stringify(report[key].identity));
  for (const [p,r] of Object.entries(report[key].perPage)) {
    const bad = r.notSignedIn||r.sessionBar||r.undefinedLeak||r.nanLeak||r.blank;
    console.log('  '+p.padEnd(10), bad?('⚠ '+JSON.stringify(r)):'clean');
  }
}
console.log('\nerrs (all sessions combined):', JSON.stringify(errs.slice(0,6)));
await browser.close(); process.exit(0);
