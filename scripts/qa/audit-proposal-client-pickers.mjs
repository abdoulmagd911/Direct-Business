/* Live check: the Proposal editor has TWO client pickers — does using only one leave the
   proposal half-linked (name set, but not linkedLeadId, or vice versa)? */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';
TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(9958);
await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);

await page.evaluate(()=>{ current='offers'; if(typeof render==='function') render(); });
await page.waitForTimeout(1500);
await page.evaluate(()=>{ try{ newOffer(); }catch(e){ window.__e=String(e); } });
await page.waitForTimeout(1500);

const clientName = await page.evaluate(()=>{
  const b=(DB.businesses||[]).find(x=>x.isClient);
  return b ? {id:b.id, name:b.name} : null;
});

const results = {};

/* Test A: use ONLY the header "Client" dropdown (o_setClient) */
if(clientName){
  await page.evaluate((c)=>{
    const sels = [...document.querySelectorAll('#view select')];
    const headerSel = sels.find(s=>/o_setClient/.test(s.getAttribute('onchange')||''));
    if(!headerSel) { window.__noHeaderSel = true; return; }
    headerSel.value = c.id;
    headerSel.dispatchEvent(new Event('change'));
  }, clientName);
  await page.waitForTimeout(1000);
  results.afterHeaderDropdownOnly = await page.evaluate(()=>{
    const o = curOffer();
    return { client: o.client, linkedLeadId: o.linkedLeadId, remarks: o.remarks||'' };
  });
}

/* fresh proposal for test B */
await page.evaluate(()=>{ current='offers'; if(typeof render==='function') render(); });
await page.waitForTimeout(1000);
await page.evaluate(()=>{ try{ newOffer(); }catch(e){} });
await page.waitForTimeout(1000);

/* Test B: use ONLY the lower "Load a corporate client's negotiated deal & pricing" dropdown (o_loadClient) */
if(clientName){
  await page.evaluate((c)=>{
    const sels = [...document.querySelectorAll('#view select')];
    const loadSel = sels.find(s=>/o_loadClient/.test(s.getAttribute('onchange')||''));
    if(!loadSel) { window.__noLoadSel = true; return; }
    loadSel.value = c.id;
    loadSel.dispatchEvent(new Event('change'));
  }, clientName);
  await page.waitForTimeout(1000);
  results.afterLoadDropdownOnly = await page.evaluate(()=>{
    const o = curOffer();
    return { client: o.client, linkedLeadId: o.linkedLeadId, remarks: o.remarks||'' };
  });
}

results.noHeaderSel = await page.evaluate(()=>window.__noHeaderSel||false);
results.noLoadSel = await page.evaluate(()=>window.__noLoadSel||false);
results.testClient = clientName;

console.log(JSON.stringify(results, null, 2));
if(errs.length) console.log('JS ERRORS:', JSON.stringify(errs.slice(0,5)));
await browser.close();
process.exit(0);
