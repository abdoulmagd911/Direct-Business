/* probe-one-company-or-two.mjs — when the same person is on two companies, the app must say so.

   Found live on 2026-09-20 (fires #141/#142). Two CLIENT records, both stage "won", one imported
   from the corporate client list and one from Inbound, share the same person's e-mail and phone
   across three contact rows — and they map to TWO DIFFERENT finance client groups, so their money
   is counted apart. No merge recorded, nothing flagged, and not one screen said a word.

   The app did have a duplicate check (js/13) and it compares contact e-mails as well as names. It
   never ran on this pair, for two structural reasons, and both are the point of this probe:
     · it only fires after an in-app SAVE, and neither record was ever typed into the app; and
     · it speaks in a TOAST, which is gone a moment later and findable by nobody afterwards.
   js/85 adds the missing half: a quiet, PERSISTENT line on the company's own card.

   What this holds:
     1. a company whose contact e-mail appears on another company is flagged, and the line NAMES
        the other company and the detail that matched, so the claim is checkable;
     2. a company that shares nothing is NOT flagged — a warning on every card is a warning on none;
     3. a phone match counts too, not only e-mail (the live pair shared both);
     4. it is bilingual;
     5. NOTHING is written. Deciding two records are one company is the owner's call, and a wrong
        merge is expensive to undo, so this layer must never do more than point.

   Check 2 is the one that matters most over time: the cheap way to pass checks 1 and 3 is to flag
   everything, and that would be worse than silence.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): with js/85's
   phone comparison removed, check 3 FAILS; with its "skip myself" guard removed, check 2 FAILS
   because every company then matches itself.
   Run: node scripts/qa/probe-one-company-or-two.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9099; const BASE = 'http://localhost:' + PORT;

/* three contacts in the TABLE, because that is how they arrive in real life — by import, which is
   exactly the path js/13's check never sees. b0 and b1 share a person; b2 shares nothing. */
const SHARED_EMAIL = 'one.person@qa-example.test';
const SHARED_PHONE = '+966 50 111 2222';
const CONTACTS = [
  { id: 'qa-dup-a', business_id: 'b0', name: 'Shared Person', role: 'Owner', email: SHARED_EMAIL, phone: SHARED_PHONE,
    verification_source: 'import', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null },
  { id: 'qa-dup-b', business_id: 'b1', name: 'Shared Person', role: 'Owner', email: SHARED_EMAIL, phone: SHARED_PHONE,
    verification_source: 'import', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null },
  { id: 'qa-dup-c', business_id: 'b2', name: 'Nobody Else', role: 'Manager', email: 'alone@qa-example.test', phone: '+966 50 333 4444',
    verification_source: 'import', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null },
];
/* a fourth pair that shares ONLY a phone, so the phone path is proved on its own */
CONTACTS.push(
  { id: 'qa-dup-d', business_id: 'b3', name: 'Phone Only', role: '', email: '', phone: '+966 55 777 8888',
    verification_source: 'import', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null },
  { id: 'qa-dup-e', business_id: 'b4', name: 'Phone Only', role: '', email: '', phone: '+966 55 777 8888',
    verification_source: 'import', needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null });

