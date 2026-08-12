// Drives events/index.html in a headless browser with a stubbed Supabase module,
// so the KSA Events Hub can be exercised without touching production data.
// Heavy pass: every sort, every filter on/off, combined filters, chips, search,
// add/edit/delete flows, hostile text (HTML/script in fields), signed-out and
// signed-in faces. Exits non-zero if any check fails.
// Run: node scripts/qa/events-sweep.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(path.join(root, 'events', 'index.html'), 'utf8');

const SEED = [
  {id:'e1', name_en:'LEAP 2026', name_ar:'ليب', vertical:'Tech', status:'confirmed', priority:5,
   start_date:'2026-08-31', end_date:'2026-09-03', city:'Riyadh', venue:'Malham', organiser:'Tahaluf',
   link:'https://onegiantleap.com/', opportunity_sales:true, opportunity_partner:false,
   approach:'attend', approach_status:'signed_up', exhibitor_list_url:null, notes:'Mega tech event.'},
  {id:'e2', name_en:'Saudi Event Show 2026', name_ar:null, vertical:'Tech', status:'confirmed', priority:3,
   start_date:'2026-09-09', end_date:'2026-09-10', city:'Riyadh', venue:'RICEC', organiser:'Informa',
   link:'https://example.com/', opportunity_sales:true, opportunity_partner:true,
   approach:'stand', approach_status:'not_started', exhibitor_list_url:null, notes:'MICE industry.'},
  {id:'e3', name_en:'ATM 2026', name_ar:null, vertical:'Travel', status:'outside_ksa', priority:2,
   start_date:'2026-09-14', end_date:'2026-09-17', city:'Dubai', venue:'DWTC', organiser:'RX Global',
   link:'https://example.com/', opportunity_sales:false, opportunity_partner:true,
   approach:'mine', approach_status:'leads_added', exhibitor_list_url:'https://example.com/exhibitors', notes:'Dubai — desk research.'},
  {id:'e4', name_en:'TOURISE 2026', name_ar:null, vertical:'Travel', status:'stale', priority:1,
   start_date:null, end_date:null, city:'Riyadh', venue:null, organiser:null,
   link:null, opportunity_sales:false, opportunity_partner:true,
   approach:'skip', approach_status:'not_started', exhibitor_list_url:null, notes:'No 2026 edition.'},
  {id:'e5', name_en:'BESA Education Fairs', name_ar:null, vertical:'Study', status:'no_date', priority:1,
   start_date:null, end_date:null, city:'Riyadh', venue:null, organiser:null,
   link:null, opportunity_sales:true, opportunity_partner:false,
   approach:null, approach_status:null, exhibitor_list_url:null, notes:null},
  // The landmine row: hostile text in every field, wrong enum values, booby-trapped links.
  {id:'e6', name_en:'Evil <img src=x onerror=window.__xss=1> "Expo"', name_ar:'<script>window.__xss=2</script>',
   vertical:'Bogus', status:'made_up_status', priority:3,
   start_date:'2026-10-01', end_date:'2026-10-02', city:'Riyadh', venue:'X & Y "Hall" <b>', organiser:null,
   link:'javascript:window.__xss=3', opportunity_sales:true, opportunity_partner:false,
   approach:'weird_value', approach_status:'weird_value', exhibitor_list_url:'javascript:window.__xss=4',
   notes:'<script>window.__xss=5</script> a note with <tags> & "quotes"'},
];
const SIGNUP_ROWS = [
  {event_id:'e3', login_email:'business@directksa.com', login_password:'ev-pass-1', signed_up_by:'Abdulrahman'},
  {event_id:'e6', login_email:'x"><img src=x onerror=window.__xss=6>@x.com', login_password:'p', signed_up_by:'<b>who</b>'},
];
const LEAD_ROWS = [ {ev:'LEAP 2026'}, {ev:'leap 2026 '}, {ev:'LEAP 2026'} ]; // 3 for LEAP after normalising

