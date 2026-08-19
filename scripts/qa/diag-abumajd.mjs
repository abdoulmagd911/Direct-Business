/* The three "Abu Majd" leads must now belong to Abdulrahman, and not to Ahmed Salah's account. */
import { openApp, signIn, signOut, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
const fails=[];
for (const [key,want] of [['business',3],['aboelmagd',3],['ahmed',0],['assem',70],['mohammed',8]]) {
  const who=TEAM[key];
  await signIn(page, who.email, who.pw); await ready(page);
  await page.evaluate(()=>{ current='leads'; render(); });
  await page.waitForTimeout(4000);
  const r=await page.evaluate(()=>{
    const me=window.meName?meName():'';
    const mine=(DB.businesses||[]).filter(b=>!b.isClient).filter(b=>
      window.sameOwner?sameOwner(b.assignedTo||b.owner,me):((b.assignedTo||b.owner||'')===me));
    return {me, n:mine.length, names:mine.slice(0,3).map(b=>b.name)};
  });
  console.log(`${key.padEnd(11)} "${r.me}" owns ${r.n} (expected ${want})`);
  if(r.n!==want) fails.push(`${key}: ${r.n} vs ${want}`);
  if(key==='business'&&r.n===3) console.log('            →', r.names.join(' · '));
  await signOut(page);
}
if(errs.length) fails.push('js errors: '+JSON.stringify(errs.slice(0,2)));
console.log(fails.length?'\nFAILS: '+fails.join('; '):'\nOWNERSHIP CORRECT · Abu Majd leads sit with Abdulrahman, Ahmed Salah owns none');
await browser.close(); process.exit(fails.length?1:0);
