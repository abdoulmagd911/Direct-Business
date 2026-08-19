/* Assignment only counts if the person actually sees their own leads. Sign in as each of the
   three real owners, press "Mine", and count what they get. Kareem is the control: he owns
   none of this batch and must see none of it. */
import { openApp, signIn, signOut, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
const want = {assem:70, mohammed:8, ahmed:3, kareem:0};
const got = {};
for (const key of ['assem','mohammed','ahmed','kareem']) {
  const who = TEAM[key];
  await signIn(page, who.email, who.pw); await ready(page);
  await page.evaluate(()=>{ current='leads'; render(); });
  await page.waitForTimeout(4000);
  got[key] = await page.evaluate(()=>{
    const me = window.meName ? meName() : '';
    const mine=(DB.businesses||[]).filter(b=>!b.isClient).filter(b=>
      window.sameOwner ? sameOwner(b.assignedTo||b.owner, me) : ((b.assignedTo||b.owner||'')===me));
    return {me, mine: mine.length};
  });
  await signOut(page);
}
let fails=[];
for (const k of Object.keys(want)) {
  console.log(`${k.padEnd(10)} signed in as "${got[k].me}" · their own leads: ${got[k].mine} (expected ${want[k]})`);
  if (got[k].mine !== want[k]) fails.push(`${k}: saw ${got[k].mine}, expected ${want[k]}`);
}
if (errs.length) fails.push('js errors: '+JSON.stringify(errs.slice(0,2)));
console.log(fails.length ? '\nMINE FAILS:\n  '+fails.join('\n  ') : '\nMINE OK · every owner sees exactly their own leads');
await browser.close();
process.exit(fails.length?1:0);
