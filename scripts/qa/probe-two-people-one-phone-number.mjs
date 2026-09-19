/* probe-two-people-one-phone-number.mjs — guards the 2026-09-19 (fire #109) fix in js/72.

   js/72 brings the `contacts` TABLE onto each company card alongside the people stored in the
   company record, and it has to decide whether a row it is about to add is already there. It asked
   that question by matching the EMAIL **or** the PHONE, on their own — and answered "already there"
   for two different people who share either one.

   Measured against the live database: one company has FOUR people recorded and its card showed
   TWO. Of the two it swallowed, one shares a mailbox with a colleague and one shares a phone
   number — different names in both cases. Neither is an accident or bad data: a switchboard number
   and an info@ address are exactly what a company's contact list looks like. Their name, role,
   email and phone were simply absent from the app, so whoever went to call that person had no way
   to know they existed. The master brief's rule is explicit — a mismatch is flagged, never
   silently merged.

   A shared line is now evidence of the same person only when the NAME agrees too, or when one side
   has no name to compare — which is the case the de-duplication was written for: the same person
   stored once in the company record and once in the contacts table. Driven against the real
   database after the fix, the app holds all 45 contacts and every one of the 36 companies matches
   the database exactly.

   This probe serves its own contact rows through its own route, so the shared mock is untouched
   and the case is exact. Everything in it is invented.

   It also holds the other case the live data has: one NAME on two rows with a different email AND
   a different phone on each. That may be one person whose details changed or two namesakes; the app
   cannot tell, so both are kept and the person decides. Asserted so it stays a decision.

   Sabotage-tested 2026-09-19: with the name guard removed, 5 checks go FAIL, exit 1, and the
   detail is the defect itself — the card drops to two people, "Amal Al-Rashid, Dalia Noor",
   having swallowed the colleague on the shared mailbox and the colleague on the shared
   switchboard.
   Run: node scripts/qa/probe-two-people-one-phone-number.mjs                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9084; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

/* one shared mailbox, one shared switchboard, and the same person stored twice */
const MAIL = 'desk@qa-example.test', PHONE = '+966 11 555 0000';
let ROWS = null;   /* set once the target company is known; the route below reads it */

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    /* the contacts table is this probe's own, so the case is exactly the one being guarded */
    if (m === 'GET' && /\/rest\/v1\/contacts\b/.test(u.pathname) && ROWS) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0 && typeof window.v72Apply === 'function', { timeout: 120000 });
  await p.waitForTimeout(3000);

  /* the company this is about, and the one person its own record already knows */
  const target = await p.evaluate((mail) => {
    const b0 = (DB.businesses || [])[0];
    const uuid = (window.__ROWID && window.__ROWID[b0.id]) || b0.id;
    b0.contacts = [{ name: 'Amal Al-Rashid', role: 'Reception', email: mail, phone: '+966 11 555 0000' }];
    return { id: b0.id, uuid: uuid };
  }, MAIL);

  ROWS = [
    /* the same person as the record's, arriving from the table — must not appear twice */
    { id: 'qa_c1', business_id: target.uuid, name: 'Amal Al-Rashid', role: 'Reception', email: MAIL, phone: PHONE, needs_manual_confirmation: false, confirmation_reason: null },
    /* a colleague on the SAME mailbox — a different person, must appear */
    { id: 'qa_c2', business_id: target.uuid, name: 'Bandar Al-Otaibi', role: 'Procurement', email: MAIL, phone: '+966 50 111 2222', needs_manual_confirmation: false, confirmation_reason: null },
    /* a colleague on the SAME switchboard — a different person, must appear */
    { id: 'qa_c3', business_id: target.uuid, name: 'Christine Haddad', role: 'Finance', email: 'c.haddad@qa-example.test', phone: PHONE, needs_manual_confirmation: false, confirmation_reason: null },
    /* someone sharing nothing at all — must appear */
    { id: 'qa_c4', business_id: target.uuid, name: 'Dalia Noor', role: 'Travel desk', email: 'd.noor@qa-example.test', phone: '+966 55 333 4444', needs_manual_confirmation: false, confirmation_reason: null },
    /* a nameless row on the record's own line — nothing to tell apart, so still one person */
    { id: 'qa_c5', business_id: target.uuid, name: '', role: '', email: MAIL, phone: PHONE, needs_manual_confirmation: false, confirmation_reason: null },
  ];

  await p.evaluate(() => { try { window.v72Apply(function () { }); } catch (_) { } });
  await p.waitForTimeout(3500);

  const got = await p.evaluate((id) => {
    const b0 = (DB.businesses || []).find((x) => x.id === id) || {};
    const names = (b0.contacts || []).map((c) => String(c.name || '').trim());
    return { count: (b0.contacts || []).length, names: names,
      amal: names.filter((n) => n === 'Amal Al-Rashid').length };
  }, target.id);

  await p.evaluate((id) => { current = 'leads'; openLead = id; render(); }, target.id);
  await p.waitForTimeout(2500);
  const onScreen = await p.evaluate(() => {
    const t = (document.getElementById('view') || {}).innerText || '';
    return ['Amal Al-Rashid', 'Bandar Al-Otaibi', 'Christine Haddad', 'Dalia Noor'].filter((n) => t.indexOf(n) >= 0);
  });

  /* The live database holds this case twice: one NAME recorded on two rows with a different email
     AND a different phone on each. It may be one person whose details changed, or two namesakes —
     the app cannot tell, and the master brief says a mismatch is flagged, never silently merged.
     So both are kept and the person decides. Asserted here so it stays a decision rather than an
     accident: the alternative, picking one, is what threw a working phone number away. */
  ROWS = ROWS.concat([{ id: 'qa_c6', business_id: target.uuid, name: 'Amal Al-Rashid', role: 'Reception',
    email: 'a.rashid.new@qa-example.test', phone: '+966 55 999 8888', needs_manual_confirmation: false, confirmation_reason: null }]);
  await p.evaluate(() => { try { window.v72Apply(function () { }); } catch (_) { } });
  await p.waitForTimeout(3000);
  const twice = await p.evaluate((id) => {
    const b0 = (DB.businesses || []).find((x) => x.id === id) || {};
    const names = (b0.contacts || []).map((c) => String(c.name || '').trim());
    return { count: names.length, amal: names.filter((n) => n === 'Amal Al-Rashid').length };
  }, target.id);

  await ctx.close();
  return { got, onScreen, twice };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  EN card holds', JSON.stringify(en.got), '· on screen', JSON.stringify(en.onScreen));
