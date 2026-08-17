/* Click "Open Team & Access" as the manager, exactly as a person does. */
import { openApp, signIn, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
await signIn(page, TEAM.othman.email, TEAM.othman.pw); await ready(page);
await page.evaluate(()=>{ current='settings'; render(); });
await page.waitForTimeout(3000);
await page.evaluate(()=>{ if(window.v48Users) v48Users(); });
await page.waitForTimeout(5000);
const r = await page.evaluate(()=>{
  const t=document.body.textContent||'';
  return { notSignedIn:/Not signed in/i.test(t), onlyAdmin:/Only an admin or a manager/i.test(t),
           notActive:/access is not active/i.test(t),
           rows:document.querySelectorAll('#v48list tr, .v48-row').length,
           sees:['Assem','Kareem','Raad','Mohammed','Abdul Aziz','Abdelrahman'].filter(n=>t.includes(n)) };
});
console.log(JSON.stringify(r,null,1));
console.log('errs',errs.slice(0,3));
await browser.close(); process.exit(0);