const stubModule = `
const SEED = ${JSON.stringify(SEED)};
const SIGNUP_ROWS = ${JSON.stringify(SIGNUP_ROWS)};
const LEAD_ROWS = ${JSON.stringify(LEAD_ROWS)};
let session = null;
const listeners = [];
window.__calls = [];
export function createClient(){
  return {
    auth: {
      getSession(){ return Promise.resolve({data:{session}, error:null}); },
      onAuthStateChange(cb){ listeners.push(cb); return {data:{subscription:{unsubscribe(){}}}}; },
      signInWithPassword({email, password}){
        if (!password || password === 'wrong') return Promise.resolve({data:{}, error:{message:'Invalid login credentials'}});
        session = {user:{email}};
        listeners.forEach(cb => cb('SIGNED_IN', session));
        return Promise.resolve({data:{session}, error:null});
      },
      signOut(){ session = null; listeners.forEach(cb => cb('SIGNED_OUT', null)); return Promise.resolve({error:null}); },
    },
    from(table){
      if (table === 'ksa_event_signups') return {
        select(){ return Promise.resolve(session ? {data: SIGNUP_ROWS, error:null} : {data:null, error:{message:'permission denied'}}); },
        upsert(row){ window.__calls.push(['upsert_signup', row.event_id]); return Promise.resolve(session ? {error:null} : {error:{message:'permission denied'}}); },
      };
      if (table === 'businesses') return {
        select(){ return { not(){ return { range(a,b){
          const rows = session ? LEAD_ROWS.slice(a, b+1) : [];
          return Promise.resolve({data: rows, error:null});
        } }; } }; },
      };
      if (table === 'ksa_events_audit') return {
        select(){ return { order(){ return { limit(){ return Promise.resolve({data: [
          {operation:'UPDATE', changed_at:'2026-08-12T10:00:00Z', new_data:{name_en:'Evil <img src=x onerror=window.__xss=7> "Expo"'}},
        ], error:null}); } }; } }; },
      };
      return {
        select(){ return { order(){ return Promise.resolve({data: SEED, error: null}); } }; },
        update(data){ window.__calls.push(['update_event', data.name_en]); return { eq(){ return Promise.resolve({error:null}); } }; },
        insert(data){ window.__calls.push(['insert_event', data.name_en]); return { select(){ return { single(){ return Promise.resolve({data:{id:'new1'}, error:null}); } }; } }; },
        delete(){ return { eq(_c, id){ window.__calls.push(['delete_event', id]); return Promise.resolve({error:null}); } }; },
      };
    },
    channel(){ return { on(){ return this; }, subscribe(){ return this; } }; },
  };
}
`;

const server = createServer((req, res) => {
  res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
  res.end(html);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.route('https://esm.sh/**', route =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: stubModule }));
await page.route('https://fonts.googleapis.com/**', r => r.fulfill({status:200, contentType:'text/css', body:''}));
await page.route('https://fonts.gstatic.com/**', r => r.fulfill({status:200, body:''}));

let failed = 0, passed = 0;
function check(label, actual, expected){
  const ok = actual === expected;
  if (ok) passed++; else failed++;
  console.log((ok?'PASS':'FAIL')+'  '+label+(ok?'':'  → got '+JSON.stringify(actual)+', expected '+JSON.stringify(expected)));
}
const rowCount = () => page.locator('#eventTable tbody tr:not(:has(.empty))').count();
const shot = (name) => page.screenshot({ path: path.join(root, 'scripts', 'qa', `shot-events-${name}.png`), fullPage: true });

await page.goto(url);
await page.waitForSelector('#eventTable tbody tr');

// ---------- HOSTILE TEXT (signed out) ----------
check('hostile: no script ran (__xss stays unset)', await page.evaluate(() => window.__xss === undefined), true);
check('hostile: evil name renders as text', (await page.locator('#eventTable tbody').innerText()).includes('Evil <img'), true);
const badHrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a')).filter(a => a.getAttribute('href')?.startsWith('javascript:')).length);
check('hostile: no javascript: links in the page', badHrefs, 0);
check('hostile: made-up status shows its raw name, not "undefined"', (await page.locator('#eventTable tbody').innerText()).includes('undefined'), false);

