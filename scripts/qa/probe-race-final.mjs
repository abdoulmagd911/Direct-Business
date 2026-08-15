/* Two follow-ups: after a SLOW role check finally answers, does the person end up with
   exactly their own pages? And do the newest log entries carry the real person? */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';
const LOG=[]; const S=(n,ok,d='')=>{LOG.push(ok?'P':'F');console.log(`${ok?'PASS':'FAIL'} · ${n}${d?' — '+d:''}`);};

const {browser,page,errs}=await openApp(9997);
/* Fail the role lookup outright for a while, then let it through. (Delaying it instead
   does not work in this rig: the local forwarder resets any request held for seconds.) */
let brake=true;
await page.route('**/rest/v1/app_users**', route => {
  if(brake) return route.abort('connectionreset');
  /* fallback, not continue: continue() goes straight to the network and skips the rig's own
     forwarding route, so the request dies in the sandbox and the test blames the app */
  return route.fallback();
});
await signIn(page,TEAM.assem.email,TEAM.assem.pw);
await page.waitForTimeout(1200);
const during=await page.evaluate(async ()=>{
  try{ current='settings'; if(typeof render==='function') render(); }catch(_){}
  await new Promise(r=>setTimeout(r,1500));
  const nav=document.getElementById('nav');
  const vis=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement)if(x.style&&x.style.display==='none')return false;return true;};
  return { roleKnown:window.__roleKnown===true, at:current,
           nav: nav?[...nav.querySelectorAll('button[data-view]')].filter(vis).map(b=>b.getAttribute('data-view')):[],
           finEdit: typeof canFinEdit==='function'?canFinEdit():null };
});
S('while still checking: only the four common pages, and Settings refused', during.at!=='settings' && during.nav.every(p=>['today','leads','clients','finance'].includes(p)), JSON.stringify(during));

brake=false;                                   // the network "recovers"
await page.waitForFunction(()=>window.__roleKnown===true,null,{timeout:60000}).catch(()=>{});
await page.waitForTimeout(5000);
const after=await page.evaluate(()=>{
  const nav=document.getElementById('nav');
  const vis=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement)if(x.style&&x.style.display==='none')return false;return true;};
  return { roleKnown:window.__roleKnown===true, role:window.__userRole, name:window.__userName,
           nav:[...nav.querySelectorAll('button[data-view]')].filter(vis).map(b=>b.getAttribute('data-view')),
           finEdit: typeof canFinEdit==='function'?canFinEdit():null };
});
S('once it answers: his real level, his four pages, and finance editable',
  after.roleKnown && after.role==='team_member' && after.nav.length===4 && after.finEdit===true, JSON.stringify(after));
S('no javascript errors through a slow first load', errs.length===0, errs.slice(0,2).join(' | '));
await browser.close();

/* the newest entries in the log */
const b2=await openApp(9998);
await signIn(b2.page,TEAM.othman.email,TEAM.othman.pw); await ready(b2.page); await go(b2.page,'activity',3000);
const log=await b2.page.evaluate(()=>{
  const a=(DB.audit||[]);
  const newest=a.slice(0,6).map(x=>({user:x.user,entity:x.entity,action:x.action}));
  return { total:a.length, newest, hardcoded:a.slice(0,6).filter(x=>x.user==='Abdelrahman').length,
           onScreen:((document.getElementById('view')||{}).textContent||'').slice(0,60) };
});
S('the newest entries name the person who did it, not a hard-coded name', log.hardcoded===0, JSON.stringify(log.newest));
S('the manager can open the log and it is not empty', log.total>0 && !/No activity yet/.test(log.onScreen), `${log.total} entries`);
await b2.browser.close();
console.log(`\nFAILS: ${LOG.filter(x=>x==='F').length} / ${LOG.length}`);
process.exit(0);
