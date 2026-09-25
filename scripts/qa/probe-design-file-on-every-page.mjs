/* probe-design-file-on-every-page.mjs (2026-09-25, Phase 1c, D4 / P5) — the one design file is
   loaded by every page, in English and in Arabic, and actually takes effect.

   Why: D4 says "one design file, loaded by every page, with a probe proving it is loaded". A file
   that exists but is not linked, or is linked but loses to an older inline style, looks exactly
   like success in the code and like nothing on screen. So this checks what the browser COMPUTED.

   Under test, on every page in the side menu (admin, so every page is reachable):
     1. the design file's marker (--design-file) is present;
     2. the text is the portal's warm brown (#5C4D42), not the old slate (#303848);
     3. English runs in Inter, Arabic in Cairo (DirectFont is not live until the owner's written OK);
     4. the main action button (.btn.pri), where a page has one, is orange #FF6B00;
     5. step 2: the shared classes carry the portal's shapes — pill buttons, .75rem cards, the orange
        active filter pill on white inactive ones, the warm pager outline, the 1.25rem dialog and
        .45rem / 42px fields (measured on Leads and in the shared dialog);
     6. no JS errors.
   Screenshots of Today, Leads and Clients in both languages go to $SHOTS (default /tmp/design-shots).
   Sabotage: remove the <link rel="stylesheet" href="/css/design.css"> line from index.html —
   checks 1–3 go red on every page.
   PORT = 9339, 9340 (free when written).                                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const SHOTS = process.env.SHOTS || '/tmp/design-shots';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) { }
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

async function walk(lang, PORT) {
  process.env.MOCK_ROLE = 'admin'; delete process.env.MOCK_PAGE_ACCESS;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq));
  const srv = start(PORT);
  const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const pages = await p.evaluate(() => (window.PAGES || []).map((x) => Array.isArray(x) ? x[0] : (x.key || x.id || x)).filter((k) => typeof k === 'string'));
  const out = [];
  for (const key of pages) {
    const r = await p.evaluate(async (k) => {
      try { current = k; openLead = ''; render(); } catch (e) { return { key: k, err: String(e) }; }
      await new Promise((res) => setTimeout(res, 500));
      const cs = getComputedStyle(document.body);
      const pri = document.querySelector('#view .btn.pri');
      return { key: k, marker: getComputedStyle(document.documentElement).getPropertyValue('--design-file').trim(),
        color: cs.color, font: cs.fontFamily, pri: pri ? getComputedStyle(pri).backgroundColor : null };
    }, key);
    out.push(r);
    if (['today', 'leads', 'clients'].includes(key)) await p.screenshot({ path: `${SHOTS}/${lang}-${key}.png` });
  }
  /* step 2 — the shared classes, measured on Leads and in the shared dialog */
  const shared = await p.evaluate(async () => {
    current = 'leads'; openLead = ''; render(); await new Promise((r) => setTimeout(r, 900));
    const cs = (el) => el ? getComputedStyle(el) : null;
    const btn = cs(document.querySelector('#view .btn:not(.pri)'));
    const card = cs(document.querySelector('#view .card'));
    const chipOn = cs(document.querySelector('#view .v26_3-chip.active'));
    const chipOff = cs(document.querySelector('#view .v26_3-chip:not(.active)'));
    const pg = cs(document.querySelector('.pg-prev'));
    try { editBusiness(DB.businesses.find((x) => !x.isClient).id); } catch (_) { }
    await new Promise((r) => setTimeout(r, 400));
    const modal = cs(document.querySelector('#modal.modal, .modal'));
    const fin = document.querySelector('#modal .field input:not([type=checkbox])');
    const field = cs(fin);
    try { closeModal(); } catch (_) { }
    return {
      btnRadius: btn && btn.borderTopLeftRadius, cardRadius: card && card.borderTopLeftRadius,
      chipOn: chipOn && chipOn.backgroundColor, chipOff: chipOff && chipOff.backgroundColor,
      pgBorder: pg && pg.borderTopColor, modalRadius: modal && modal.borderTopLeftRadius,
      fieldRadius: field && field.borderTopLeftRadius, fieldH: fin ? fin.getBoundingClientRect().height : 0,
    };
  });
  await b.close(); srv.close?.();
  return { pages: out, errors, shared };
}

for (const [lang, PORT] of [['en', 9339], ['ar', 9340]]) {
  const r = await walk(lang, PORT);
  r.pages.length >= 15 ? ok(`${lang}: walked ${r.pages.length} pages`) : fail(`${lang}: only ${r.pages.length} pages found — ${JSON.stringify(r.pages.map((x) => x.key))}`);
  const noMark = r.pages.filter((x) => x.marker !== '"1c"');
  noMark.length === 0 ? ok(`${lang}: the design file is loaded on every page`) : fail(`${lang}: design file missing on ${noMark.map((x) => x.key).join(', ')}`);
  const cool = r.pages.filter((x) => x.color !== 'rgb(92, 77, 66)');
  cool.length === 0 ? ok(`${lang}: text is the portal's warm brown everywhere`) : fail(`${lang}: other text colour on ${cool.map((x) => x.key + '=' + x.color).join(', ')}`);
  const want = lang === 'ar' ? /^"?Cairo/ : /^"?Inter/;
  const font = r.pages.filter((x) => !want.test(x.font));
  font.length === 0 ? ok(`${lang}: font is ${lang === 'ar' ? 'Cairo' : 'Inter'} on every page`) : fail(`${lang}: font wrong on ${font.map((x) => x.key + '=' + x.font).join(', ')}`);
  const priBad = r.pages.filter((x) => x.pri && x.pri !== 'rgb(255, 107, 0)' && x.pri !== 'rgb(232, 97, 0)');
  const priSeen = r.pages.filter((x) => x.pri).length;
  (priSeen > 0 && priBad.length === 0) ? ok(`${lang}: the main action is orange (${priSeen} pages have one)`) : fail(`${lang}: main action not orange on ${priBad.map((x) => x.key + '=' + x.pri).join(', ')} (seen ${priSeen})`);
  const sh = r.shared || {};
  (sh.btnRadius === '9999px' && sh.cardRadius === '12px' && sh.chipOn === 'rgb(255, 107, 0)' && sh.chipOff === 'rgb(255, 255, 255)' &&
   sh.pgBorder === 'rgb(237, 226, 218)' && sh.modalRadius === '20px' && sh.fieldRadius === '7.2px' && sh.fieldH >= 41.5)
    ? ok(`${lang}: step 2 shared classes — pill buttons, .75rem cards, orange active filter, warm pager, 1.25rem dialog, .45rem 42px fields`)
    : fail(`${lang}: step 2 shared classes not in effect: ${JSON.stringify(sh)}`);
  r.errors.length === 0 ? ok(`${lang}: no JS errors`) : fail(`${lang}: JS errors: ${r.errors.slice(0, 2).join(' | ')}`);
}
console.log(failures ? 'FAILED — ' + failures : 'design-file-on-every-page OK — one design file, loaded and in effect on every page, both languages');
process.exit(failures ? 1 : 0);
