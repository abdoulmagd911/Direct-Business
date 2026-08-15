/* Cowork reported: an employee deletes a lead, it disappears from his screen, but the record
   is still there when an admin looks. Settle it — create one as the employee, delete it the
   way the screen does, then ask the database directly, with a fresh admin token. */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';
const URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const tok=(e,p)=>fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})}).then(r=>r.json()).then(r=>r.access_token);
const LOG=[]; const S=(n,ok,d='')=>{LOG.push(ok?'P':'F');console.log(`${ok?'PASS':'FAIL'} · ${n}${d?' — '+d:''}`);};

const NAME='Delete check '+Math.floor(Math.random()*100000);
const {browser,page,errs}=await openApp(9980);
await signIn(page,TEAM.assem.email,TEAM.assem.pw); await ready(page); await go(page,'leads',2000);

const made=await page.evaluate(async (nm)=>{
  const id='delchk-'+Date.now();
  DB.businesses.push({id,name:nm,segment:'QA',category:'Convert',source:'Direct outreach',stage:'New',
    assignedTo:(window.meName?meName():''),isClient:false,contacts:[],activities:[],notes:'delete check',totalSAR:0});
  if(typeof save==='function') save();
  await new Promise(r=>setTimeout(r,5000));
  return id;
}, NAME);
await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(9000); await ready(page);
const survived=await page.evaluate(id=>(DB.businesses||[]).some(b=>b.id===id), made);
S('the employee can create a lead and it survives a reload', survived, made);

const adm=await tok(TEAM.business.email,TEAM.business.pw);
const seen=await fetch(`${URL}/rest/v1/businesses?select=id,name,archived_at&name=eq.${encodeURIComponent(NAME)}`,{headers:{apikey:ANON,Authorization:'Bearer '+adm}}).then(r=>r.json());
S('an admin can see it in the database', seen.length===1, JSON.stringify(seen[0]||seen));

/* now delete it exactly the way the screen does — the same code the Delete button runs */
await page.evaluate(async id=>{
  DB.businesses=DB.businesses.filter(x=>x.id!==id);
  openLead=null; if(typeof save==='function') save(); if(typeof render==='function') render();
  await new Promise(r=>setTimeout(r,6000));
}, made);
const goneOnScreen=await page.evaluate(id=>!(DB.businesses||[]).some(b=>b.id===id), made);
S('it disappears from the employee\'s screen', goneOnScreen);

await page.waitForTimeout(4000);
const after=await fetch(`${URL}/rest/v1/businesses?select=id,name,archived_at,archived_by&name=eq.${encodeURIComponent(NAME)}`,{headers:{apikey:ANON,Authorization:'Bearer '+adm}}).then(r=>r.json());
const row=after[0];
S('the database marks it deleted (archived_at is set)', !!(row && row.archived_at), JSON.stringify(row||'row gone entirely'));

/* and would another person still see it? that is the question that matters */
const t2=await tok(TEAM.raad.email,TEAM.raad.pw);
const live=await fetch(`${URL}/rest/v1/businesses?select=id,name&archived_at=is.null&name=eq.${encodeURIComponent(NAME)}`,{headers:{apikey:ANON,Authorization:'Bearer '+t2}}).then(r=>r.json());
S('another employee no longer sees it in their list', live.length===0, `${live.length} still live`);

S('no javascript errors', errs.length===0, errs.slice(0,2).join(' | '));
await browser.close();
/* tidy: hard-remove the check row whatever happened */
await fetch(`${URL}/rest/v1/businesses?name=eq.${encodeURIComponent(NAME)}`,{method:'DELETE',headers:{apikey:ANON,Authorization:'Bearer '+adm}});
console.log(`\nFAILS: ${LOG.filter(x=>x==='F').length} / ${LOG.length}`);
process.exit(0);