// ---------- FILTERS, ONE BY ONE, ON AND OFF ----------
check('start: all rows', await rowCount(), 6);
const setSel = (id, v) => page.selectOption(id, v);
await setSel('#fVertical', 'Travel'); check('vertical=Travel', await rowCount(), 2);
await setSel('#fVertical', ''); check('vertical reset', await rowCount(), 6);
await setSel('#fStatus', 'confirmed'); check('status=confirmed', await rowCount(), 2);
await setSel('#fStatus', ''); check('status reset', await rowCount(), 6);
await setSel('#fMove', 'mine'); check('move=mine', await rowCount(), 1);
await setSel('#fMove', 'undecided'); check('move=undecided catches null AND unknown values', await rowCount(), 2);
await setSel('#fMove', ''); check('move reset', await rowCount(), 6);
await setSel('#fOpp', 'sales'); check('opportunity=sales', await rowCount(), 4);
await setSel('#fOpp', 'partner'); check('opportunity=partner', await rowCount(), 3);
await setSel('#fOpp', ''); check('opportunity reset', await rowCount(), 6);
await setSel('#fCity', 'Dubai'); check('city=Dubai', await rowCount(), 1);
await setSel('#fCity', ''); check('city reset', await rowCount(), 6);
await setSel('#fVenue', 'RICEC'); check('venue=RICEC', await rowCount(), 1);
await setSel('#fVenue', ''); check('venue reset', await rowCount(), 6);
await setSel('#fPriority', 'high'); check('priority high (4-5)', await rowCount(), 1);
await setSel('#fPriority', 'medium'); check('priority medium (3)', await rowCount(), 2);
await setSel('#fPriority', 'low'); check('priority low (1-2)', await rowCount(), 3);
await setSel('#fPriority', ''); check('priority reset', await rowCount(), 6);
await page.fill('#fSearch', 'dubai'); check('search "dubai"', await rowCount(), 1);
await page.fill('#fSearch', 'ليب'); check('search Arabic name', await rowCount(), 1);
await page.fill('#fSearch', ''); check('search cleared', await rowCount(), 6);

// The one-tap chip for the few events we take part in
await page.click('#btnOurs'); check('"We take part" chip → stand+attend only', await rowCount(), 2);
check('"We take part" chip is highlighted', await page.locator('#btnOurs.active').count(), 1);
await page.click('#btnOurs'); check('"We take part" chip off', await rowCount(), 6);

// Combined filters, then unwind in a different order
await setSel('#fVertical', 'Tech'); await setSel('#fStatus', 'confirmed'); await setSel('#fPriority', 'high');
check('combined Tech+confirmed+high', await rowCount(), 1);
await setSel('#fStatus', ''); check('unwind status first', await rowCount(), 1);
await setSel('#fPriority', ''); check('unwind priority', await rowCount(), 2);
await setSel('#fVertical', ''); check('unwind vertical → all back', await rowCount(), 6);

// ---------- SORTING: every column, both directions ----------
for (const key of ['priority','date','name','move','vertical','status','city','venue']){
  await page.click(`th[data-sort="${key}"]`);
  const asc = await page.locator('#eventTable tbody .name').allInnerTexts();
  await page.click(`th[data-sort="${key}"]`);
  const desc = await page.locator('#eventTable tbody .name').allInnerTexts();
  check(`sort ${key}: both directions render all rows`, asc.length === 6 && desc.length === 6, true);
  check(`sort ${key}: direction actually flips`, asc.join()!==desc.join() || key==='', true);
}
await page.click('th[data-sort="date"]');
check('sort date asc: first is earliest', (await page.locator('#eventTable tbody .name').first().innerText()).includes('LEAP'), true);

// ---------- SIGNED-OUT GUARDS ----------
check('signed out: no login lines', await page.locator('#eventTable tbody td:has-text("🔑")').count(), 0);
check('signed out: no lead counts', await page.locator('#eventTable tbody :text("leads in the app")').count(), 0);
await page.locator('[data-edit="e3"]').click();
check('signed out modal: lock note shown', await page.locator('#signupLocked').isVisible(), true);
check('signed out modal: login fields hidden', await page.locator('#signupBox').isVisible(), false);
await page.locator('#modalCancel').click();
await page.locator('[data-del="e4"]').click();
check('signed out delete → sign-in dialog', await page.locator('#authOverlay.open').count(), 1);

