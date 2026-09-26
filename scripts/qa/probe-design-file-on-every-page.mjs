/* probe-design-file-on-every-page.mjs (2026-09-25, Phase 1c, D4 / P5) — the one design file is
   loaded by every page, in English and in Arabic, and actually takes effect.

   Why: D4 says "one design file, loaded by every page, with a probe proving it is loaded". A file
   that exists but is not linked, or is linked but loses to an older inline style, looks exactly
   like success in the code and like nothing on screen. So this checks what the browser COMPUTED.

   Under test, on every page in the side menu (admin, so every page is reachable):
     1. the design file's marker (--design-file) is present;
     2. the text is the portal's warm brown (#5C4D42), not the old slate (#303848);
     3. the font (2026-09-26, the owner's OK — DECISIONS D4): the lists start with DirectFont, and the font the
        browser actually DRAWS with (asked of Chrome itself, CSS.getPlatformFontsForNode) is DirectFont on every
        page in both languages; in a SECOND run with assets.directksa.com blocked it is Inter (English) / Cairo
        (Arabic) on every page, nothing drawn in a stray system font;
     3b. Arabic: letters join (a word is drawn narrower joined than forced apart); digits are still the same
        characters; buttons, table cells and the task card overflow no more with DirectFont than with Cairo;
     4. the main action button (.btn.pri), where a page has one, is orange #FF6B00;
     5. step 2: the shared classes carry the portal's shapes — pill buttons, .75rem cards, the orange
        active filter pill on white inactive ones, the warm pager outline, the 1.25rem dialog and
        .45rem / 42px fields (measured on Leads and in the shared dialog);
     6. no JS errors.
   Screenshots of Today, Leads and Clients in both languages go to $SHOTS (default /tmp/design-shots).
   Sabotage: remove the <link rel="stylesheet" href="/css/design.css"> line from index.html —
   checks 1–3 go red on every page; take DirectFont out of the two lists — check 3 goes red.
   The fonts are fetched for real in the test (Direct's server and Google Fonts), never stored here.
   PORT = 9339, 9340; the blocked run 9393, 9394 (free when written).                                                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const SHOTS = process.env.SHOTS || '/tmp/design-shots';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) { }
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

/* the real font files, fetched by the test itself (straight, no proxy) — nothing is stored */
async function realFont(r) {
  try { const resp = await fetch(r.request().url()); const buf = Buffer.from(await resp.arrayBuffer());
    await r.fulfill({ status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/octet-stream', 'access-control-allow-origin': '*' }, body: buf });
  } catch (_) { await r.abort(); } }
async function walk(lang, PORT, block = false) {
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
  await p.route((u) => u.href.includes('fonts.googleapis.com') || u.href.includes('fonts.gstatic.com'), realFont);
  await p.route((u) => u.href.includes('assets.directksa.com'), (r) => block ? r.abort() : realFont(r));
  await p.route((u) => u.href.includes('clearbit.com'), (r) => r.abort());
  const cdp = await p.context().newCDPSession(p); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  /* the font Chrome actually drew a node with — not the list it was asked for */
  const drawn = async (sel) => { try { const { root } = await cdp.send('DOM.getDocument', { depth: 0 }); const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    if (!nodeId) return null; const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }); return (r.fonts || []).map((f) => f.familyName + ':' + f.glyphCount); } catch (_) { return null; } };
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
      try { await document.fonts.ready; } catch (_) { }
      /* the first piece of visible text on the page is the one Chrome is asked about */
      document.querySelectorAll('[data-probe-font]').forEach((x) => x.removeAttribute('data-probe-font'));
      const t = [...document.querySelectorAll('#view *')].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && [...el.childNodes].some((n) => n.nodeType === 3 && /\p{L}{3}/u.test(n.textContent)); });
      if (t) t.setAttribute('data-probe-font', '1');
      return { key: k, marker: getComputedStyle(document.documentElement).getPropertyValue('--design-file').trim(),
        color: cs.color, font: cs.fontFamily, pri: pri ? getComputedStyle(pri).backgroundColor : null };
    }, key);
    r.drawn = await drawn('[data-probe-font]');
    if (!r.drawn || !r.drawn.length) { await p.waitForTimeout(900); r.drawn = await drawn('[data-probe-font]'); }   /* a page still drawing: ask once more */
    out.push(r);
    if (['today', 'leads', 'clients'].includes(key)) await p.screenshot({ path: `${SHOTS}/${block ? 'blocked-' : ''}${lang}-${key}.png` });
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
    const fin = [...document.querySelectorAll('#modal .field input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file])')].find((x) => x.getBoundingClientRect().height > 0);
    const field = cs(fin); const fieldRadius0 = field && field.borderTopLeftRadius, fieldH0 = fin ? fin.getBoundingClientRect().height : 0;
    const modalRadius0 = modal && modal.borderTopLeftRadius;
    try { closeModal(); } catch (_) { }
    return {
      btnRadius: btn && btn.borderTopLeftRadius, cardRadius: card && card.borderTopLeftRadius,
      chipOn: chipOn && chipOn.backgroundColor, chipOff: chipOff && chipOff.backgroundColor,
      pgBorder: pg && pg.borderTopColor, modalRadius: modalRadius0,
      fieldRadius: fieldRadius0, fieldH: fieldH0,
    };
  });
  /* Arabic: joining, digits, and overflow — measured on the page as drawn */
  const arabic = lang !== 'ar' ? null : await p.evaluate(async () => {
    const m = document.createElement('span'); m.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:var(--font-ar);font-size:20px';
    document.body.appendChild(m);
    const w = (txt) => { m.textContent = txt; return m.getBoundingClientRect().width; };
    /* joined: the word as written; apart: the same letters each drawn alone (their isolated forms, which a font
       that does not join would also use in the word) — joining draws the word clearly narrower than that sum */
    const word = 'بببببب';   /* ب joined in the middle is a short stroke; alone it is a wide bowl — the difference is unmistakable */
    const joined = w(word), forced = [...word].reduce((t, ch) => t + (ch === ' ' ? w('\u00A0') : w(ch)), 0); const digits = '0123456789'; m.textContent = digits; const same = m.textContent === digits; m.remove();
    const over = (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && e.scrollWidth > e.clientWidth + 1; }).length;
    current = 'leads'; openLead = ''; render(); await new Promise((r) => setTimeout(r, 900));
    const btn = over([...document.querySelectorAll('#view button, #view .btn')]); const cells = over([...document.querySelectorAll('#view th, #view td')]);
    current = 'tasks'; openLead = ''; render(); await new Promise((r) => setTimeout(r, 1500));
    try { const s = window.__v108State; if (s && s.tasks && s.tasks[0]) v108Open(s.tasks[0].id); } catch (_) { }
    await new Promise((r) => setTimeout(r, 900));
    const card = document.querySelector('#modal .v108-card'); const cardOver = card ? over([card, ...card.querySelectorAll('*')]) : null;
    try { closeModal(); } catch (_) { }
    return { joined, forced, digitsSame: same, btn, cells, card: cardOver };
  });
  await b.close(); srv.close?.();
  return { pages: out, errors, shared, arabic };
}

