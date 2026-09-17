/* probe-arabic-dates-gregorian.mjs — guards the 2026-09-17 (fire #79) fix in js/76 and js/77.
   Both formatted their dates with the locale 'ar-SA', and that locale does not merely translate the month
   name — it switches the CALENDAR. In Chromium, 14 March 2026 comes out of 'ar-SA' as "٢٥ رمضان ١٤٤٧ هـ":
   the Hijri date, in Arabic-Indic digits. Every other Arabic date in the app uses 'ar' and stays Gregorian
   (the audit log, the Events tab), so the Archive list and the Share-links panel were the two places
   showing a different calendar for the same moment — a company archived on 14 March read as 25 Ramadan
   1447 in the Archive and as 14 مارس 2026 in Activity & Audit, with nothing to say they were the same day.
   Both now use 'ar'. This probe seeds one archived company and one share link, both stamped with that same
   fixed moment, and reads what each screen prints in Arabic and in English.
   Sabotage-tested: with both edits stashed, 4 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-arabic-dates-gregorian.mjs                                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9059;
const ISO = '2026-03-14T09:05:00Z';           /* Gregorian 14 Mar 2026 · Hijri 25 Ramadan 1447 */
const mk = (i, archived) => ({ id: 'b' + i, legacy_id: 'L' + i, name: 'Test Company ' + i, name_ar: 'شركة تجريبية ' + i, source: 'Import',
  stage: 'new', status: 'active', category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'A', entity_type: 'LLC', legal_name: 'Test Company ' + i + ' LLC', cr_vat: '3001234567' + i, payment_terms: 'Net 30', credit_limit: 50000,
  contract_start: '2026-01-01', contract_end: '2026-12-31', contract_scope: 'Air + Hotel', contract_sla: '24h', next_review: '2026-09-01',
  total_sar: 12000, website: 'https://example.com', corp_email_flag: 'yes', is_client: false, converted_date: null, direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: 'Seed row', created_at: '2026-06-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z',
  raw: {}, verification_source: 'manual', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null,
  scrub_run_id: null, funnel_id: null, funnel_details: {}, stage_legacy: null, next_action_date: '2026-08-20', next_action_note: 'Follow up',
  lost_reason: null, archived_at: archived ? ISO : null, archived_by: archived ? 'merged-into:b0' : null });
const srv = start(PORT, {
  businesses: [mk(0, false), mk(1, true), mk(2, false)],
  share_links: [{ token: 'qaqaqaqaqaqaqaqaqaqaqaqa', scope: 'today', active: true, created_by: 'test@directksa.com', created_at: ISO, last_used_at: null }],
});
const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/archive', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(2500);
const readArchive = async () => { await p.evaluate(() => { current = 'archive'; openLead = null; render(); }); for (let i = 0; i < 30; i++) { await p.waitForTimeout(500); const t = await p.evaluate(() => (document.getElementById('view').innerText || '')); if (/2026|1447|١٤٤٧/.test(t)) return t.replace(/\s+/g, ' ').trim(); } return (await p.evaluate(() => (document.getElementById('view').innerText || ''))).replace(/\s+/g, ' ').trim(); };
const readShare = async () => { await p.evaluate(() => { current = 'settings'; render(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const b = document.getElementById('cl_share'); if (b) b.click(); }); await p.waitForTimeout(2500);
  return p.evaluate(() => { const els = [...document.querySelectorAll('div')].filter((x) => x.offsetParent !== null && /share|مشارك/i.test(x.innerText || '') && (x.innerText || '').length > 60 && (x.innerText || '').length < 2000); const t = els[els.length - 1]; return t ? t.innerText.replace(/\s+/g, ' ') : ''; }); };
const arArchive = await (async () => { await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(900); return readArchive(); })();
const arShare = await readShare();
await p.evaluate(() => { const x = document.querySelector('#v77close, [onclick*="close"]'); if (x) x.click(); }).catch(() => { });
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); }); await p.waitForTimeout(900);
const enArchive = await readArchive();
await b.close(); srv.close?.();
const HIJRI = (s) => /هـ|١٤٤٧|\b1447\b|رمضان/.test(s || '');
const ARABIC_INDIC = (s) => /[٠-٩]{2,}/.test(s || '');
const checks = [
  ['the Archive prints the Gregorian date in Arabic (14 مارس 2026), not the Hijri one', /مارس/.test(arArchive) && /2026/.test(arArchive)],
  ['the Archive shows no Hijri date and no Arabic-Indic digits', !HIJRI(arArchive) && !ARABIC_INDIC(arArchive)],
  ['the Share-links panel prints the Gregorian date in Arabic', /مارس/.test(arShare) && /2026/.test(arShare)],
  ['the Share-links panel shows no Hijri date and no Arabic-Indic digits', arShare.length > 40 && !HIJRI(arShare) && !ARABIC_INDIC(arShare)],
  ['English is unchanged — the Archive still reads "14 Mar 2026"', /14 Mar 2026/.test(enArchive)],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ arArchive: arArchive.slice(0, 220), arShare: arShare.slice(0, 220), enArchive: enArchive.slice(0, 160) })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
