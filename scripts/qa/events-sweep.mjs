// Drives events/index.html in a headless browser with a stubbed Supabase module,
// so the KSA Events Hub can be exercised without touching production data.
// Covers both the signed-out (public) and signed-in (team) views.
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
];
const SIGNUP_ROWS = [
  {event_id:'e3', login_email:'business@directksa.com', login_password:'ev-pass-1', signed_up_by:'Abdulrahman'},
];
const LEAD_ROWS = [ {ev:'LEAP 2026'}, {ev:'leap 2026 '}, {ev:'LEAP 2026'} ]; // 3 for LEAP after normalising

// A stand-in for the supabase-js module: enough of the query/auth/realtime surface for this page.
const stubModule = `
const SEED = ${JSON.stringify(SEED)};
const SIGNUP_ROWS = ${JSON.stringify(SIGNUP_ROWS)};
const LEAD_ROWS = ${JSON.stringify(LEAD_ROWS)};
let session = null;
const listeners = [];
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
        upsert(){ return Promise.resolve(session ? {error:null} : {error:{message:'permission denied'}}); },
      };
      if (table === 'businesses') return {
        select(){ return { not(){ return Promise.resolve(session ? {data: LEAD_ROWS, error:null} : {data:[], error:null}); } }; },
      };
      return {
        select(){ return { order(){ return Promise.resolve({data: SEED, error: null}); } }; },
        update(){ return { eq(){ return Promise.resolve({error:null}); } }; },
        insert(){ return { select(){ return { single(){ return Promise.resolve({data:{id:'new1'}, error:null}); } }; } }; },
        delete(){ return { eq(){ return Promise.resolve({error:null}); } }; },
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

await page.goto(url);
await page.waitForSelector('#eventTable tbody tr');

const shot = (name) => page.screenshot({ path: path.join(root, 'scripts', 'qa', `shot-events-${name}.png`), fullPage: true });

// ---- SIGNED OUT (the public view) ----
let rows = await page.locator('#eventTable tbody tr').count();
console.log('rows rendered:', rows, '(expect 5)');
console.log('stats bar:', (await page.locator('#statsBar').innerText()).replace(/\n/g, ' | '));
let keys = await page.locator('#eventTable tbody td:has-text("🔑")').count();
console.log('signed out → login lines visible:', keys, '(expect 0)');
let leadsChip = await page.locator('#eventTable tbody :text("leads in the app")').count();
console.log('signed out → lead counts visible:', leadsChip, '(expect 0)');

await page.locator('[data-edit="e3"]').click();
const lockedVisible = await page.locator('#signupLocked').isVisible();
const boxVisible = await page.locator('#signupBox').isVisible();
console.log('signed out modal → lock note:', lockedVisible, '(expect true) login fields:', boxVisible, '(expect false)');
await shot('signedout-modal');
await page.locator('#modalCancel').click();

await page.locator('[data-del="e4"]').click();
const authOpened = await page.locator('#authOverlay.open').count();
console.log('signed out delete → sign-in dialog opens:', authOpened, '(expect 1)');

// ---- SIGN IN ----
await page.fill('#auth_email', 'test@directksa.com');
await page.fill('#auth_password', 'wrong');
await page.locator('#authSubmit').click();
console.log('wrong password stays signed out →', JSON.stringify(await page.locator('#whoAmI').innerText()), '(expect "")');
await page.fill('#auth_password', 'right');
await page.locator('#authSubmit').click();
await page.waitForFunction(() => document.getElementById('whoAmI').textContent.includes('@'));
console.log('signed in as:', await page.locator('#whoAmI').innerText());
await page.waitForSelector('#eventTable tbody td:has-text("🔑")');

// ---- SIGNED IN (the team view) ----
keys = await page.locator('#eventTable tbody td:has-text("🔑")').count();
console.log('signed in → login lines visible:', keys, '(expect 1)');
const leapCell = await page.locator('#eventTable tbody tr', {hasText:'LEAP 2026'}).innerText();
console.log('LEAP row shows lead count:', leapCell.includes('3 leads in the app'), '(expect true)');
await shot('signedin-all');

await page.locator('[data-edit="e3"]').click();
console.log('signed in modal → lock note:', await page.locator('#signupLocked').isVisible(), '(expect false) login fields:', await page.locator('#signupBox').isVisible(), '(expect true)');
console.log('login fields → email:', await page.locator('#fld_su_email').inputValue(),
  'password:', await page.locator('#fld_su_password').inputValue(),
  'by:', await page.locator('#fld_su_by').inputValue());
await shot('signedin-modal');
await page.locator('#modalCancel').click();

// Save round-trip with signup upsert (edit ATM, add a note to password)
await page.locator('[data-edit="e3"]').click();
await page.fill('#fld_su_password', 'ev-pass-2');
await page.locator('#modalSave').click();
await page.waitForFunction(() => !document.getElementById('modalOverlay').classList.contains('open'));
console.log('save with login round-trip: modal closed, no errors so far:', errors.length === 0);

// Sign out returns to public view
await page.locator('#btnAuth').click();
await page.waitForFunction(() => !document.querySelector('#eventTable tbody td')?.textContent?.includes('🔑') || true);
keys = await page.locator('#eventTable tbody td:has-text("🔑")').count();
console.log('signed out again → login lines visible:', keys, '(expect 0)');

// Mobile layout, signed out
await page.setViewportSize({ width: 390, height: 844 });
await shot('mobile');

console.log(errors.length ? 'JS ERRORS:\n' + errors.join('\n') : '0 JavaScript errors');
await browser.close();
server.close();
