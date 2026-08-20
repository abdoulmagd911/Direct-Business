/* CRM audit round 2 — Today / Leads / Clients / Proposals, as QA admin, live against the
   real backend. Same method as the Finance audit: click through, verify live, don't trust
   code alone. Checks: what admin sees vs manager (Othman), exports on these pages (label vs
   actual content), double data-entry between Leads -> Clients -> Proposals -> Finance, and
   what's actually on Today vs duplicated elsewhere.                                        */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';
import fs from 'fs';

TEAM.admin.pw = requirePw('admin');
TEAM.othman.pw = requirePw('othman');
const report = {};

async function goto(page, view){
  await page.evaluate((v)=>{ current=v; if(typeof render==='function') render(); }, view);
  await page.waitForTimeout(2200);
}
function pageInfo(page){
  return page.evaluate(()=>{
    const view=document.getElementById('view');
    if(!view) return null;
    const buttons=[...view.querySelectorAll('button')].map(b=>({text:(b.textContent||'').trim(),onclick:b.getAttribute('onclick')||''})).filter(b=>b.text);
    const selects=[...view.querySelectorAll('select')].map(s=>({onchange:s.getAttribute('onchange')||'',options:[...s.options].map(o=>o.textContent.trim())}));
    return { buttons, selects, textLength:(view.innerText||'').length, textSample:(view.innerText||'').slice(0,1200) };
  });
}

/* ============ PART 1: admin vs manager, what's visible on each page ============ */
{
  const { browser, page, errs } = await openApp(9951);
  await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);
  report.admin = {};
  for(const v of ['today','leads','clients','offers']){
    await goto(page, v);
    report.admin[v] = await pageInfo(page);
    await page.screenshot({path:`/tmp/audit-crm-admin-${v}.png`, fullPage:true}).catch(()=>{});
  }
  report.admin_js_errors = errs.slice(0,10);
  await browser.close();
}
{
  const { browser, page, errs } = await openApp(9952);
  await signIn(page, TEAM.othman.email, TEAM.othman.pw); await ready(page);
  report.othman = {};
  for(const v of ['today','leads','clients','offers']){
    await goto(page, v);
    report.othman[v] = await pageInfo(page);
    await page.screenshot({path:`/tmp/audit-crm-othman-${v}.png`, fullPage:true}).catch(()=>{});
  }
  report.othman_js_errors = errs.slice(0,10);
  await browser.close();
}

/* diff buttons/selects between admin and othman per page */
report.admin_vs_manager_diff = {};
for(const v of ['today','leads','clients','offers']){
  const a = report.admin[v], o = report.othman[v];
  if(!a || !o){ report.admin_vs_manager_diff[v] = {note:'one side had no #view'}; continue; }
  const aBtn = new Set(a.buttons.map(b=>b.text));
  const oBtn = new Set(o.buttons.map(b=>b.text));
  const adminOnly = [...aBtn].filter(x=>!oBtn.has(x));
  const managerOnly = [...oBtn].filter(x=>!aBtn.has(x));
  report.admin_vs_manager_diff[v] = { adminOnlyButtons: adminOnly, managerOnlyButtons: managerOnly };
}

/* ============ PART 2: exports from Today/Leads/Clients/Proposals — page button + global dropdown ============ */
const { browser, page, errs } = await openApp(9953);
await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);
report.exports = {};

for(const v of ['today','leads','clients','offers']){
  await goto(page, v);
  const info = report.exports[v] = { pageOwnExportButtons: [], globalDropdown: {} };

  /* page's own export-looking buttons, if any */
  const ownBtns = await page.evaluate(()=>{
    const view=document.getElementById('view');
    return [...view.querySelectorAll('button')].filter(b=>/export|csv|excel|download/i.test(b.textContent||'')).map(b=>({text:b.textContent.trim(),onclick:b.getAttribute('onclick')||''}));
  });
  info.pageOwnExportButtons = ownBtns;

  /* the shared top-bar Export dropdown, all 4 options, from this page */
  for(const scope of ['list','full','xlsList','xlsFull']){
    const [dl] = await Promise.all([
      page.waitForEvent('download', {timeout:6000}).catch(()=>null),
      page.evaluate((s)=>{ try{ expGo(s); }catch(e){ window.__e=String(e); } }, scope)
    ]);
    if(dl){
      const p = await dl.path(); const text = fs.readFileSync(p,'utf8');
      info.globalDropdown[scope] = { fired:true, filename: dl.suggestedFilename(), firstLine: text.split(/\r?\n/)[0].slice(0,400) };
    } else {
      info.globalDropdown[scope] = { fired:false, err: await page.evaluate(()=>window.__e||null) };
    }
  }
}

