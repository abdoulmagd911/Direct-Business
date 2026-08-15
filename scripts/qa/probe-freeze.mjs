/* Reported: Team & Access froze the whole page for 15+ seconds as the manager, once right
   after clicking "Reset password" on the QA (admin) row. Measure responsiveness for real:
   a counter ticking on requestAnimationFrame — any main-thread stall shows as a gap. */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';
const LOG=[]; const S=(n,ok,d='')=>{LOG.push(ok?'P':'F');console.log(`${ok?'PASS':'FAIL'} · ${n}${d?' — '+d:''}`);};
const {browser,page,errs}=await openApp(9979);
const dialogs=[];
page.on('dialog',async d=>{ dialogs.push(d.type()+': '+d.message().slice(0,60)); try{ await d.accept(); }catch(_){} });
await signIn(page,TEAM.othman.email,TEAM.othman.pw); await ready(page); await go(page,'settings',2000);

await page.evaluate(()=>{ window.__beats=[]; (function beat(){ window.__beats.push(performance.now()); requestAnimationFrame(beat); })(); });
await page.evaluate(async ()=>{ try{ v48Users(); }catch(_){} await new Promise(r=>setTimeout(r,5000)); });

const open=await page.evaluate(()=>{
  const gaps=window.__beats.slice(1).map((t,i)=>t-window.__beats[i]);
  const worst=Math.max(...gaps);
  const rows=document.querySelectorAll('select[data-role]').length;
  const qaRow=[...document.querySelectorAll('#v48list > div')].find(d=>/test@directksa\.com/.test(d.textContent||''));
  return { rows, worstGapMs:Math.round(worst),
           qaHasReset: qaRow? !!qaRow.querySelector('[data-rst]') : null,
           qaHasSwitch: qaRow? !!qaRow.querySelector('[data-tog]') : null,
           qaNote: qaRow? /managed by an admin|يديرها مسؤول/.test(qaRow.textContent||'') : null,
           empHasReset: (()=>{const r=[...document.querySelectorAll('#v48list > div')].find(d=>/assem\.alsweed/.test(d.textContent||'')); return r? !!r.querySelector('[data-rst]') : null;})() };
});
S('the Team screen opens without stalling the page', open.rows>=11 && open.worstGapMs<1500, `worst frame gap ${open.worstGapMs}ms across open+load`);
S('the QA (admin) row shows NO reset/switch-off buttons to a manager', open.qaHasReset===false && open.qaHasSwitch===false && open.qaNote===true, JSON.stringify(open));
S('an employee row still has both buttons', open.empHasReset===true);

/* click Reset on an employee row — through the confirm — and watch for a stall */
await page.evaluate(()=>{ window.__beats=[]; });
await page.evaluate(()=>{
  const row=[...document.querySelectorAll('#v48list > div')].find(d=>/ahmed\.aboelmagd/.test(d.textContent||''));
  const b=row&&row.querySelector('[data-rst]'); if(b) b.click();
});
await page.waitForTimeout(6000);
const after=await page.evaluate(()=>{
  const gaps=window.__beats.slice(1).map((t,i)=>t-window.__beats[i]);
  return { worstGapMs:Math.round(Math.max(...gaps)), shown:!!document.getElementById('v48res') || /temporary|مؤقتة/i.test((document.getElementById('v48ov')||{}).textContent||'') };
});
S('Reset password runs without a hang once the confirm box is answered', after.worstGapMs<1500, `worst gap ${after.worstGapMs}ms · dialogs seen: ${dialogs.length}`);
console.log('dialogs:', dialogs);
/* put Ahmed's password back — the reset gave him a temporary one */
const URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const adm=await fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:TEAM.business.email,password:TEAM.business.pw})}).then(r=>r.json());
const list=await fetch(URL+'/functions/v1/admin-users',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+adm.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'list'})}).then(r=>r.json());
const ahmed=(list.users||[]).find(u=>u.email===TEAM.ahmed.email);
const back=await fetch(URL+'/functions/v1/admin-users',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+adm.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'reset_password',id:ahmed.id,password:TEAM.ahmed.pw})}).then(r=>({s:r.status}));
const check=await fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:TEAM.ahmed.email,password:TEAM.ahmed.pw})}).then(r=>r.json());
S('Ahmed\'s real password is restored and works (and stays permanent)', back.s===200 && !!check.access_token, String(back.s));
S('no javascript errors', errs.length===0, errs.slice(0,2).join(' | '));
await browser.close();
console.log(`\nFAILS: ${LOG.filter(x=>x==='F').length} / ${LOG.length}`);
process.exit(0);
