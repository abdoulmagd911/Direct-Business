/* Every fix in this round, checked in the running app. */
import { openApp, signIn, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
const fails=[], notes=[];
await signIn(page, TEAM.business.email, TEAM.business.pw); await ready(page);

/* ---- (a)(b) Leads headline counts + no billed figure ---- */
await page.evaluate(()=>{ current='leads'; render(); });
await page.waitForTimeout(4500);
/* the tiles live in the Dashboard view of the Leads page — switch to it, as a person would */
await page.evaluate(()=>{ leadView='dash'; drawLeads(); });
await page.waitForTimeout(1800);
const leads = await page.evaluate(()=>{
  const txt=(document.getElementById('view').textContent||'');
  /* the tiles live in #leadoverview, which the Insights panel keeps collapsed — the element
     is still in the page, so read it directly rather than opening the panel */
  const ov=document.getElementById('board');
  const chip=ov?[...ov.querySelectorAll('.chip')].map(c=>({l:(c.querySelector('.l')||{}).textContent,v:(c.querySelector('.v')||{}).textContent})):[];
  if(typeof leadView!=='undefined') { }
  return {total:chip.find(c=>/Total leads/.test(c.l||''))||null,
          became:chip.find(c=>/Became client/.test(c.l||''))||null,
          hasBilled:/SAR billed/.test(txt), inView:(txt.match(/In view\s*([^\n]{0,30})/)||[])[1]||''};
});
if(!leads.total) fails.push('(a) could not find the Total leads tile - test proved nothing');
if(leads.total && leads.total.v.trim()!=='81') fails.push('(a) Total leads shows '+leads.total.v+', expected 81');
if(leads.became && leads.became.v.trim()!=='10') fails.push('(a) Became client shows '+leads.became.v+', expected 10');
if(leads.hasBilled) fails.push('(b) "SAR billed" still on the Leads page');
notes.push('(a)(b) Total leads='+(leads.total&&leads.total.v)+' Became client='+(leads.became&&leads.became.v)+' billed-on-page='+leads.hasBilled);

/* ---- (5) sort tie-breaker: sorting a uniform column must be stable ---- */
const sortStable = await page.evaluate(()=>{
  const order=()=>leadsView().map(b=>b.name).join('|');
  leadSort.k='owner'; leadSort.dir=1;
  const a=order(), b=order();
  leadSort.k='score'; const c=order(), d=order();
  leadSort.k='owner'; const e=order();
  return {ownerStable:a===b, scoreStable:c===d, returnsSame:a===e};
});
if(!sortStable.ownerStable||!sortStable.scoreStable||!sortStable.returnsSame)
  fails.push('(5) sorting is still unstable: '+JSON.stringify(sortStable));
notes.push('(5) sort stable on owner+priority, and returns to the same order: '+JSON.stringify(sortStable));

/* ---- (c) no "undefined" anywhere on a lead detail ---- */
const detail = await page.evaluate(()=>{
  const drc=(DB.businesses||[]).find(b=>/DRC/.test(b.name)); if(!drc) return {err:'DRC not found'};
  openLead=drc.id; current='leads'; render();
  return {id:drc.id};
});
await page.waitForTimeout(2500);
const undef = await page.evaluate(()=>{
  const t=document.getElementById('view').textContent||'';
  return {undefinedCount:(t.match(/undefined/g)||[]).length, nan:(t.match(/NaN/g)||[]).length,
          category:(t.match(/Category\s*([^\n]{0,20})/)||[])[1]||''};
});
if(undef.undefinedCount) fails.push('(c) "undefined" still shows '+undef.undefinedCount+' time(s) on the lead detail');
if(undef.nan) fails.push('(c) "NaN" shows '+undef.nan+' time(s) on the lead detail');
notes.push('(c) lead detail: undefined='+undef.undefinedCount+' NaN='+undef.nan+' category="'+undef.category.trim()+'"');
await page.evaluate(()=>{ openLead=null; render(); });

/* ---- (d) Clients header recalculates with the At risk chip ---- */
await page.evaluate(()=>{ current='clients'; render(); });
await page.waitForTimeout(3000);
const clients = await page.evaluate(()=>{
  const read=()=>({count:(document.getElementById('cl_kv_count')||{}).textContent,
                   billed:(document.getElementById('cl_kv_billed')||{}).textContent,
                   rows:[...document.querySelectorAll('#view tbody tr')].filter(r=>r.style.display!=='none'&&r.hasAttribute('data-billed')).length});
  const before=read();
  /* click the real chip, the way a person does — the handler is not exposed globally */
  const btn=[...document.querySelectorAll('button.v26_3-chip')].find(b=>/^\s*(At risk|\u0641\u064a \u062e\u0637\u0631)\s*$/.test(b.textContent||''));
  if(btn) btn.click();
  return {clicked:!!btn, before, after:read()};
});
if(!clients.clicked) fails.push('(d) could not find the At risk chip to click');
notes.push('(d) clients before='+JSON.stringify(clients.before)+' after At-risk='+JSON.stringify(clients.after));
if(clients.after.count && String(clients.after.count)!==String(clients.after.rows))
  fails.push('(d) header count '+clients.after.count+' does not match the '+clients.after.rows+' rows on screen');
if(clients.after.rows===clients.before.rows) fails.push('(d) the At risk chip did not filter anything - test proved nothing');
if(clients.before.billed===clients.after.billed && clients.before.rows!==clients.after.rows)
  fails.push('(d) billed total did not change when the filter did');

/* ---- (e) Finance Outstanding agrees with collections AR ---- */
await page.evaluate(()=>{ current='finance'; render(); });
await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
await page.waitForTimeout(2500);
const fin = await page.evaluate(async ()=>{
  finGo('overview'); await new Promise(r=>setTimeout(r,1500));
  const perf=(document.getElementById('view').textContent||'').match(/Outstanding\s*([\d.,]+[KM]?)/);
  finGo('clients'); await new Promise(r=>setTimeout(r,1500));
  const coll=(document.getElementById('view').textContent||'').match(/Outstanding \(AR\)\s*([\d.,]+[KM]?)/);
  return {performance:perf?perf[1]:null, collections:coll?coll[1]:null};
});
if(!fin.performance||!fin.collections||fin.performance!==fin.collections)
  fails.push('(e) Outstanding still disagrees: Performance='+fin.performance+' vs Collections='+fin.collections);
notes.push('(e) Outstanding — Performance='+fin.performance+' Collections='+fin.collections);

/* ---- (3) nicknames shown, official names kept ---- */
await page.evaluate(()=>{ current='leads'; render(); });
await page.waitForTimeout(3500);
const nick = await page.evaluate(()=>{
  const t=document.getElementById('view').textContent||'';
  return {mapLoaded:!!window.__nickMap, showsNickname:/Abu Nasser/.test(t), showsLegal:/Assem Alsweed/.test(t),
          dataStillLegal:((DB.businesses||[]).filter(b=>b.assignedTo==='Assem Alsweed').length)};
});
if(!nick.mapLoaded) fails.push('(3) the nickname list did not load');
if(!nick.showsNickname) fails.push('(3) nicknames are not showing on the Leads page');
if(nick.showsLegal) fails.push('(3) the legal name is still showing as an owner label');
if(!nick.dataStillLegal) fails.push('(3) the stored owner name was altered — it must stay the legal name');
notes.push('(3) nickname on screen='+nick.showsNickname+' legal name on screen='+nick.showsLegal+' stored records still legal='+nick.dataStillLegal);

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));
console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length? '\nROUND FAILS:\n  '+fails.join('\n  ') : '\nROUND OK · every fix verified in the running app');
await browser.close(); process.exit(fails.length?1:0);
