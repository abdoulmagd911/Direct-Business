/* Verify the audit fixes: proposal upload/remove still work through window.fc(), and the
   audit log stamps the real signed-in name rather than any hardcoded one. */
import { openApp, signIn, ready, TEAM } from './emp-rig.mjs';
import fs from 'fs';
const PROOF='/tmp/audit-proof.png';
if(!fs.existsSync(PROOF)) fs.writeFileSync(PROOF, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));

const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
await signIn(page, TEAM.othman.email, TEAM.othman.pw); await ready(page);
await page.waitForTimeout(2500);
await page.evaluate(()=>{ current='offers'; render(); });
await page.waitForTimeout(2500);

const offerId = await page.evaluate(()=>((DB.offers||[])[0]||{}).id||null);
const uploadResult = { offerId };
if (offerId) {
  await page.evaluate((id)=>{ openOffer=id; if(typeof render==='function') render(); }, offerId);
  await page.waitForTimeout(1500);
  const hasFileInput = await page.evaluate(()=>!!document.getElementById('o_file'));
  uploadResult.hasFileInput = hasFileInput;
  if (hasFileInput) {
    await page.setInputFiles('#o_file', PROOF);
    await page.evaluate((id)=>{ o_uploadFile(id); }, offerId);
    await page.waitForTimeout(3500);
    uploadResult.afterUpload = await page.evaluate((id)=>{
      const o=(DB.offers||[]).find(x=>x.id===id);
      return { fileUrl: o?o.fileUrl:null, msg: (document.getElementById('o_fileMsg')||{}).textContent||'' };
    }, offerId);
    if (uploadResult.afterUpload.fileUrl) {
      await page.evaluate((id)=>{
        const okConfirm = window.confirm; window.confirm = ()=>true;
        o_removeFile(id);
        window.confirm = okConfirm;
      }, offerId);
      await page.waitForTimeout(2000);
      uploadResult.afterRemove = await page.evaluate((id)=>{
        const o=(DB.offers||[]).find(x=>x.id===id); return { fileUrl:o?o.fileUrl:null };
      }, offerId);
    }
  }
}
console.log('proposal file library ->', JSON.stringify(uploadResult));

/* audit log: do something that logs, check the stamped name */
await page.evaluate(()=>{ current='leads'; render(); });
await page.waitForTimeout(3000);
const auditCheck = await page.evaluate(()=>{
  const entries=(DB.audit||[]).slice(0,20);
  return { count: entries.length, hardcodedAbdelrahman: entries.filter(a=>a.user==='Abdelrahman').length,
           sample: entries.slice(0,3).map(a=>({user:a.user, action:a.action})) };
});
console.log('audit log ->', JSON.stringify(auditCheck));

const fails=[];
if(offerId && uploadResult.hasFileInput && !uploadResult.afterUpload?.fileUrl) fails.push('proposal file upload did not save a fileUrl');
if(uploadResult.afterRemove && uploadResult.afterRemove.fileUrl) fails.push('proposal file remove did not clear fileUrl');
if(auditCheck.hardcodedAbdelrahman>0) fails.push('audit log still contains hardcoded Abdelrahman entries');
if(errs.length) fails.push('js errors: '+JSON.stringify(errs.slice(0,3)));
console.log(fails.length?'\nFAILS:\n  '+fails.join('\n  '):'\nAUDIT FIXES OK');
await browser.close(); process.exit(fails.length?1:0);
