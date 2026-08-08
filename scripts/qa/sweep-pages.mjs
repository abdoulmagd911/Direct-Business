import { chromium } from 'playwright';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB=fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js','utf8');
const PORT=8091; const srv=start(PORT); const BASE='http://localhost:'+PORT;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
const p=await ctx.newPage();
let phase='boot'; const errors=[];
const note=(w,m)=>{const s=String(m).slice(0,140); if(!errors.some(e=>e.msg===s&&e.phase===phase))errors.push({phase,where:w,msg:s});};
p.on('pageerror',e=>note('js',e.message));
p.on('console',m=>{if(m.type()==='error')note('console',m.text());});
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r=>{
  const rq=r.request(); const u=new URL(rq.url());
  try{ const resp=await fetch(BASE+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()});
    const body=await resp.text(); const h={}; resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))h[k]=v;});
    await r.fulfill({status:resp.status,headers:h,body}); }catch(e){ await r.fulfill({status:500,body:'{}'}); }
});
await p.route('**cdn.jsdelivr.net/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:LIB}));
await p.route('**fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await p.route('**fonts.gstatic.com/**', r=>r.abort());
phase='login';
await p.goto(BASE+'/ops',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2000);
await p.fill('#cl_email','test@directksa.com'); await p.fill('#cl_pw','Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);

// ---- click every in-page button on every page (skip destructive words) ----
const SKIP=/delete|remove|archive|sign out|logout|wipe|reset|clear|erase|حذف|أرشفة|خروج/i;
const items=await p.evaluate(()=>[...document.querySelectorAll('#nav button')].map(x=>x.textContent.trim()).filter(Boolean));
let clicked=0, skipped=0;
const perPage=[];
for(const label of items){
  phase='EN:'+label;
  const before=errors.length;
  await p.evaluate(l=>{const b=[...document.querySelectorAll('#nav button')].find(x=>x.textContent.trim()===l);if(b)b.click();},label);
  await p.waitForTimeout(700);
  const n=await p.evaluate(()=>document.querySelectorAll('#view button').length);
  for(let i=0;i<Math.min(n,25);i++){
    const t=await p.evaluate(i=>{const b=document.querySelectorAll('#view button')[i];return b?b.textContent.trim():null;},i);
    if(t===null) continue;
    if(SKIP.test(t)){skipped++;continue;}
    await p.evaluate(i=>{const b=document.querySelectorAll('#view button')[i];if(b)b.click();},i).catch(()=>{});
    clicked++;
    await p.waitForTimeout(120);
    await p.keyboard.press('Escape').catch(()=>{});
  }
  perPage.push({page:label,buttons:n,newErrors:errors.length-before});
}
console.log('EN button sweep: clicked '+clicked+', skipped '+skipped+' destructive');
console.log('\nPAGE                     buttons  errors');
for(const r of perPage) console.log(r.page.padEnd(24).slice(0,24), String(r.buttons).padEnd(8), r.newErrors);

// ---- Arabic ----
phase='switch-to-arabic';
const switched=await p.evaluate(()=>{ try{ if(typeof setLang==='function'){setLang('ar');return 'setLang';} if(typeof LANG!=='undefined'){LANG='ar'; if(typeof render==='function')render(); return 'LANG var';} }catch(e){return 'ERR '+e.message;} return 'no hook'; });
await p.waitForTimeout(1500);
console.log('\nArabic switch via:',switched);
console.log('dir attribute:', await p.evaluate(()=>document.documentElement.dir||document.body.dir||'(none)'));
const arItems=await p.evaluate(()=>[...document.querySelectorAll('#nav button')].map(x=>x.textContent.trim()).filter(Boolean));
console.log('Arabic nav:', arItems.join(' | '));
for(const label of arItems){
  phase='AR:'+label;
  await p.evaluate(l=>{const b=[...document.querySelectorAll('#nav button')].find(x=>x.textContent.trim()===l);if(b)b.click();},label);
  await p.waitForTimeout(600);
}
await p.evaluate(()=>{const b=[...document.querySelectorAll('#nav button')].find(x=>/Finance|المالية/.test(x.textContent));if(b)b.click();});
await p.waitForTimeout(900);
await p.screenshot({path:'/tmp/shot-finance-ar.png'});
console.log('\nTOTAL DISTINCT ERRORS:',errors.length);
for(const e of errors.slice(0,15)) console.log('  ['+e.phase+'] '+e.where+': '+e.msg);
fs.writeFileSync('/tmp/sweep2.json',JSON.stringify(errors,null,1));
await b.close(); srv.close();
