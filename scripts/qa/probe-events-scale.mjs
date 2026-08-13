// Drives the Events page at REAL scale — the live calendar shape as of 2026-08-13:
// 80 events, 18 already ended, 21 with no date yet, 25 not decided. Names are synthetic;
// only the shape matters. Screenshots so the page can be judged by eye, not by counts.
// Run: node scripts/qa/probe-events-scale.mjs
import { chromium } from 'playwright';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');

// ---- build the 80-event world (synthetic names, real distribution) ----
const MOVES = ['attend','stand','mine','undecided','skip'];
const VERTS = ['Travel','Tech','Study','Other'];
const CITIES = ['Riyadh','Jeddah','Dubai','Madinah','Dammam','Abu Dhabi','Doha','London',null];
const EV = [];
let n = 0;
const push = (o) => EV.push(Object.assign({
  id:'ev'+(n++), name_ar:'فعالية '+n, venue:'Venue '+n, organiser:'Org '+n,
  link:'https://example.com/'+n, opportunity_sales:n%2===0, opportunity_partner:n%3===0,
  approach_status:'not_started', exhibitor_list_url:null, notes:null,
  created_at:null, updated_at:null
}, o));

// 18 already ended (Jan–Jul 2026)
for (let i=0;i<18;i++) push({
  name_en:'Past Event '+(i+1), vertical:VERTS[i%4], status:'confirmed',
  start_date:'2026-0'+((i%6)+1)+'-1'+(i%9), end_date:'2026-0'+((i%6)+1)+'-1'+(i%9),
  city:CITIES[i%9], priority:(i%5)+1, approach:MOVES[i%5],
});
// 38 upcoming (Sep–Dec 2026)
for (let i=0;i<38;i++){
  const m = 9 + (i%4);
  push({
    name_en:'Upcoming Event '+(i+1), vertical:VERTS[i%4], status:'confirmed',
    start_date:'2026-'+String(m).padStart(2,'0')+'-'+String((i%27)+1).padStart(2,'0'),
    end_date:'2026-'+String(m).padStart(2,'0')+'-'+String((i%27)+2).padStart(2,'0'),
    city:CITIES[i%9], priority:(i%5)+1, approach:MOVES[i%5],
    notes: i%7===0 ? 'A long note that goes on and on about the event, its audience, the reason it matters to us, and what we plan to do there — long enough to wrap several lines.' : null,
  });
}
// a careless paste: a 900-character name and markup in the title (both accepted by the
// database — the page must survive them without breaking the layout)
push({name_en:'ZZ Long '+('A very long event name '.repeat(38)), vertical:'Travel', status:'confirmed',
      start_date:'2026-12-28', end_date:'2026-12-29', city:'Riyadh', priority:2, approach:'mine'});
push({name_en:'<script>alert(1)</script> & "quotes" <b>', vertical:'Tech', status:'confirmed',
      start_date:'2026-12-29', end_date:'2026-12-30', city:'Riyadh', priority:2, approach:'attend'});

// mirrors the real calendar: a Dubai commitment overlapping a Riyadh one (must warn),
// and two Riyadh commitments on the same days (must NOT warn — two people cover them)
push({name_en:'Clash Dubai Show', vertical:'Travel', status:'confirmed', start_date:'2026-12-20', end_date:'2026-12-23',
      city:'Dubai', priority:5, approach:'stand'});
push({name_en:'Clash Riyadh Summit', vertical:'Tech', status:'confirmed', start_date:'2026-12-21', end_date:'2026-12-22',
      city:'Riyadh', priority:5, approach:'attend'});
push({name_en:'Same City A', vertical:'Tech', status:'confirmed', start_date:'2026-12-26', end_date:'2026-12-27',
      city:'Riyadh', priority:3, approach:'attend'});
push({name_en:'Same City B', vertical:'Tech', status:'confirmed', start_date:'2026-12-26', end_date:'2026-12-27',
      city:'Riyadh', priority:3, approach:'stand'});

// 21 with no date yet (awards shelf + unscheduled fairs)
for (let i=0;i<21;i++) push({
  name_en:'Undated Event '+(i+1), vertical:VERTS[i%4], status:'no_date',
  start_date:null, end_date:null, city:CITIES[i%9], priority:(i%5)+1,
  approach:i<10?'undecided':MOVES[i%5],
});
// force the real "not decided" count to 25
let undecided = EV.filter(e=>e.approach==='undecided').length;
for (const e of EV){ if (undecided>=25) break; if (e.approach!=='undecided'){ e.approach='undecided'; undecided++; } }

