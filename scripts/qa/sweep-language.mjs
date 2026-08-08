import { chromium } from 'playwright';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB=fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js','utf8');
const PORT=8092; const srv=start(PORT); const BASE='http://localhost:'+PORT;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r=>{const rq=r.request();const u=new URL(rq.url());
  try{const resp=await fetch(BASE+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()});
  const body=await resp.text();const h={};resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))h[k]=v;});
  await r.fulfill({status:resp.status,headers:h,body});}catch(e){await r.fulfill({status:500,body:'{}'});}});
await p.route('**cdn.jsdelivr.net/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:LIB}));
await p.route('**fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await p.route('**fonts.gstatic.com/**', r=>r.abort());
await p.goto(BASE+'/ops',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2000);
await p.fill('#cl_email','test@directksa.com'); await p.fill('#cl_pw','Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(4500);
await p.evaluate(()=>{ if(typeof toggleLang==='function') toggleLang(); });
await p.waitForTimeout(1200);
console.log('LANG now:', await p.evaluate(()=>typeof LANG!=='undefined'?LANG:'?'));
console.log('documentElement.dir:', await p.evaluate(()=>document.documentElement.dir));
console.log('computed direction of #view:', await p.evaluate(()=>getComputedStyle(document.getElementById('view')).direction));
const nav=await p.evaluate(()=>[...document.querySelectorAll('#nav button')].map(x=>x.textContent.trim()).filter(Boolean));
const found={};
for(const label of nav){
  await p.evaluate(l=>{const b=[...document.querySelectorAll('#nav button')].find(x=>x.textContent.trim()===l);if(b)b.click();},label);
  await p.waitForTimeout(800);
  const latin=await p.evaluate(()=>{
    const out=new Set();
    document.querySelectorAll('#view button, #view label, #view th, #view h1, #view h2, #view h3, #view option').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(!t||t.length<3||t.length>40) return;
      if(/[؀-ۿ]/.test(t)) return;          // has Arabic -> translated
      if(!/[A-Za-z]{3}/.test(t)) return;             // no real words
      if(/^[\d\s.,%+\-\/]+$/.test(t)) return;
      if(/(SAR|VAT|PNR|GDS|SLA|SOP|IATA|CSV|PDF|B2B|ID|KSA|Direct|Test Company|Provider \d|Airline \d|Event \d|INV-|https?:)/i.test(t)) return;
      out.add(t);
    });
    return [...out];
  });
  if(latin.length) found[label]=latin.slice(0,14);
}
console.log('\n=== Untranslated (Latin-only) UI text while app is in Arabic ===');
let total=0;
for(const [pg,list] of Object.entries(found)){ total+=list.length; console.log('\n'+pg+':'); console.log('   '+list.join(' · ')); }
console.log('\nTOTAL:',total,'across',Object.keys(found).length,'pages');
fs.writeFileSync('/tmp/lang.json',JSON.stringify(found,null,1));
await b.close(); srv.close();
