/* The Team screen lets a manager tick individual pages for someone. Their LEVEL is what the
   app really goes by, so what happens when the two disagree? Whatever it is, it must not be
   "the page appears and then quietly refuses to save". */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';
const URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const tok=(e,p)=>fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})}).then(r=>r.json()).then(r=>r.access_token);
const call=(t,b)=>fetch(URL+'/functions/v1/admin-users',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(b)}).then(async r=>({s:r.status,b:await r.json().catch(()=>({}))}));

const mgr=await tok(TEAM.othman.email,TEAM.othman.pw);
const list=(await call(mgr,{action:'list'})).b;
const emp=list.users.find(u=>u.email===TEAM.assem.email);
const original=emp.allowed_pages;
console.log('his pages before:', JSON.stringify(original));

await call(mgr,{action:'set_pages', id:emp.id, pages:['today','leads','clients','finance','settings','reports']});
const {browser,page,errs}=await openApp(9955);
await signIn(page,TEAM.assem.email,TEAM.assem.pw); await ready(page); await go(page,'today',2500);
const nav=await page.evaluate(()=>{const n=document.getElementById('nav');const vis=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement)if(x.style&&x.style.display==='none')return false;return true;};return [...n.querySelectorAll('button[data-view]')].filter(vis).map(b=>b.getAttribute('data-view'));});
await page.evaluate(()=>{current='settings';if(typeof render==='function')render();});
await page.waitForTimeout(2500);
const at=await page.evaluate(()=>current);
console.log(`sidebar after ticking Settings + Reports for him: ${JSON.stringify(nav)}`);
console.log(`forcing the settings page lands him on: ${at}`);
console.log(nav.length===4 && at==='today'
  ? 'PASS · his level still decides. Ticking pages changes nothing he can see or save.'
  : 'ATTENTION · ticking pages DID change what he sees — check it saves too, or it is a trap.');
console.log('javascript errors:', errs.length);
await browser.close();
await call(mgr,{action:'set_pages', id:emp.id, pages:original});
const after=(await call(mgr,{action:'list'})).b.users.find(u=>u.id===emp.id);
console.log('his pages put back to:', JSON.stringify(after.allowed_pages));
process.exit(0);
