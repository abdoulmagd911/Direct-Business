// Drives events/index.html in a headless browser with a stubbed Supabase module,
// so the KSA Events Hub can be exercised without touching production data.
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

// A stand-in for the supabase-js module: enough of the query/realtime surface for this page.
const stubModule = `
const SEED = ${JSON.stringify(SEED)};
export function createClient(){
  return {
    from(){ return {
      select(){ return { order(){ return Promise.resolve({data: SEED, error: null}); } }; },
      update(){ return { eq(){ return Promise.resolve({error:null}); } }; },
      insert(){ return Promise.resolve({error:null}); },
      delete(){ return { eq(){ return Promise.resolve({error:null}); } }; },
    }; },
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

// 1. Full table with every move represented
let rows = await page.locator('#eventTable tbody tr').count();
console.log('rows rendered:', rows, '(expect 5)');
const statsText = await page.locator('#statsBar').innerText();
console.log('stats bar:', statsText.replace(/\n/g, ' | '));
await shot('all');

// 2. Filter: mine only
await page.selectOption('#fMove', 'mine');
rows = await page.locator('#eventTable tbody tr').count();
const firstName = await page.locator('#eventTable tbody .name').first().innerText();
console.log('filter mine → rows:', rows, '(expect 1) first:', firstName);
const hasListLink = await page.locator('#eventTable tbody a:has-text("Companies list")').count();
console.log('companies-list link visible:', hasListLink, '(expect 1)');
await shot('filter-mine');

// 3. Filter: not decided catches the null-column row
await page.selectOption('#fMove', 'undecided');
rows = await page.locator('#eventTable tbody tr').count();
console.log('filter undecided → rows:', rows, '(expect 1)');

// 4. Edit modal shows the new fields with current values
await page.selectOption('#fMove', '');
await page.locator('[data-edit="e3"]').click();
const mv = await page.locator('#fld_move').inputValue();
const pg = await page.locator('#fld_move_status').inputValue();
const lu = await page.locator('#fld_list_url').inputValue();
console.log('edit ATM → move:', mv, '(expect mine) progress:', pg, '(expect leads_added) list:', lu);
await shot('modal');
await page.locator('#modalCancel').click();

// 5. Add modal defaults
await page.locator('#btnAdd').click();
const mvNew = await page.locator('#fld_move').inputValue();
const pgNew = await page.locator('#fld_move_status').inputValue();
console.log('add modal defaults → move:', mvNew, '(expect undecided) progress:', pgNew, '(expect not_started)');
await page.locator('#modalCancel').click();

// 6. Sort by move column
await page.locator('th[data-sort="move"]').click();
const order = await page.locator('#eventTable tbody .name').allInnerTexts();
console.log('sorted by move:', order.join(' → '));

// 7. Mobile layout
await page.setViewportSize({ width: 390, height: 844 });
await shot('mobile');

console.log(errors.length ? 'JS ERRORS:\n' + errors.join('\n') : '0 JavaScript errors');
await browser.close();
server.close();