let arDirect = null;
for (const [lang, PORT] of [['en', 9339], ['ar', 9340]]) {
  const r = await walk(lang, PORT);
  if (r.arabic) arDirect = r.arabic;
  r.pages.length >= 15 ? ok(`${lang}: walked ${r.pages.length} pages`) : fail(`${lang}: only ${r.pages.length} pages found — ${JSON.stringify(r.pages.map((x) => x.key))}`);
  const noMark = r.pages.filter((x) => x.marker !== '"1c"');
  noMark.length === 0 ? ok(`${lang}: the design file is loaded on every page`) : fail(`${lang}: design file missing on ${noMark.map((x) => x.key).join(', ')}`);
  const cool = r.pages.filter((x) => x.color !== 'rgb(92, 77, 66)');
  cool.length === 0 ? ok(`${lang}: text is the portal's warm brown everywhere`) : fail(`${lang}: other text colour on ${cool.map((x) => x.key + '=' + x.color).join(', ')}`);
  const listBad = r.pages.filter((x) => !/^"?DirectFont/.test(x.font));
  listBad.length === 0 ? ok(`${lang}: the font list starts with DirectFont on every page`) : fail(`${lang}: font list wrong on ${listBad.map((x) => x.key + '=' + x.font).join(', ')}`);
  /* what Chrome drew: the font with most glyphs on the page's first text */
  /* the family Chrome reports can carry the weight ("DirectFont", "Inter ExtraBold", "Cairo Medium") */
  const top = (x) => (x.drawn || []).map((f) => f.split(':')).sort((a, b) => b[1] - a[1]).map((f) => f[0])[0] || '(nothing)';
  /* No exception any more: the Generator's own Arabic screen used to draw Cairo, from its brand tokens (Identity C in
     brand/tokens.css). Since 2026-09-26 those tokens start with DirectFont too (the oversight's ask after #43), so every
     page is held to the same rule; probe-generator-fonts-in-exports covers what the Generator prints and exports. */
  const drawnBad = r.pages.filter((x) => !top(x).startsWith('DirectFont'));
  drawnBad.length === 0 ? ok(`${lang}: Chrome draws the text in DirectFont on every page (${r.pages.length})`) : fail(`${lang}: not drawn in DirectFont on ${drawnBad.map((x) => x.key + '=' + top(x)).join(', ')}`);
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

/* the same walk with Direct's font server blocked: the fallback carries every page, nothing breaks */
const base = {};
for (const [lang, PORT] of [['en', 9393], ['ar', 9394]]) {
  const r = await walk(lang, PORT, true);
  const want = lang === 'ar' ? 'Cairo' : 'Inter';
  const top = (x) => (x.drawn || []).map((f) => f.split(':')).sort((a, b) => b[1] - a[1]).map((f) => f[0])[0] || '(nothing)';
  const bad = r.pages.filter((x) => !top(x).startsWith(want));
  (r.pages.length >= 15 && bad.length === 0) ? ok(`blocked ${lang}: with assets.directksa.com unreachable, Chrome draws every page in ${want} (${r.pages.length})`)
    : fail(`blocked ${lang}: not ${want} on ${bad.map((x) => x.key + '=' + top(x)).join(', ')} (pages ${r.pages.length})`);
  r.errors.length === 0 ? ok(`blocked ${lang}: no JS errors`) : fail(`blocked ${lang}: JS errors: ${r.errors.slice(0, 2).join(' | ')}`);
  if (r.arabic) base.ar = r.arabic;
}
/* Arabic, DirectFont against the Cairo baseline */
{
  const a = arDirect, c = base.ar;
  (a && a.joined > 0 && a.joined < a.forced * 0.75) ? ok(`ar: DirectFont joins Arabic letters (word ${Math.round(a.joined)}px joined vs ${Math.round(a.forced)}px forced apart)`) : fail(`ar: joining not seen: ${JSON.stringify(a)}`);
  (a && a.digitsSame) ? ok('ar: digits are the same characters as before') : fail('ar: digits changed');
  (a && c && a.btn <= c.btn && a.cells <= c.cells && a.card !== null && a.card <= (c.card || 0))
    ? ok(`ar: no more overflow with DirectFont than with Cairo — buttons ${a.btn}/${c.btn}, table cells ${a.cells}/${c.cells}, task card ${a.card}/${c.card}`)
    : fail(`ar: overflow grew with DirectFont: ${JSON.stringify({ direct: a, cairo: c })}`);
}
console.log(failures ? 'FAILED — ' + failures : 'design-file-on-every-page OK — one design file, loaded and in effect on every page, both languages; DirectFont drawn, Inter/Cairo behind it');
process.exit(failures ? 1 : 0);