console.log('  AR card holds', JSON.stringify(ar.got), '· on screen', JSON.stringify(ar.onScreen));

const checks = [
  ['the company card really rebuilt from the table, so nothing below passes by accident',
    en.got.count > 0 && ar.got.count > 0],
  ['the colleague who shares a mailbox with someone else is on the card',
    en.got.names.includes('Bandar Al-Otaibi') && ar.got.names.includes('Bandar Al-Otaibi')],
  ['the colleague who shares the switchboard number is on the card',
    en.got.names.includes('Christine Haddad') && ar.got.names.includes('Christine Haddad')],
  ['so is the one who shares nothing', en.got.names.includes('Dalia Noor')],
  ['the person stored in BOTH places is still shown once, not twice',
    en.got.amal === 1 && ar.got.amal === 1, 'times shown: EN ' + en.got.amal + ' · AR ' + ar.got.amal],
  ['and a nameless row on that same line is still treated as that same person — four people, not five',
    en.got.count === 4 && ar.got.count === 4, 'EN ' + en.got.count + ' · AR ' + ar.got.count],
  ['all four are readable on the card itself, in both languages',
    en.onScreen.length === 4 && ar.onScreen.length === 4, JSON.stringify({ en: en.onScreen.length, ar: ar.onScreen.length })],
  ['the same name recorded twice with different details keeps both, rather than throwing one away',
    en.twice.count === 5 && en.twice.amal === 2 && ar.twice.count === 5,
    JSON.stringify({ en: en.twice, ar: ar.twice })],
  ['reading the card wrote nothing', wrote.filter((w) => !/finance_client_links|contacts/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