// ---------- SIGN IN (wrong then right) ----------
await page.fill('#auth_email', 'test@directksa.com');
await page.fill('#auth_password', 'wrong');
await page.locator('#authSubmit').click();
check('wrong password: stays signed out', await page.locator('#whoAmI').innerText(), '');
await page.fill('#auth_password', 'right');
await page.locator('#authSubmit').click();
await page.waitForFunction(() => document.getElementById('whoAmI').textContent.includes('@'));
check('signed in: email in header', await page.locator('#whoAmI').innerText(), 'test@directksa.com');
await page.waitForSelector('#eventTable tbody td:has-text("🔑")');

// ---------- SIGNED-IN VIEW ----------
check('signed in: login lines appear', await page.locator('#eventTable tbody td:has-text("🔑")').count(), 2);
check('hostile signup email renders as text, no script', await page.evaluate(() => window.__xss === undefined), true);
check('LEAP shows 3 leads (paged query, normalised match)',
  (await page.locator('#eventTable tbody tr', {hasText:'LEAP 2026'}).innerText()).includes('3 leads in the app'), true);

// Edit round-trip on every single row (open, check no crash, cancel)
for (const e of SEED){
  await page.locator(`[data-edit="${e.id}"]`).click();
  await page.locator('#modalCancel').click();
}
check('edit modal opened+closed on all 6 rows without errors', errors.length, 0);

// Edit + save with login
await page.locator('[data-edit="e3"]').click();
check('login fields visible when signed in', await page.locator('#signupBox').isVisible(), true);
check('login email loaded', await page.locator('#fld_su_email').inputValue(), 'business@directksa.com');
await page.fill('#fld_su_password', 'ev-pass-2');
await page.locator('#modalSave').click();
await page.waitForFunction(() => !document.getElementById('modalOverlay').classList.contains('open'));
let calls = await page.evaluate(() => window.__calls);
check('save: event update sent', calls.some(c => c[0]==='update_event'), true);
check('save: login upsert sent for the right event', calls.some(c => c[0]==='upsert_signup' && c[1]==='e3'), true);

// Add a brand-new event end to end
await page.locator('#btnAdd').click();
check('add modal: move defaults to Not decided', await page.locator('#fld_move').inputValue(), 'undecided');
await page.fill('#fld_n', 'Test Expo 2027');
await page.selectOption('#fld_move', 'stand');
await page.fill('#fld_su_email', 'signup@directksa.com');
await page.locator('#modalSave').click();
await page.waitForFunction(() => !document.getElementById('modalOverlay').classList.contains('open'));
calls = await page.evaluate(() => window.__calls);
check('add: insert sent', calls.some(c => c[0]==='insert_event' && c[1]==='Test Expo 2027'), true);
check('add: login saved against the NEW event id', calls.some(c => c[0]==='upsert_signup' && c[1]==='new1'), true);

// Bad links are refused before saving
await page.locator('[data-edit="e1"]').click();
await page.fill('#fld_list_url', 'not-a-link');
page.once('dialog', d => d.accept());
await page.locator('#modalSave').click();
check('bad companies-list link is refused', await page.locator('#modalOverlay.open').count(), 1);
await page.fill('#fld_list_url', '');
await page.locator('#modalCancel').click();

// Delete with confirm dialog
page.once('dialog', d => d.accept());
await page.locator('[data-del="e4"]').click();
await page.waitForFunction(() => (window.__calls||[]).some(c => c[0]==='delete_event'));
check('delete: confirmed dialog sends the delete', true, true);

// History renders hostile audit text safely
await page.locator('#btnHistory').click();
await page.waitForSelector('#historyList div');
check('history: hostile name is text, no script', await page.evaluate(() => window.__xss === undefined), true);
await page.locator('#historyClose').click();

// Exports do not throw
await page.locator('#btnExportCsv').click();
await page.locator('#btnExportJson').click();

// Sign out returns to the public view
await page.locator('#btnAuth').click();
await page.waitForFunction(() => document.getElementById('whoAmI').textContent === '');
check('signed out again: login lines gone', await page.locator('#eventTable tbody td:has-text("🔑")').count(), 0);

await shot('heavy-final');
await page.setViewportSize({ width: 390, height: 844 });
await shot('mobile');

console.log('---');
console.log(passed+' passed, '+failed+' failed');
if (errors.length){ console.log('JS ERRORS:\n'+errors.join('\n')); }
else console.log('0 JavaScript errors');
await browser.close();
server.close();
process.exit(failed || errors.length ? 1 : 0);
