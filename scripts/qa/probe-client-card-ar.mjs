/* probe-client-card-ar.mjs — a client's card in Arabic, and the two things that must stay hidden
   on it (2026-09-02, attack round 25). Driving a client card in Arabic found the Corporate
   account card's labels and sub-line, the Activity card's sub-line, the activity type word and
   its "moved to" phrase, and the date / "d ago" stamps all English. It also re-checked the two
   deliberate hides on a client card: the loud "🏛 KSA onboarding" button (js/38) and the
   "Managed client" strip (js/28) — both must stay hidden in both languages.
   Asserts:
     - AR client card: the sub-lines, corporate-account labels, the deals sub-head, the timeline
       type word ("ملاحظة") and the relative-time stamp ("قبل …") are Arabic; none of the known
       English chrome survives in VISIBLE text
     - EN client card: the same wording is English (nothing over-translated)
     - the onboarding button and the managed-client strip are hidden, EN and AR
     - phone: the client card never scrolls sideways
   Sabotage: drop CLIENT_CARD_AR in js/21 → "Entity type" survives → red. Drop the Arabic
   branch of fmtAgo in core-01 → "d ago" survives → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8387;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(7000);   // sign-in + the people bridge (activities attach to the lead)
  const openCard = async (lang) => { await p.evaluate((l) => { LANG = l; if (typeof applyLang === 'function') applyLang(); const c = (DB.businesses || []).find((x) => x.isClient); openLead = c.id; current = 'leads'; render(); }, lang); await p.waitForTimeout(1500); };
  // the Corporate account / Activity cards sit in collapsible sections — read the whole markup
  const visibleText = () => p.evaluate(() => (document.getElementById('view') || {}).textContent || '');
  const hidden = () => p.evaluate(() => { const q = (s) => document.querySelector(s); const vis = (e) => e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'; return { onboard: q('.v22OnboardBtn') ? !vis(q('.v22OnboardBtn')) : null, banner: q('.dt-clientbanner') ? !vis(q('.dt-clientbanner')) : null }; });

  // ---- Arabic
  await openCard('ar');
  let t = await visibleText();
  const arMust = ['كل تواصل مع هذه الجهة', 'نوع الجهة', 'شروط الدفع', 'اتفاقيات الشركات مع الطيران', 'ملاحظة', 'قبل '];
  let missing = arMust.filter((w) => t.indexOf(w) < 0);
  if (!missing.length) ok('AR client card: sub-lines, corporate labels, deals sub-head, activity type and time stamp are Arabic'); else fail('AR client card missing ' + JSON.stringify(missing));
  const leftovers = ['Every touch with this business', 'Entity type', 'Payment terms', 'Airline corporate deals', 'd ago', 'h ago', 'm ago', 'agents check before quoting'];
  const leak = leftovers.filter((w) => t.indexOf(w) >= 0);
  if (!leak.length) ok('AR client card: no known English chrome anywhere on the card'); else fail('AR client card: English survives ' + JSON.stringify(leak));
  const typeWord = await p.evaluate(() => { const b = document.querySelector('#view .tl-item .what b'); return b ? b.textContent : null; });
  if (typeWord === 'ملاحظة') ok('AR timeline: the seeded "note" activity reads "ملاحظة"'); else fail('AR timeline type word → ' + JSON.stringify(typeWord));
  const when = await p.evaluate(() => { const w = document.querySelector('#view .tl-item .when'); return w ? w.textContent : null; });
  if (when && /قبل \d+ [يسد]/.test(when) && !/[A-Za-z]{3}/.test(when.replace(/QA/g, ''))) ok('AR timeline: date and relative time read Arabic (' + when + ')'); else fail('AR timeline stamp → ' + JSON.stringify(when));
  let h = await hidden();
  if (h.onboard !== false && h.banner !== false) ok('AR: onboarding button and managed-client strip stay hidden (' + JSON.stringify(h) + ')'); else fail('AR: something deliberately hidden is showing ' + JSON.stringify(h));

  // ---- English
  await openCard('en');
  t = await visibleText();
  const enMust = ['Every touch with this business', 'Entity type', 'Payment terms', 'Airline corporate deals / fares', 'note', 'd ago'];
  missing = enMust.filter((w) => t.indexOf(w) < 0);
  if (!missing.length) ok('EN client card: wording unchanged'); else fail('EN client card missing ' + JSON.stringify(missing));
  h = await hidden();
  if (h.onboard !== false && h.banner !== false) ok('EN: onboarding button and managed-client strip stay hidden'); else fail('EN: something deliberately hidden is showing ' + JSON.stringify(h));

  // ---- phone
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  for (const lang of ['ar', 'en']) {
    await openCard(lang);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 6);
    if (!over) ok('phone ' + lang.toUpperCase() + ' client card: no horizontal overflow'); else fail('phone ' + lang.toUpperCase() + ' client card scrolls sideways');
  }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nclient-card-ar OK — a client card reads Arabic in Arabic, and its two deliberate hides hold');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
