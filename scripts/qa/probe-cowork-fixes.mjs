/* The four things a real browser test raised. Each one checked the way it was reported. */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';
const LOG=[]; const S=(n,ok,d='')=>{LOG.push(ok?'P':'F');console.log(`${ok?'PASS':'FAIL'} · ${n}${d?' — '+d:''}`);};
let port=9990;

/* ---- 2. the role dropdown, as the browser really draws it ---- */
for (const k of ['othman','business']) {
  const t=TEAM[k];
  const {browser,page,errs}=await openApp(port++);
  await signIn(page,t.email,t.pw); await ready(page); await go(page,'settings',2000);
  const r=await page.evaluate(async ()=>{
    try{ if(typeof v48Users==='function') v48Users(); }catch(_){}
    await new Promise(x=>setTimeout(x,4500));
    const sels=[...document.querySelectorAll('select[data-role]')];
    const add=document.getElementById('v48r');
    /* what is actually IN the page — not what is flagged hidden */
    const inRows=[...new Set(sels.flatMap(s=>[...s.options].map(o=>o.value)))].sort();
    const choosable=[...new Set(sels.flatMap(s=>[...s.options].filter(o=>!o.disabled).map(o=>o.value)))].sort();
    return { rows:sels.length, inRows, choosable,
             addForm: add? [...add.options].map(o=>o.value).sort() : null,
             oldRoles: inRows.filter(v=>['bd','operations','viewer'].includes(v)) };
  });
  const isAdmin = t.role==='admin';
  S(`${t.name}: no old roles (business development / operations / read only) anywhere in the picker`, r.oldRoles.length===0, JSON.stringify(r.oldRoles));
  S(`${t.name}: Admin ${isAdmin?'can':'CANNOT'} be chosen`, isAdmin ? r.choosable.includes('admin') : !r.choosable.includes('admin'), `choosable=${JSON.stringify(r.choosable)}`);
  S(`${t.name}: the add-a-teammate box offers ${isAdmin?'three levels':'two levels'}`,
    isAdmin ? (r.addForm||[]).includes('admin') : !(r.addForm||[]).includes('admin'), JSON.stringify(r.addForm));
  S(`${t.name}: no javascript errors`, errs.length===0, errs.slice(0,2).join(' | '));
  await browser.close();
}

/* ---- 3. the first-load race: what is on screen BEFORE the role is known ---- */
{
  const {browser,page,errs}=await openApp(port++);
  /* freeze the role lookup so the "we don't know yet" window is wide enough to inspect */
  await page.route('**/rest/v1/app_users?select=role*', async route => { await new Promise(r=>setTimeout(r,6000)); route.continue(); });
  await signIn(page,TEAM.assem.email,TEAM.assem.pw);
  await page.waitForTimeout(1200);
  /* force a restricted page while the answer is still in flight */
  const during=await page.evaluate(async ()=>{
    try{ current='settings'; if(typeof render==='function') render(); }catch(_){}
    await new Promise(r=>setTimeout(r,1500));
    const nav=document.getElementById('nav');
    const vis=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement)if(x.style&&x.style.display==='none')return false;return true;};
    return { roleKnown: window.__roleKnown===true,
             at: (typeof current!=='undefined')?current:'?',
             nav: nav? [...nav.querySelectorAll('button[data-view]')].filter(vis).map(b=>b.getAttribute('data-view')) : [],
             finEdit: (typeof canFinEdit==='function')? canFinEdit() : null };
  });
  S('while the role is still unknown, no extra pages are on screen',
    during.nav.length===0 || during.nav.every(p=>['today','leads','clients','finance'].includes(p)), JSON.stringify(during));
  S('while the role is still unknown, a restricted page cannot be opened', during.at!=='settings', 'landed on '+during.at);
  await ready(page); await page.waitForTimeout(4000);
  const after=await page.evaluate(()=>{
    const nav=document.getElementById('nav');
    const vis=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement)if(x.style&&x.style.display==='none')return false;return true;};
    return { roleKnown:window.__roleKnown===true, role:window.__userRole, name:window.__userName,
             nav:[...nav.querySelectorAll('button[data-view]')].filter(vis).map(b=>b.getAttribute('data-view')) };
  });
  S('once the answer arrives he gets exactly his four pages', after.roleKnown && after.nav.length===4, JSON.stringify(after));
  S('no javascript errors through the slow load', errs.length===0, errs.slice(0,2).join(' | '));
  await browser.close();
}

/* ---- 4. the log records the working day, under the right name ---- */
{
  const {browser,page,errs}=await openApp(port++);
  await signIn(page,TEAM.kareem.email,TEAM.kareem.pw); await ready(page); await go(page,'leads',2500);
  const res=await page.evaluate(async ()=>{
    const before=(DB.audit||[]).length;
    const id='auditchk-'+Date.now();
    DB.businesses.push({id,name:'Audit check '+id,segment:'QA',category:'Convert',source:'Direct outreach',
      stage:'New',assignedTo:(window.meName?meName():''),isClient:false,contacts:[],activities:[],notes:'',totalSAR:0});
    if(typeof save==='function') save();
    await new Promise(r=>setTimeout(r,6000));
    const rec=(DB.businesses||[]).find(b=>b.id===id); if(rec){ rec.stage='Contacted'; if(typeof save==='function') save(); }
    await new Promise(r=>setTimeout(r,6000));
    DB.businesses=DB.businesses.filter(b=>b.id!==id); if(typeof save==='function') save();
    await new Promise(r=>setTimeout(r,6000));
    const mine=(DB.audit||[]).filter(a=>String(a.entityId)===id||String(a.entity)==='session');
    return { before, after:(DB.audit||[]).length,
             actions:[...new Set(mine.map(a=>a.action))],
             users:[...new Set((DB.audit||[]).slice(0,20).map(a=>a.user))],
             signIn:(DB.audit||[]).some(a=>a.entity==='session'&&a.action==='sign in') };
  });
  S('the log gains entries as work happens', res.after>res.before, JSON.stringify({before:res.before,after:res.after}));
  S('it records creating, changing a stage and deleting', ['create','stage','delete'].every(a=>res.actions.includes(a)), JSON.stringify(res.actions));
  S('it records the sign-in', res.signIn);
  S('entries carry the real person, not a hard-coded name', !res.users.includes('Abdelrahman') && res.users.length>0, JSON.stringify(res.users));
  S('no javascript errors', errs.length===0, errs.slice(0,2).join(' | '));
  await browser.close();
}
console.log(`\nFAILS: ${LOG.filter(x=>x==='F').length} / ${LOG.length}`);
process.exit(0);
