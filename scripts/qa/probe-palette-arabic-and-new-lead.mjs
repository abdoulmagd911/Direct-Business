/* probe-palette-arabic-and-new-lead.mjs — guards js/78 (the Ctrl/⌘+K command palette).
   Found live 2026-09-15 against the real database (fire #48): "New lead" in the palette threw
   `editLead is not defined`, the "N" shortcut on Leads fell through to the palette for the same
   reason, and in Arabic mode the whole palette was English (search hint, 27/28 rows, footer,
   "No matches.", the "?" cheat sheet).
   Asserts, in the mock world:
     EN  · Ctrl+K opens the palette · "New lead" opens the New business form with NO JS error
         · "N" on the Leads page opens that same form directly
     AR  · the search hint, footer and no-match line are Arabic · every action/nav/preset row is
           Arabic · an ENGLISH query ("settings") still finds the relabelled row · a real record
           row carries an Arabic kind badge · the "?" cheat sheet is Arabic when shown
   Sabotage-tested: with the js/78 script line removed from index.html, 11 of the 13 checks go FAIL
   and the exit code is 1. Run: node scripts/qa/probe-palette-arabic-and-new-lead.mjs           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB=fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js','utf8');
const PORT=8912; const srv=start(PORT); const BASE='http://localhost:'+PORT;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errors=[]; p.on('pageerror',e=>errors.push(e.message));
await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async r=>{
  const rq=r.request(); const u=new URL(rq.url());
  try{ const resp=await fetch(BASE+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()});
    const body=await resp.text(); const h={}; resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))h[k]=v;});
    await r.fulfill({status:resp.status,headers:h,body}); }catch(e){ await r.fulfill({status:500,body:'{}'}); }
});
await p.route(u=>u.href.includes('cdn.jsdelivr.net'), r=>r.fulfill({status:200,contentType:'application/javascript',body:LIB}));
await p.route(u=>u.href.includes('fonts.googleapis.com'), r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await p.route(u=>u.href.includes('fonts.gstatic.com')||u.href.includes('clearbit.com'), r=>r.abort());
await p.goto(BASE+'/today',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2000);
await p.fill('#cl_email','test@directksa.com'); await p.fill('#cl_pw','Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);
const AR=/[؀-ۿ]/;
const palState=()=>p.evaluate(()=>{ const pal=document.getElementById('v19palette'); const items=[...document.querySelectorAll('#v19plist .pitem')];
  return { open:!!(pal&&pal.classList.contains('show')), n:items.length, placeholder:(document.getElementById('v19pinput')||{}).placeholder||'',
    foot:(document.querySelector('#v19palette .pfoot')||{}).innerText||'', listText:(document.getElementById('v19plist')||{}).innerText||'',
    rows:items.map(x=>({lbl:(x.querySelector('.lbl b')||{}).innerText||'',kind:(x.querySelector('.kind')||{}).innerText||''})) }; });
const modal=()=>p.evaluate(()=>{ const ov=document.getElementById('ov'); const open=!!(ov&&ov.classList.contains('show')); return {open, head:open?(ov.innerText||'').replace(/\s+/g,' ').trim().slice(0,40):''}; });

/* ---------- EN ---------- */
await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
const en1=await palState();
const before=errors.length;
const ranNewLead=await p.evaluate(()=>{ const i=_palResults.findIndex(r=>r.lbl==='New lead'); if(i<0) return 'no row'; runPalette(i); return true; });
await p.waitForTimeout(900);
const m1=await modal(); const newLeadErr=errors.slice(before).find(e=>/editLead/.test(e))||null;
await p.evaluate(()=>{ try{closeModal();}catch(_){} });
await p.evaluate(()=>{ current='leads'; openLead=null; render(); }); await p.waitForTimeout(700);
await p.evaluate(()=>{ if(document.activeElement) document.activeElement.blur(); });
await p.keyboard.press('n'); await p.waitForTimeout(700);
const m2=await modal(); const palAfterN=await palState();
await p.evaluate(()=>{ try{closeModal();}catch(_){} try{closePalette();}catch(_){} });

