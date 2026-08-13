/* Round-9 probe: ownership linked to real users (aliases + Mine filters), topbar
   profile chip (Team/Access/Sign out inside), Expenses tab end-to-end. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8974, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
let errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
page.on('dialog', d => d.accept('QA'));
const route = async r => {
  const u = r.request().url();
  if (u.includes('cdn.jsdelivr.net')) {
    if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  }
  const url = new URL(u);
  const resp = await fetch(BASE + url.pathname + url.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postData() || undefined });
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {}; resp.headers.forEach((v, k) => headers[k] = v);
  return r.fulfill({ status: resp.status, headers, body });
};
await page.route('**cdn.jsdelivr.net/**', route);
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);
const LOG = []; const STEP = (n, ok, d = '') => LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`);
const shot = p => page.screenshot({ path: 'shots/r9-' + p + '.png' }).catch(() => {});

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button:has-text("Sign in")').first().click();
await page.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0, null, { timeout: 40000 });
await page.waitForTimeout(3500);

// ---- 1) alias engine
await page.waitForFunction(() => typeof ownerCanon === 'function', null, { timeout: 15000 });
await page.waitForFunction(() => { try { return ownerCanon('Assem') !== 'Assem'; } catch (_) { return false; } }, null, { timeout: 15000 }).catch(() => {});
const alias = await page.evaluate(() => ({
  nick: sameOwner('Assem', 'Assem Alsweed'),
  arabic: sameOwner('عاصم السويد', 'Assem Alsweed'),
  spelling: sameOwner('Abdelrahman Hasan', 'Abdulrahman Hasan'),
  negative: !sameOwner('Assem Alsweed', 'Raad Awad'),
  blankSafe: !sameOwner('', 'Assem Alsweed')
}));
STEP('aliases: nickname ↔ full name are the same person', alias.nick);
STEP('aliases: Arabic name ↔ English name are the same person', alias.arabic);
STEP('aliases: Abdel/Abdul spelling variants match', alias.spelling);
STEP('aliases: two different people never match; blank never matches', alias.negative && alias.blankSafe);

// ---- 2) identity comes from the signed-in email
const ident = await page.evaluate(() => ({ me: (window.meName ? meName() : ''), user: window.__userName || '' }));
STEP('signed-in identity resolves to the roster name (no invented default)', !!ident.me && ident.me !== 'Abdelrahman' && ident.me === ident.user, JSON.stringify(ident));

// ---- 3) Mine filter on Leads matches nickname-owned records
const mineLeads = await page.evaluate(() => {
  const me = meName();
  const nick = me.split(' ')[0];                         // stored as the short form on records
  const L = DB.businesses.filter(b => !b.isClient);
  L.forEach(b => b.assignedTo = 'Somebody Else');
  L[0].assignedTo = nick; L[1].assignedTo = me;
  leadFilter.mine = true; leadFilter.stage = 'all'; leadFilter.q = '';
  const got = (typeof leadTableList === 'function') ? leadTableList().length : -1;
  leadFilter.mine = false;
  return { got, expected: 2 };
});
STEP('Leads "Mine": records owned under my SHORT name still count as mine', mineLeads.got === mineLeads.expected, JSON.stringify(mineLeads));

// ---- 4) Mine filter on Clients matches Arabic-owned records
const mineClients = await page.evaluate(() => {
  const me = 'Assem Alsweed';                            // mock roster row that has an Arabic name
  DB.businesses.filter(b => b.isClient).forEach(b => b.accountManager = 'Somebody Else');
  const c = DB.businesses.filter(b => b.isClient);
  c[0].accountManager = 'عاصم السويد';
  clFilter.owner = me;
  const kept = DB.businesses.filter(b => b.isClient).filter(b => window.sameOwner ? sameOwner(b.accountManager || b.assignedTo, clFilter.owner) : false).length;
  clFilter.owner = 'all';
  return kept;
});
STEP('Clients "Mine": a client managed under the Arabic name counts as mine', mineClients === 1, 'kept=' + mineClients);

// ---- 5) topbar: chip at the end, loose buttons tucked away
await page.evaluate(() => { current = 'today'; render(); });
await page.waitForTimeout(2200);
const bar = await page.evaluate(() => {
  const tools = document.querySelector('.tools'); if (!tools) return null;
  const visible = [...tools.querySelectorAll('button')].filter(b => b.style.display !== 'none' && b.offsetParent !== null).map(b => b.textContent.trim().slice(0, 18));
  const chip = document.getElementById('v68me');
  return { visible, chipLast: chip && tools.lastElementChild === chip, chipText: chip ? chip.textContent : '' };
});
STEP('topbar: profile chip sits at the END of the bar', !!bar && bar.chipLast, JSON.stringify(bar && bar.visible));
STEP('topbar: no loose Sign out / Team / Access buttons on the bar', !!bar && !bar.visible.some(t => /^(Sign out|Team|Access|تسجيل الخروج|الفريق|الصلاحيات)$/.test(t)));
await shot('topbar');
await page.locator('#v68me').click();
await page.waitForTimeout(500);
const menu = await page.evaluate(() => { const m = document.getElementById('v68menu'); return m ? m.textContent : null; });
STEP('chip menu opens with Team, Access and Sign out', !!menu && /Team/.test(menu) && /access/i.test(menu) && /Sign out/.test(menu), String(menu).slice(0, 80));
await shot('chip-menu');
await page.keyboard.press('Escape').catch(() => {});
await page.evaluate(() => { const m = document.getElementById('v68menu'); if (m) m.remove(); });

// ---- 6) Expenses tab end-to-end
await page.evaluate(() => { current = 'finance'; FIN.tab = 'overview'; render(); });
await page.waitForFunction(() => window.FIN && FIN.rows && FIN.rows.length > 0, null, { timeout: 20000 });
await page.waitForTimeout(1000);
const tabBtn = await page.evaluate(() => !![...document.querySelectorAll('#view button')].find(b => /finGo\('expenses'\)/.test(b.getAttribute('onclick') || '')));
STEP('Finance shows an Expenses tab', tabBtn);
await page.evaluate(() => { finGo('expenses'); });
await page.waitForTimeout(1800);
await shot('expenses-empty');
const formOK = await page.evaluate(() => !!document.getElementById('xp_date') && !!document.getElementById('xp_via') && !!document.getElementById('xp_amt'));
STEP('Expenses: add form renders (date, amount, paid-via…)', formOK);
const noVat = await page.evaluate(() => !/VAT|ضريبة القيمة/.test(document.getElementById('view').textContent));
STEP('Expenses: no VAT wording anywhere', noVat);
// add one credit-card expense
await page.evaluate(() => {
  document.getElementById('xp_desc').value = 'Amadeus subscription — August';
  document.getElementById('xp_amt').value = '2300';
  document.getElementById('xp_via').value = 'credit_card';
  document.getElementById('xp_cat').value = 'Software & subscriptions';
  document.getElementById('xp_sup').value = 'Amadeus';
  expSave();
});
await page.waitForTimeout(1800);
const afterAdd = await page.evaluate(() => {
  const t = document.getElementById('view').textContent;
  return { row: /Amadeus subscription/.test(t), via: /Credit card/.test(t), total: /2,300/.test(t) };
});
STEP('Expenses: a credit-card expense saves and appears with its total', afterAdd.row && afterAdd.via && afterAdd.total, JSON.stringify(afterAdd));
await shot('expenses-added');
// bank transfer expense + totals split by method
await page.evaluate(() => {
  document.getElementById('xp_desc').value = 'Hotel block deposit — supplier';
  document.getElementById('xp_amt').value = '15000';
  document.getElementById('xp_via').value = 'bank_transfer';
  document.getElementById('xp_cat').value = 'Supplier payment';
  document.getElementById('xp_sup').value = 'Makkah Hotels Co';
  expSave();
});
await page.waitForTimeout(1800);
const split = await page.evaluate(() => {
  const t = document.getElementById('view').textContent.replace(/\s+/g, ' ');
  return { both: /17,300/.test(t), bank: /Bank transfer/.test(t) && /15,000/.test(t) };
});
STEP('Expenses: totals split by payment method (bank vs card)', split.both && split.bank, JSON.stringify(split));
STEP('Expenses: CSV export is one click', await page.evaluate(() => typeof expCSV === 'function' && !![...document.querySelectorAll('#view button')].find(b => /Export CSV/.test(b.textContent))));
// revenue screens untouched by expenses
const rev = await page.evaluate(() => { FIN.tab = 'overview'; render(); return new Promise(res => setTimeout(() => { const t = document.getElementById('view').textContent; res({ noExp: !/Amadeus subscription/.test(t) }); }, 900)); });
STEP('Expenses NEVER leak into the revenue overview', rev.noExp);
// delete (soft) works
await page.evaluate(() => { finGo('expenses'); });
await page.waitForTimeout(1200);
const delOK = await page.evaluate(() => new Promise(res => {
  const before = (EXPX.rows || []).length;
  const r = (EXPX.rows || []).find(x => /Amadeus/.test(x.description));
  if (!r) return res({ before, after: -1 });
  expDel(r.id);
  setTimeout(() => res({ before, after: (EXPX.rows || []).length }), 1600);
}));
STEP('Expenses: remove hides the expense (kept in history)', delOK.after === delOK.before - 1, JSON.stringify(delOK));

// ---- 7) Arabic pass on the new pieces
await page.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); render(); });
await page.waitForTimeout(1500);
const arTxt = await page.evaluate(() => document.getElementById('view').textContent);
STEP('Expenses in Arabic: title + payment methods translated', /المصروفات/.test(arTxt) && /تحويل بنكي/.test(arTxt));
await shot('expenses-ar');
await page.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); render(); });

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length); errs.slice(0, 8).forEach(e => console.log('  ', e));
await browser.close(); process.exit(0);