const srv = start(PORT, { contacts: CONTACTS });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(lang) {
  const wrote = [];
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 2, { timeout: 120000 });
  /* js/72 merges the contacts table onto the companies; the flag reads what it merged */
  await p.waitForFunction(() => { try { return (DB.businesses || []).some((x) => (x.contacts || []).some((c) => c && c._fromTable)); } catch (_) { return false; } }, { timeout: 90000 }).catch(() => { });
  await p.waitForTimeout(2500);

  /* Pick the companies BY THE CONTACT SEEDED ON THEM, never by position. The app's id for a
     company is its legacy_id and its list is not in seed order — the first run of this probe took
     the first six companies and got L0, L9, L18, L27, L36, L45, so half the fixture was never
     looked at and the pair's other half counted as "not flagged". Same family as the #120 lesson. */
  const pick = await p.evaluate(({ email, phone, alone }) => {
    const has = (b, v) => (b.contacts || []).some((c) => c && ((c.email || '').toLowerCase() === v || String(c.phone || '').replace(/[^0-9]/g, '').endsWith(String(v).replace(/[^0-9]/g, '').slice(-9))));
    const byEmail = (DB.businesses || []).filter((b) => (b.contacts || []).some((c) => c && (c.email || '').toLowerCase() === email)).map((b) => b.id);
    const byPhone = (DB.businesses || []).filter((b) => (b.contacts || []).some((c) => c && !c.email && String(c.phone || '').replace(/[^0-9]/g, '').endsWith(phone))).map((b) => b.id);
    const solo = (DB.businesses || []).filter((b) => (b.contacts || []).some((c) => c && (c.email || '').toLowerCase() === alone)).map((b) => b.id);
    return { byEmail, byPhone, solo };
  }, { email: 'one.person@qa-example.test', phone: '557778888', alone: 'alone@qa-example.test' });
  const ids = [...pick.byEmail, ...pick.byPhone, ...pick.solo];
  const seen = {};
  for (const id of ids) {
    await p.evaluate((i) => { try { current = 'leads'; openLead = i; render(); } catch (_) { } }, id);
    await p.waitForTimeout(900);
    seen[id] = await p.evaluate(() => {
      const el = document.querySelector('#view .v85-shared');
      return { shown: !!el, text: el ? (el.innerText || '').replace(/\s+/g, ' ') : '', count: document.querySelectorAll('#view .v85-shared').length };
    });
  }
  await ctx.close();
  return { ids, seen, wrote, pick };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const flaggedEn = en.ids.filter((i) => en.seen[i].shown);
const textEn = flaggedEn.map((i) => en.seen[i].text).join(' | ');
const textAr = ar.ids.filter((i) => ar.seen[i].shown).map((i) => ar.seen[i].text).join(' | ');
/* js/41 auto-matches finance groups on load and that write is blocked by the route above; it is
   not this layer writing, and every probe here excludes it the same way. */
const realWrites = [...new Set(en.wrote.concat(ar.wrote))].filter((w) => !/finance_client_links/.test(w));
const checks = [
  ['the fixture really attached its people — two companies share an e-mail, two share only a phone, one shares nobody',
    en.pick.byEmail.length === 2 && en.pick.byPhone.length === 2 && en.pick.solo.length === 1,
    JSON.stringify(en.pick)],
  ['BOTH companies sharing an e-mail are flagged — not just one side of the pair',
    en.pick.byEmail.every((i) => en.seen[i].shown), JSON.stringify(en.pick.byEmail.map((i) => en.seen[i].shown))],
  ['a shared PHONE counts too, not only an e-mail',
    en.pick.byPhone.every((i) => en.seen[i].shown), JSON.stringify(en.pick.byPhone.map((i) => en.seen[i].shown))],
  ['a company that shares nobody is NOT flagged — a warning on every card is a warning on none',
    en.pick.solo.every((i) => !en.seen[i].shown), JSON.stringify(en.pick.solo.map((i) => en.seen[i].shown))],
  ['the line names the other company and what matched, so it can be checked',
    /Test Company/.test(textEn) && /(qa-example|ending)/.test(textEn), textEn.slice(0, 130)],
  ['it speaks Arabic on the Arabic side',
    /\u0627\u0644\u0634\u062e\u0635 \u0646\u0641\u0633\u0647|\u064a\u0634\u062a\u0631\u0643/.test(textAr), textAr.slice(0, 90)],
  ['exactly one line per card — not one per render',
    en.ids.every((i) => en.seen[i].count <= 1), JSON.stringify(en.ids.map((i) => en.seen[i].count))],
  ['nothing was written — pointing at a possible duplicate must never change a record',
    realWrites.length === 0, JSON.stringify(realWrites)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