const PORT = 8095, BASE = 'http://localhost:'+PORT;
const srv = start(PORT, { ksa_events: EV });
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport:{width:1440,height:1000} })).newPage();
const errors = [];
p.on('pageerror', e => errors.push('js: '+e.message));
p.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
  const rq=r.request(); const u=new URL(rq.url());
  try{ const resp=await fetch(BASE+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()});
    const body=await resp.text(); const h={}; resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))h[k]=v;});
    await r.fulfill({status:resp.status,headers:h,body}); }catch(e){ await r.fulfill({status:500,body:'{}'}); }
});
await p.route('**cdn.jsdelivr.net/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:LIB}));
await p.route('**fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await p.route('**fonts.gstatic.com/**', r=>r.abort());

let failed=0, passed=0;
const check=(label,actual,expected)=>{ const ok=actual===expected; ok?passed++:failed++;
  console.log((ok?'PASS':'FAIL')+'  '+label+(ok?'':'  → got '+JSON.stringify(actual)+', expected '+JSON.stringify(expected))); };
const rows = () => p.evaluate(()=>document.querySelectorAll('#view tbody tr').length);
// what the eye actually sees — the pager hides the rest with display:none
const visRows = () => p.evaluate(()=>[...document.querySelectorAll('#view tbody tr')].filter(r=>r.style.display!=='none').length);

await p.goto(BASE+'/events',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2000);
await p.fill('#cl_email','test@directksa.com'); await p.fill('#cl_pw','Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);
await p.evaluate(()=>{current='events';render();});
await p.waitForTimeout(2500);

console.log('world: '+EV.length+' events — 18 ended, 38 upcoming, 21 undated, '+EV.filter(e=>e.approach==='undecided').length+' not decided');
console.log('rows shown by default:', await rows());
await p.screenshot({path:'scripts/qa/shot-events-scale-default.png',fullPage:true});

// What a person actually needs: the upcoming ones, not a wall of history
const TOTAL = EV.length, ENDED = 18;
check('no ended event on the opening view', await p.evaluate(()=>!/Past Event/.test(document.querySelector('#view tbody').textContent)), true);
check('"Past (N)" control exists', await p.evaluate(()=>!!document.getElementById('evF_past')), true);
check('first row is something still ahead', await p.evaluate(()=>/Upcoming|Undated/.test(document.querySelector('#view tbody tr').textContent)), true);
await p.click('#evF_past'); await p.waitForTimeout(600);
check('showing past reveals the finished ones', await p.evaluate(()=>/Past Event/.test(document.querySelector('#view tbody').textContent)), true);
await p.screenshot({path:'scripts/qa/shot-events-scale-withpast.png',fullPage:true});
await p.click('#evF_past'); await p.waitForTimeout(500);

// The stat tiles should be the fastest way to act on "25 need a decision"
check('stat tiles are clickable filters', await p.evaluate(()=>!!document.querySelector('[data-evstat]')), true);
await p.evaluate(()=>document.querySelector('[data-evstat="undecided"]').click());
await p.waitForTimeout(600);
const undecidedRows = await rows();
console.log('clicking "Not decided" tile →', undecidedRows, 'rows');
check('tile filters to not-decided only', undecidedRows>0 && undecidedRows<80, true);
await p.screenshot({path:'scripts/qa/shot-events-scale-undecided.png',fullPage:true});
await p.evaluate(()=>document.querySelector('[data-evstat="undecided"]').click());
await p.waitForTimeout(500);

// Undated events must not pretend to be first in a date-sorted list
const order = await p.evaluate(()=>[...document.querySelectorAll('#view tbody tr')].map(r=>r.textContent.slice(0,40)));
check('undated events sit at the end, not the top', /Undated/.test(order[order.length-1]||''), true);
await p.fill('#evF_q','Undated'); await p.waitForTimeout(700);
check('undated shows "no date yet", not a dash', (await p.evaluate(()=>document.querySelector('#view').innerText)).includes('no date yet'), true);
await p.fill('#evF_q',''); await p.waitForTimeout(600);
check('the list paginates instead of running 65 rows deep', await visRows() <= 20, true);
check('the pager reports the filtered total, not the raw 83', await p.evaluate(()=>{
  const l=[...document.querySelectorAll('.pg-bar span')].map(s=>s.textContent).join(' ');
  return /of 65/.test(l);
}), true);

// Cross-city clash warning — the thing a spreadsheet cannot tell you
await p.fill('#evF_q','Clash'); await p.waitForTimeout(700);
const clashTxt = await p.evaluate(()=>document.querySelector('#view').innerText);
check('cross-city clash is flagged on both events', (clashTxt.match(/clashes with/g)||[]).length, 2);
await p.fill('#evF_q','Same City'); await p.waitForTimeout(700);
const sameTxt = await p.evaluate(()=>document.querySelector('#view').innerText);
check('same-city overlap is NOT flagged (two people can cover it)', /clashes with/.test(sameTxt), false);
await p.fill('#evF_q',''); await p.waitForTimeout(600);

// A finished event must not claim a task is "Not started"
await p.click('#evF_past'); await p.waitForTimeout(700);
const pastTxt = await p.evaluate(()=>document.querySelector('#view').innerText);
check('past events say "no outcome recorded", not "Not started"',
  pastTxt.includes('no outcome recorded'), true);
await p.click('#evF_past'); await p.waitForTimeout(600);

// A 900-character name must not blow up the page or run it off the screen
await p.fill('#evF_q','ZZ Long'); await p.waitForTimeout(700);
check('a 900-char name does not make the page scroll sideways',
  await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1), true);
check('a 900-char name stays inside the table width', await p.evaluate(()=>{
  const td=document.querySelector('#view .v64-ev-table tbody td');
  return td ? td.getBoundingClientRect().width <= window.innerWidth : false;
}), true);
await p.screenshot({path:'scripts/qa/shot-events-longname.png',fullPage:true});
await p.fill('#evF_q','<script>'); await p.waitForTimeout(700);
check('markup in a name renders as text, never executes',
  await p.evaluate(()=>window.__xssScale===undefined && /<script>alert/.test(document.querySelector('#view').innerText)), true);
await p.fill('#evF_q',''); await p.waitForTimeout(600);

await p.setViewportSize({width:390,height:844});
await p.screenshot({path:'scripts/qa/shot-events-scale-mobile.png',fullPage:true});

console.log('---');
console.log(passed+' passed, '+failed+' failed');
console.log(errors.length?('PAGE ERRORS:\n'+errors.join('\n')):'0 page errors');
await b.close(); srv.close();
process.exit(failed||errors.length?1:0);
