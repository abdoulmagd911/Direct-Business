/* Expenses row delete — in-page confirm instead of window.confirm().
   Same failure family as Payment proofs, Individual bookings and the Ledger's "Delete
   invoice" before their fixes: a native confirm() dialog blocks the whole tab on its own
   modal loop. The owner's own hands-on QA hit this cleaning up an S5 test row and had to
   force-navigate to recover. expDel() and expDownloadAll() both now route through the same
   shared pfConfirm box every other delete/bulk-download action in Finance already uses.   */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';
import fs from 'fs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9959));
const fails=[], notes=[];

async function financeReady(){
  await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); });
  await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
  await page.waitForTimeout(2200);
}

await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);
await financeReady();

/* ---------------- add a real expense with proof, through the real form ---------------- */
const PROOF='/tmp/exp-delconfirm-proof.png';
if(!fs.existsSync(PROOF)){
  fs.writeFileSync(PROOF, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
}
await page.evaluate(()=>{ finGo('expenses'); });
await page.waitForTimeout(2200);
const marker='DELCONFIRM probe — expense '+Date.now();
const hasForm = await page.evaluate(()=>!!document.getElementById('xp_desc'));
if(!hasForm) fails.push('the add-an-expense form is not on the page');
else{
  await page.fill('#xp_desc', marker);
  await page.fill('#xp_amt', '42');
  await page.selectOption('#xp_svc', 'Hotels');
  await page.setInputFiles('#xp_file', PROOF);
  await page.evaluate(()=>expSave());
  await page.waitForTimeout(4000);
}

const saved = await page.evaluate(m=>{
  const r=(window.EXPX&&EXPX.rows||[]).find(x=>x.description===m);
  return r?{id:r.id}:null;
}, marker);
if(!saved) fails.push('the probe expense did not save at all');
else{
  notes.push('probe expense saved: '+marker);

  /* ---------------- click the real ✕ button, real in-page confirm ---------------- */
  const delBtn = await page.$(`button[onclick="expDel('${saved.id}')"]`);
  if(!delBtn) fails.push('could not find the real ✕ button for the probe expense');
  else{
    await delBtn.click();
    const box = await page.waitForSelector('#pfConfirmBox', {timeout:5000}).catch(()=>null);
    if(!box) fails.push('expDel: did not open the in-page confirm box (did it regress to window.confirm?)');
    else{
      const visible = await page.isVisible('#pfConfirmYes').catch(()=>false);
      if(!visible) fails.push('expDel: confirm box exists but its Confirm button is not visible/clickable');
      notes.push('expDel: opens the in-page confirm box, not a native dialog — safe for automation');
      await page.click('#pfConfirmYes');
      await page.waitForTimeout(2500);
      const gone = await page.evaluate(m=>!(window.EXPX&&EXPX.rows||[]).some(x=>x.description===m), marker);
      if(!gone) fails.push('expDel: the row is still live after confirming the delete');
      else notes.push('expDel: expense removed from the list after confirming through the in-page box');
    }
  }
  // hard-clean the (now soft-deleted) probe row so nothing lingers in the table at all
  const cleaned1 = await page.evaluate(async id=>{
    const c=window.fc();
    const out=await c.from('finance_expenses').delete().eq('id',id).select();
    return (out&&out.data&&out.data.length)?'removed':'COULD NOT REMOVE';
  }, saved.id);
  notes.push('cleanup (probe 1): '+cleaned1);
  if(cleaned1==='COULD NOT REMOVE') fails.push('probe 1 expense could not be hard-cleaned up: '+marker);
}

/* ---------------- expDownloadAll's confirm, same box ---------------- */
await page.evaluate(()=>{ finGo('expenses'); });
await page.waitForTimeout(2200);
const marker2='DELCONFIRM probe 2 — expense '+Date.now();
await page.fill('#xp_desc', marker2);
await page.fill('#xp_amt', '17');
await page.selectOption('#xp_svc', 'Hotels');
await page.setInputFiles('#xp_file', PROOF);
await page.evaluate(()=>expSave());
await page.waitForTimeout(4000);
const saved2 = await page.evaluate(m=>{
  const r=(window.EXPX&&EXPX.rows||[]).find(x=>x.description===m);
  return r?{id:r.id}:null;
}, marker2);
if(!saved2) fails.push('the second probe expense did not save at all');
else{
  await page.evaluate(()=>expDownloadAll());
  const box2 = await page.waitForSelector('#pfConfirmBox', {timeout:5000}).catch(()=>null);
  if(!box2) fails.push('expDownloadAll: did not open the in-page confirm box');
  else{
    notes.push('expDownloadAll: also opens the in-page confirm box');
    const [dl] = await Promise.all([
      page.waitForEvent('download', {timeout:15000}).catch(()=>null),
      page.click('#pfConfirmYes')
    ]);
    if(!dl) fails.push('expDownloadAll: confirming did not trigger any download');
    else notes.push('expDownloadAll: confirming triggers the expected download(s)');
  }
  // clean up second probe
  const cleaned2 = await page.evaluate(async id=>{
    const c=window.fc();
    const out=await c.from('finance_expenses').delete().eq('id',id).select();
    return (out&&out.data&&out.data.length)?'removed':'COULD NOT REMOVE';
  }, saved2.id);
  notes.push('cleanup (probe 2): '+cleaned2);
  if(cleaned2==='COULD NOT REMOVE') fails.push('probe 2 expense could not be cleaned up: '+marker2);
}

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nEXP-DELETE FAILS:\n  '+fails.join('\n  ') : '\nEXP-DELETE OK · expDel and expDownloadAll both use the in-page confirm box, not window.confirm()');
await browser.close();
process.exit(fails.length?1:0);