/* ============ PART 3: lead -> client conversion — does it pre-fill or force re-entry? ============ */
await goto(page, 'leads');
const convertCheck = await page.evaluate(()=>{
  const leads = (typeof DB!=='undefined'&&DB.businesses)?DB.businesses.filter(b=>!b.isClient):[];
  if(!leads.length) return {found:false};
  const b = leads[0];
  return { found:true, id:b.id, name:b.name, hasLegalName:!!b.legalName, hasCrVat:!!(b.crVat||b.vatNumber),
           hasAssignedTo:!!b.assignedTo, hasCustomerType:!!(b.customerType||b.entityType) };
});
report.convert_source_lead = convertCheck;

if(convertCheck.found){
  await page.evaluate((id)=>{ try{ convertToClient(id); }catch(e){ window.__ce=String(e); } }, convertCheck.id);
  await page.waitForTimeout(1200);
  const modalState = await page.evaluate(()=>{
    const g=(id)=>{const e=document.getElementById(id); return e?e.value:null;};
    const has = !!document.getElementById('c_ln');
    if(!has) return {opened:false};
    return { opened:true, legalName:g('c_ln'), customerType:g('c_ct'), crVat:g('c_crv'), accountManager:g('c_am') };
  });
  report.convert_to_client_modal = modalState;
  /* close without saving — do not actually convert the lead, this is a read-only check */
  await page.evaluate(()=>{ const ovs=[...document.querySelectorAll('div')].filter(d=>/position:\s*fixed/.test(d.getAttribute('style')||'')&&/inset:\s*0/.test(d.getAttribute('style')||'')); ovs.forEach(o=>o.remove()); });
  await page.waitForTimeout(500);
}

/* ============ PART 4: Proposals -> loading a client's info ============ */
await goto(page, 'offers');
const proposalClientLoad = await page.evaluate(()=>{
  const sel = [...document.querySelectorAll('#view select')].find(s=>/o_loadClient/.test(s.getAttribute('onchange')||''));
  return { selectFound: !!sel, optionCount: sel? sel.options.length : 0 };
});
report.proposal_client_dropdown = proposalClientLoad;

if(proposalClientLoad.selectFound && proposalClientLoad.optionCount > 1){
  const before = await page.evaluate(()=>{ try{ return curOffer()?curOffer().client:null; }catch(_){ return null; } });
  const picked = await page.evaluate(()=>{
    const sel = [...document.querySelectorAll('#view select')].find(s=>/o_loadClient/.test(s.getAttribute('onchange')||''));
    const opt = sel.options[1];
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change'));
    return opt.textContent.trim();
  });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(()=>{
    const el = document.querySelector('#o_client, [id^="o_cl"]');
    try{ return { curOfferClient: curOffer()?curOffer().client:null, fieldValue: el?el.value:null }; }catch(_){ return {curOfferClient:null, fieldValue: el?el.value:null}; }
  });
  report.proposal_client_autofill = { pickedClientLabel:picked, before, after };
}

/* ============ PART 5: Today page content vs Performance/other pages — overlap check ============ */
await goto(page, 'today');
const todayText = await page.evaluate(()=>(document.getElementById('view')||{}).innerText||'');
report.today_full_text_length = todayText.length;
report.today_text_sample = todayText.slice(0, 3000);

if(errs.length) report.js_errors_part2to5 = errs.slice(0,10);

fs.writeFileSync('/tmp/audit-crm-full-report.json', JSON.stringify(report,null,2));
console.log('DONE — report written to /tmp/audit-crm-full-report.json');
await browser.close();
process.exit(0);
