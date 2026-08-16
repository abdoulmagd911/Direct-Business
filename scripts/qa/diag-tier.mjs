/* Why is an employee offered the remove button? Measure, don't guess. */
import { openApp, signIn, signOut, ready, TEAM } from './emp-rig.mjs';
const { browser, page } = await openApp(Number(process.env.PORT||9942));
for (const [label,who] of [['admin',TEAM.business],['manager',TEAM.othman],['employee',TEAM.raad]]) {
  await signIn(page, who.email, who.pw); await ready(page);
  await page.evaluate(()=>{ current='finance'; render(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
  await page.evaluate(()=>{ finGo('expenses'); });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(()=>({
    userRole: window.__userRole, userTier: window.__userTier, roleKnown: window.__roleKnown,
    canFinEdit: (typeof canFinEdit==='function') ? canFinEdit() : 'n/a',
    delButtons: [...document.querySelectorAll('#view button')].filter(b=>/expDel/.test(b.getAttribute('onclick')||'')).length
  }));
  console.log(label.padEnd(9), JSON.stringify(r));
  await signOut(page);
}
await browser.close(); process.exit(0);
