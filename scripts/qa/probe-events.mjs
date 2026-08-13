// Focused probe for the in-app Events page (v64 layer): Our move pills, the
// We-take-part chip, move filter, event-site login, lead counts, edit modal.
// Runs the real app against the local mock. Exits non-zero on any failure.
// Run: node scripts/qa/probe-events.mjs
import { chromium } from 'playwright';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB=fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js','utf8');
const PORT=8093; const srv=start(PORT); const BASE='http://localhost:'+PORT;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:950},acceptDownloads:true})).newPage();
const errors=[];
p.on('pageerror',e=>errors.push('js: '+e.message));
p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r=>{
  const rq=r.request(); const u=new URL(rq.url());
  try{ const resp=await fetch(BASE+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()});
    const body=await resp.text(); const h={}; resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))h[k]=v;});
    await r.fulfill({status:resp.status,headers:h,body}); }catch(e){ await r.fulfill({status:500,body:'{}'}); }
});
await p.route('**cdn.jsdelivr.net/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:LIB}));
await p.route('**fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await p.route('**fonts.gstatic.com/**', r=>r.abort());

let failed=0, passed=0;
const check=(label,actual,expected)=>{
  const ok=actual===expected; ok?passed++:failed++;
  console.log((ok?'PASS':'FAIL')+'  '+label+(ok?'':'  → got '+JSON.stringify(actual)+', expected '+JSON.stringify(expected)));
};
const rows=()=>p.evaluate(()=>document.querySelectorAll('#view tbody tr').length);
const viewText=()=>p.evaluate(()=>document.querySelector('#view').innerText);

// Boot straight to /events (deep path) and sign in
await p.goto(BASE+'/events',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2000);
await p.fill('#cl_email','test@directksa.com'); await p.fill('#cl_pw','Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);
await p.evaluate(()=>{current='events';render();});
await p.waitForTimeout(2500);

const txt=await viewText();
check('events page renders with rows', (await rows())>0, true);
check('stat tiles count only what is still ahead (7 of 8; the ended one is out)',
  txt.includes('7\nStill ahead')&&txt.includes('2\nHave a stand')&&txt.includes('2\nGo & meet')&&txt.includes('2\nMine the website'), true);
check('move pill visible on rows', txt.includes('MINE THE WEBSITE')||txt.includes('Mine the website'), true);
check('event-site login line shows (🔑 who signed up)', txt.includes('🔑')&&txt.includes('Abdulrahman'), true);
check('lead count line shows on Event 0', txt.includes('3 leads in the app'), true);
check('companies list link shows', txt.includes('Companies list ↗'), true);

// Front-end audit round (2026-08-13): simpler table, self-cleaning dates
check('relative day hint shows ("in N days")', /in \d+ days|tomorrow|happening now/.test(txt), true);
// Scale round: the page opens on what is still ahead; finished events are one click away
check('ended event is NOT in the opening view', txt.includes('Event 3'), false);
check('"Past (N)" chip offers the finished ones', await p.evaluate(()=>!!document.getElementById('evF_past')), true);
await p.click('#evF_past'); await p.waitForTimeout(600);
const withPast = await viewText();
check('showing past: the ended event appears and reads "ended"', withPast.includes('Event 3')&&withPast.includes('ended'), true);
check('showing past: the ended row is faded', await p.evaluate(()=>{
  const tr=[...document.querySelectorAll('#view tbody tr')].find(r=>r.textContent.includes('Event 3'));
  return tr?tr.getAttribute('style').includes('opacity:.55'):false;
}), true);
await p.click('#evF_past'); await p.waitForTimeout(600);
check('high-priority star shows', txt.includes('★'), true);
check('Opportunity column removed (tags live under the name)', await p.evaluate(()=>![...document.querySelectorAll('#view thead th')].some(th=>/opportunity|pri/i.test(th.textContent))), true);
check('Sales/Partner tags still visible', txt.includes('Sales')&&txt.includes('Partner'), true);
check('opportunity dropdown removed', await p.evaluate(()=>!document.getElementById('evF_o')), true);
check('"Share view-only link" removed from this page', await p.evaluate(()=>!((document.getElementById('view')||{}).textContent||'').includes('Share view-only link')), true);
await p.screenshot({path:'scripts/qa/shot-app-events.png',fullPage:true});

// The one-tap chip: stand + attend only (2+2 of 8)
await p.click('#evF_ours'); await p.waitForTimeout(500);
check('🎪 We take part → 4 rows', await rows(), 4);
await p.click('#evF_ours'); await p.waitForTimeout(500);
check('chip off → the 7 still ahead', await rows(), 7);

// Move filter
await p.selectOption('#evF_m','mine'); await p.waitForTimeout(500);
check('move filter mine → 2 rows', await rows(), 2);
await p.selectOption('#evF_m','all'); await p.waitForTimeout(500);
check('move filter reset → the 7 still ahead', await rows(), 7);

// Search still works alongside
await p.fill('#evF_q','Event 3'); await p.waitForTimeout(600);
check('search narrows to 1 row', await rows(), 1);
await p.fill('#evF_q',''); await p.waitForTimeout(600);

// Edit modal: signup fields prefilled for the event that has a stored login (e2)
await p.evaluate(()=>evOpenModal('e2')); await p.waitForTimeout(400);
check('modal: move select present', await p.evaluate(()=>!!document.getElementById('ev_move')), true);
check('modal: login email prefilled', await p.evaluate(()=>document.getElementById('ev_su_email').value), 'business@directksa.com');
check('modal: password prefilled', await p.evaluate(()=>document.getElementById('ev_su_pass').value), 'throwaway-1');
check('modal: password is masked on screen', await p.evaluate(()=>document.getElementById('ev_su_pass').type), 'password');
check('modal: who prefilled', await p.evaluate(()=>document.getElementById('ev_su_by').value), 'Abdulrahman');
await p.screenshot({path:'scripts/qa/shot-app-events-modal.png',fullPage:true});
await p.evaluate(()=>document.getElementById('ev_cancel').click()); await p.waitForTimeout(300);

// Add modal: "who signed up" pre-fills from the signed-in user
await p.evaluate(()=>evOpenModal()); await p.waitForTimeout(400);
const who=await p.evaluate(()=>document.getElementById('ev_su_by').value);
console.log('info  add-modal "Who signed up" prefill =', JSON.stringify(who), '(from the signed-in profile)');
check('add modal: move defaults to Not decided', await p.evaluate(()=>document.getElementById('ev_move').value), 'undecided');
await p.evaluate(()=>document.getElementById('ev_cancel').click());
await p.waitForTimeout(300);

// ---- Export + keyboard round ----
check('stat tiles are reachable by keyboard', await p.evaluate(()=>{
  const t=document.querySelector('[data-evstat]');
  return !!t && t.getAttribute('role')==='button' && t.getAttribute('tabindex')==='0';
}), true);
await p.evaluate(()=>document.querySelector('[data-evstat="mine"]').focus());
await p.keyboard.press('Enter'); await p.waitForTimeout(600);
check('Enter on a focused tile filters the list', await rows(), 2);
await p.evaluate(()=>document.querySelector('[data-evstat="mine"]').focus());
await p.keyboard.press(' '); await p.waitForTimeout(600);
check('Space clears it again', await rows(), 7);

const dl = p.waitForEvent('download', {timeout:15000}).catch(()=>null);
await p.evaluate(()=>exportCurrent('list'));
const file = await dl;
check('Export on the Events page produces a file', !!file, true);
if (file){
  check('the file is the events list, not a database dump', /events/.test(file.suggestedFilename()), true);
  const path = await file.path();
  const csv = fs.readFileSync(path,'utf8');
  check('CSV carries the move column', /Our move/.test(csv), true);
  check('CSV carries who signed up', /Signed up by/.test(csv), true);
  check('CSV never carries the event-site password', /throwaway-1/.test(csv), false);
  check('CSV row count matches what was on screen', csv.trim().split('\n').length-1, 7);
}

// ---- Polish round: Escape, duplicate guard, phone layout ----
await p.evaluate(()=>evOpenModal('e2')); await p.waitForTimeout(400);
check('modal: first field is focused on open', await p.evaluate(()=>document.activeElement&&document.activeElement.id), 'ev_n');
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
check('modal: Escape closes it', await p.evaluate(()=>!document.getElementById('ev_move')), true);

await p.evaluate(()=>evOpenModal()); await p.waitForTimeout(400);
await p.fill('#ev_n','Event 1');            // a name already on the calendar
let asked=false; p.once('dialog', d=>{ asked=true; d.dismiss(); });
await p.evaluate(()=>document.getElementById('ev_save').click()); await p.waitForTimeout(700);
check('adding a duplicate name asks first', asked, true);
check('duplicate declined → nothing saved, dialog stays open', await p.evaluate(()=>!!document.getElementById('ev_move')), true);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);

// Phone: the date must be visible without scrolling sideways
await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(600);
check('phone: no sideways scroll on the page', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1), true);
check('phone: rows become stacked cards', await p.evaluate(()=>{
  const td=document.querySelector('#view .v64-ev-table tbody td');
  return td?getComputedStyle(td).display==='block':false;
}), true);
check('phone: the date is inside the visible width', await p.evaluate(()=>{
  const tds=[...document.querySelectorAll('#view .v64-ev-table tbody td')].filter(t=>t.getAttribute('data-l')&&/When|متى/.test(t.getAttribute('data-l')));
  if(!tds.length) return false;
  const r=tds[0].getBoundingClientRect();
  return r.left>=0 && r.right<=window.innerWidth+1;
}), true);
await p.screenshot({path:'scripts/qa/shot-app-events-phone.png',fullPage:true});
await p.setViewportSize({width:1440,height:950}); await p.waitForTimeout(400);

// ---- Arabic pass (2026-08-13): the page must speak Arabic, not half-English ----
await p.evaluate(()=>{ try{ LANG='ar'; }catch(_){}; try{ applyLang&&applyLang(); }catch(_){}; try{ render(); }catch(_){} });
await p.waitForTimeout(1500);
const arTxt = await viewText();
check('AR: page is right-to-left', await p.evaluate(()=>document.documentElement.getAttribute('dir')), 'rtl');
check('AR: move labels translated (جناح / حضور ولقاءات)', arTxt.includes('جناح')&&arTxt.includes('حضور ولقاءات'), true);
check('AR: "Mine the website" translated', arTxt.includes('جمع من الموقع'), true);
check('AR: column headers translated (خطتنا)', arTxt.includes('خطتنا'), true);
check('AR: chip translated (نشارك فيها)', arTxt.includes('نشارك فيها'), true);
check('AR: relative date translated (بعد N يوم)', /بعد \d+ يوم/.test(arTxt), true);
check('AR: no leftover English move labels', /Have a stand|Go & meet|Mine the website|Not decided/.test(arTxt), false);
await p.screenshot({path:'scripts/qa/shot-app-events-ar.png',fullPage:true});
await p.evaluate(()=>evOpenModal('e2')); await p.waitForTimeout(500);
const arModal = await p.evaluate(()=>document.body.innerText);
check('AR: edit form translated (خطتنا / حساب موقع الفعالية)', arModal.includes('خطتنا')&&arModal.includes('حساب موقع الفعالية'), true);
check('AR: save button translated', arModal.includes('حفظ الفعالية'), true);
await p.screenshot({path:'scripts/qa/shot-app-events-ar-modal.png',fullPage:true});
await p.evaluate(()=>document.getElementById('ev_cancel').click());

console.log('---');
console.log(passed+' passed, '+failed+' failed');
console.log(errors.length?('PAGE ERRORS:\n'+errors.join('\n')):'0 page errors');
await b.close(); srv.close();
process.exit(failed||errors.length?1:0);
