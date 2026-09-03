/* Owner ruling 2026-08-21 — money belongs to Finance only. The "Your day" card on Today listed
   expiring proposals WITH their value ("… · 120000 SAR"), seen live 2026-08-29. This probe seeds
   one expiring proposal owned by the signed-in user, rebuilds the card, and asserts the card
   names the proposal and the client but prints no amount and no currency.
   Sabotage-tested: with the old line 248 (value + currency in the meta) this exits 1.
   Run: node scripts/qa/probe-today-no-money.mjs                                               */
import { chromium } from 'playwright';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB=fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js','utf8');
const PORT=8097; const srv=start(PORT); const BASE='http://localhost:'+PORT;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errors=[]; p.on('pageerror',e=>errors.push(e.message));
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r=>{
  const rq=r.request(); const u=new URL(rq.url());
  try{ const resp=await fetch(BASE+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()});
    const body=await resp.text(); const h={}; resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))h[k]=v;});
    await r.fulfill({status:resp.status,headers:h,body}); }catch(e){ await r.fulfill({status:500,body:'{}'}); }
});
await p.route('**cdn.jsdelivr.net/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:LIB}));
await p.route('**fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await p.route('**fonts.gstatic.com/**', r=>r.abort());
await p.goto(BASE+'/today',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2000);
await p.fill('#cl_email','test@directksa.com'); await p.fill('#cl_pw','Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);

const res=await p.evaluate(()=>{
  const me=(window.meName?meName():'')||'';
  const d=new Date(); d.setDate(d.getDate()+2); const soon=d.toISOString().slice(0,10);
  DB.offers=(DB.offers||[]).concat([{id:'probe_ofr_1',ref:'OFR-PROBE-1',subject:'Probe agreement',client:'Probe Client Co',
    value:120000,total:120000,currency:'SAR',owner:me,status:'Sent',date:new Date().toISOString().slice(0,10),validUntil:soon}]);
  current='today'; render();
  return new Promise(res=>setTimeout(()=>{
    const card=document.querySelector('.v57-yourday');
    const txt=card?card.innerText:'';
    res({me, hasCard:!!card, mentionsRef:/OFR-PROBE-1/.test(txt), mentionsClient:/Probe Client Co/.test(txt),
         showsAmount:/120[, ]?000/.test(txt), showsCurrency:/\bSAR\b|ر\.س|ريال/.test(txt), excerpt:txt.slice(0,400)});
  },900));
});
await b.close(); srv.close?.();

const checks=[
  ['signed-in user resolved', !!res.me],
  ['Your-day card rendered', res.hasCard],
  ['card names the proposal', res.mentionsRef],
  ['card names the client', res.mentionsClient],
  ['card prints NO amount', !res.showsAmount],
  ['card prints NO currency', !res.showsCurrency],
  ['no JS errors', errors.length===0],
];
let fail=0; for(const [n,ok] of checks){ console.log((ok?'PASS':'FAIL')+' · '+n); if(!ok)fail++; }
if(fail){ console.log('excerpt:', JSON.stringify(res.excerpt)); if(errors.length)console.log('errors:',errors); }
process.exit(fail?1:0);