/* ---------- AR ---------- */
await p.evaluate(()=>{ if(typeof toggleLang==='function'&&LANG!=='ar') toggleLang(); }); await p.waitForTimeout(1200);
await p.evaluate(()=>{ current='today'; openLead=null; render(); }); await p.waitForTimeout(500);
await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
const ar1=await palState();
await p.keyboard.type('settings'); await p.waitForTimeout(400);
const ar2=await palState();
await p.fill('#v19pinput',''); await p.keyboard.type('zqxjvw9k'); await p.waitForTimeout(400);
const ar3=await palState();
/* a real (mock) record row → Arabic kind badge */
const tok=await p.evaluate(()=>{ const x=(DB.businesses||[]).find(b=>b.name&&/^[A-Za-z]{4,}/.test(b.name.trim())); return x?x.name.trim().split(/\s+/)[0]:''; });
await p.fill('#v19pinput',''); if(tok){ await p.keyboard.type(tok); await p.waitForTimeout(400); }
const ar4=await palState();
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.evaluate(()=>{ if(document.activeElement) document.activeElement.blur(); });
await p.keyboard.press('?'); await p.waitForTimeout(400);
const help=await p.evaluate(()=>{ const h=document.getElementById('v19help'); return { open:!!(h&&h.classList.contains('show')), text:h?h.innerText:'' }; });
await p.keyboard.press('Escape');
await b.close(); srv.close?.();

const nonAr=ar1.rows.filter(r=>!AR.test(r.lbl)).map(r=>r.lbl);
const recRow=ar4.rows.find(r=>r.lbl&&tok&&r.lbl.toLowerCase().includes(tok.toLowerCase()));
const checks=[
  ['EN: Ctrl+K opens the palette with rows', en1.open&&en1.n>5],
  ['EN: "New lead" row exists and runs', ranNewLead===true],
  ['EN: "New lead" opens the New business form', m1.open&&/New business|جهة جديدة/.test(m1.head)],
  ['EN: "New lead" raises no "editLead is not defined"', !newLeadErr],
  ['EN: "N" on Leads opens the form directly (not the palette)', m2.open&&!palAfterN.open],
  ['AR: search hint is Arabic', AR.test(ar1.placeholder)],
  ['AR: footer (navigate/open/close) is Arabic', AR.test(ar1.foot)],
  ['AR: every action/nav/preset row is Arabic', ar1.n>5&&nonAr.length===0],
  ['AR: English query "settings" still finds the Settings row', ar2.rows.some(r=>/الإعدادات/.test(r.lbl))],
  ['AR: no-match line is Arabic', ar3.n===0&&AR.test(ar3.listText)],
  ['AR: a record row carries an Arabic kind badge', !!(recRow&&AR.test(recRow.kind))],
  ['AR: "?" cheat sheet is Arabic when shown', help.open&&AR.test(help.text)&&!/Keyboard shortcuts/.test(help.text)],
  ['no JS errors', errors.length===0],
];
let fail=0; for(const [n,ok] of checks){ console.log((ok?'PASS':'FAIL')+' · '+n); if(!ok)fail++; }
if(fail){ console.log('detail:',JSON.stringify({en1:{open:en1.open,n:en1.n},m1,m2,palAfterN:palAfterN.open,ar1:{placeholder:ar1.placeholder.slice(0,40),foot:ar1.foot.slice(0,40),nonAr:nonAr.slice(0,6)},ar2:ar2.rows.slice(0,4),ar3:{n:ar3.n,t:ar3.listText.slice(0,30)},tok:tok.length,recRow,help:{open:help.open,t:help.text.slice(0,40)}})); if(errors.length)console.log('errors:',errors); }
process.exit(fail?1:0);
