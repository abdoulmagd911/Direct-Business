/* Manual open-ended visual sweep — drives every nav page (+ Finance's 4 tabs) in EN and
   AR against the CURRENT mock-supabase.mjs, screenshots each, and inspects the rendered
   DOM for: placeholder/lorem text, element overlap (via getBoundingClientRect), untranslated
   English leaking into the AR pass, currency/number oddities, console warnings, dead links.
   Not a pass/fail gate — a findings dump for a human to read. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8099; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const SHOTS = '/tmp/claude-0/-home-user-Direct-Business/c6b2dbb4-5df9-5075-b6c8-d5f2b7cdb838/scratchpad/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

const findings = [];
const consoleWarnings = [];
p.on('pageerror', e => findings.push({ sev: 'HIGH', where: 'js', msg: String(e.message || e).slice(0, 200) }));
p.on('console', m => { if (m.type() === 'warning') consoleWarnings.push(m.text().slice(0, 160)); });

await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
  const rq = r.request(); const u = new URL(rq.url());
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body });
  } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route('**fonts.gstatic.com/**', r => r.abort());

await p.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(2000);
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForTimeout(5000);

// ---------- analysis helpers, run inside the page ----------
const analyze = () => {
  const out = { lorem: [], overlaps: [], moneyOdd: [], englishLeak: [], emptyLinks: [], nanUndefined: [] };
  const LOREM_RE = /lorem ipsum|test test test|foo ?bar|xxxxxx|asdf|placeholder text|coming soon\?\?/i;
  const NAN_RE = /\bNaN\b|\bundefined\b|\[object Object\]|\bnull\b(?!-safe)/;
  // 1) lorem/placeholder & NaN/undefined leaking into visible text
  const all = [...document.querySelectorAll('body *')];
  for (const el of all) {
    if (el.children.length) continue; // leaf nodes only
    const t = (el.textContent || '').trim();
    if (!t) continue;
    if (LOREM_RE.test(t)) out.lorem.push(t.slice(0, 80));
    if (NAN_RE.test(t)) out.nanUndefined.push(t.slice(0, 80));
  }
  // 2) overlap check among visible "card"-like block elements at the same DOM level
  const boxes = [...document.querySelectorAll('#view .card, #view [class*="card"], #view [class*="tile"], #view [class*="kpi"]')]
    .filter(e => e.offsetParent !== null)
    .map(e => ({ el: e, r: e.getBoundingClientRect() }))
    .filter(o => o.r.width > 4 && o.r.height > 4);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, c = boxes[j].r;
      if (boxes[i].el.contains(boxes[j].el) || boxes[j].el.contains(boxes[i].el)) continue;
      const ox = Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left));
      const oy = Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
      const overlapArea = ox * oy;
      const minArea = Math.min(a.width * a.height, c.width * c.height);
      if (minArea > 0 && overlapArea / minArea > 0.35) {
        out.overlaps.push({ a: (boxes[i].el.className || boxes[i].el.tagName).toString().slice(0, 40), b: (boxes[j].el.className || boxes[j].el.tagName).toString().slice(0, 40), pct: Math.round(100 * overlapArea / minArea) });
      }
    }
  }
  // 3) horizontal page overflow
  out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 4;
  out.scrollW = document.documentElement.scrollWidth;
  out.clientW = document.documentElement.clientWidth;
  // 4) currency oddities: SAR amounts with >2 decimals, or negative-without-minus-context, or huge unformatted numbers
  const moneyEls = all.filter(e => !e.children.length && /SAR|ريال/.test(e.textContent || ''));
  for (const el of moneyEls.slice(0, 400)) {
    const t = (el.textContent || '').trim();
    if (/\d{7,}/.test(t.replace(/[,.]/g, ''))) { /* long raw digit run without separators is fine if it's an id; only flag if adjacent to SAR */ }
    if (/\.\d{3,}\s*(SAR|ريال)/.test(t)) out.moneyOdd.push(t.slice(0, 60));
  }
  // 5) dead/empty links
  [...document.querySelectorAll('#view a[href]')].forEach(a => {
    const h = a.getAttribute('href');
    if (h === '#' || h === '' || h === 'javascript:void(0)') out.emptyLinks.push((a.textContent || '').trim().slice(0, 40));
  });
  return out;
};

const englishLeakCheck = () => {
  // Common English UI words that should NOT appear as standalone visible text once in Arabic mode
  const SUSPECT = ['Loading...', 'Save', 'Cancel', 'Delete', 'Edit', 'Export', 'Search', 'Submit', 'Close', 'Back', 'Next', 'Previous', 'Yes', 'No', 'Confirm', 'undefined', 'null', 'NaN', '[object Object]'];
  const hits = [];
  const all = [...document.querySelectorAll('#view *')];
  for (const el of all) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    for (const s of SUSPECT) {
      if (t === s) hits.push(t);
    }
  }
  return hits;
};

// General rule (owner request, 2026-08-22, after the Clients-page gap sweep's own SUSPECT
// list missed): once in Arabic, no run of 2+ Latin-script words should appear anywhere in
// #view/#nav/.top, UNLESS it's an industry abbreviation, the company's own brand terms
// (which the brand guide deliberately keeps in Latin script), a URL/email, or a code/
// reference-number pattern — those are real data or intentional, not a translation miss.
// This is advisory, not a hard gate: a real person's name typed in English, or a company
// name, will legitimately still show up here and needs a human's read — same as how the
// two real gaps this rule is meant to catch were actually found (screenshots, read by eye).
function latinRunCheck(){
  // Self-contained on purpose: page.evaluate(fn) serialises only the function's own source,
  // not its enclosing closure — anything this needs must be declared INSIDE the function body.
  const LATIN_RUN_ALLOW = new Set([
    'app store', 'google play', 'direct payments', 'direct business', 'direct travel',
    'ksa events', 'ksa b2b', 'po box', 'iso 8601'
  ]);
  const LATIN_RUN_WORD_ALLOW = new Set([
    'ndc', 'api', 'apis', 'zatca', 'emd', 'pdf', 'pnr', 'gds', 'iata', 'bsp', 'vat', 'sar',
    'csv', 'adm', 'ksa', 'mice', 'b2b', 'b2c', 'id', 'qr', 'iban', 'sla', 'kpi', 'gmt', 'utc',
    'http', 'https', 'www', 'ios', 'android', 'direct', 'dpin', 'fsc', 'lcc', 'usd', 'eur',
    'sar', 'esim', 'zip', 'pin', 'crm', 'erp', 'sso', 'url', 'jpg', 'png', 'xlsx', 'csv'
  ]);
  const CODE_RE = /^[A-Z0-9]+[-_][A-Z0-9-]+$/i;       // e.g. REF-001, BIGREF-000123
  const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+/i;
  const URL_RE = /https?:\/\/|www\./i;
  const RUN_RE = /[A-Za-z][A-Za-z'’.]*(?:\s+[A-Za-z][A-Za-z'’.]*){1,}/g;
  const hits = [];
  function evalText(text, where){
    if(!text) return;
    if(EMAIL_RE.test(text) || URL_RE.test(text)) return;
    let m;
    RUN_RE.lastIndex = 0;
    while((m = RUN_RE.exec(text))){
      const run = m[0].trim();
      const lower = run.toLowerCase();
      if(LATIN_RUN_ALLOW.has(lower)) continue;
      const words = lower.split(/\s+/).filter(Boolean);
      if(words.length && words.every(w => LATIN_RUN_WORD_ALLOW.has(w.replace(/[^a-z0-9]/g,'')))) continue;
      if(CODE_RE.test(run.replace(/\s+/g,''))) continue;
      hits.push({ run, where, context: text.slice(0, 90) });
    }
  }
  const scopes = [...document.querySelectorAll('#view, #nav, .top')];
  for(const scope of scopes){
    const leaves = [...scope.querySelectorAll('*')].filter(el => el.children.length === 0);
    for(const el of leaves){
      evalText((el.textContent || '').trim(), el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
    }
    const withPh = [...scope.querySelectorAll('input[placeholder], textarea[placeholder]')];
    for(const el of withPh){
      evalText((el.getAttribute('placeholder') || '').trim(), 'placeholder:' + (el.id || el.className || el.tagName.toLowerCase()));
    }
  }
  // de-dupe identical (run, where) pairs — a repeated table column produces the same hit many times
  const seen = new Set(); const out = [];
  for(const h of hits){ const k = h.run + '|' + h.where; if(seen.has(k)) continue; seen.add(k); out.push(h); }
  return out;
}

// ---------- page list, EN labels used to click nav ----------
const PAGES = [
  { label: 'Today', ar: 'اليوم' },
  { label: 'Leads', ar: 'العملاء المحتملون' },
  { label: 'Clients', ar: 'العملاء' },
  { label: 'Proposals', ar: 'العروض المقدمة' },
  { label: 'Operations', ar: 'العمليات' },
  { label: 'Reports', ar: 'التقارير' },
  { label: 'Finance', ar: 'المالية' },
  { label: 'Settings', ar: 'الإعدادات' },
  { label: 'Events', ar: 'الفعاليات' },
  { label: 'Airlines', ar: 'شركات الطيران' },
  { label: 'Providers & GDS', ar: 'الموردون' },
  { label: 'SOPs & SLAs', ar: 'الإجراءات' },
  { label: 'Bookings', ar: 'الحجوزات' },
  { label: 'Invoices', ar: 'الفواتير' },
  { label: 'Tickets', ar: 'التذاكر' },
  { label: 'Brand', ar: 'الهوية' },
];

async function openNav(labelRegexSrc, exact) {
  // some entries live under a collapsible group ("▸ Reference" / "▾") — open all toggle groups first
  await p.evaluate(() => { [...document.querySelectorAll('#nav .navgroup, #nav [class*="toggle"]')].forEach(x => { try { x.click(); } catch (_) {} }); }).catch(() => {});
  const clicked = await p.evaluate((args) => {
    const [src, exact] = args;
    const btns = [...document.querySelectorAll('#nav button, #nav a')];
    // exact text match first (avoids "Clients" matching inside "Leads pipeline" style labels,
    // and avoids Arabic "العملاء" matching inside "العملاء المحتملون")
    let b = btns.find(x => x.textContent.trim() === src);
    if (!b && exact) return false;
    if (!b) { const re = new RegExp(src, 'i'); b = btns.find(x => re.test(x.textContent.trim())); }
    if (b) { b.click(); return true; }
    return false;
  }, [labelRegexSrc, !!exact]);
  await p.waitForTimeout(900);
  return clicked;
}

async function sweepOne(pageDef, lang, extra) {
  const name = pageDef.label;
  const labelSrc = lang === 'en' ? '^' + name.replace(/[&]/g, '.') : pageDef.ar;
  const found = await openNav(labelSrc);
  if (!found) {
    findings.push({ sev: 'MED', where: name + ' (' + lang + (extra ? '/' + extra : '') + ')', msg: 'nav button not found/clicked' });
    return;
  }
  await p.waitForTimeout(600);
  const a = await p.evaluate(analyze);
  const leak = lang === 'ar' ? await p.evaluate(englishLeakCheck) : [];
  const latinRuns = lang === 'ar' ? await p.evaluate(latinRunCheck) : [];
  const tag = name + (extra ? ' / ' + extra : '') + ' (' + lang.toUpperCase() + ')';
  if (a.lorem.length) findings.push({ sev: 'MED', where: tag, msg: 'placeholder/lorem-like text: ' + a.lorem.join(' | ') });
  if (a.nanUndefined.length) findings.push({ sev: 'HIGH', where: tag, msg: 'NaN/undefined/[object Object] on screen: ' + a.nanUndefined.join(' | ') });
  if (a.overlaps.length) findings.push({ sev: 'MED', where: tag, msg: 'possible element overlap: ' + JSON.stringify(a.overlaps.slice(0, 5)) });
  if (a.hOverflow) findings.push({ sev: 'MED', where: tag, msg: `horizontal overflow: scrollWidth=${a.scrollW} clientWidth=${a.clientW}` });
  if (a.moneyOdd.length) findings.push({ sev: 'LOW', where: tag, msg: 'odd money formatting: ' + a.moneyOdd.join(' | ') });
  if (a.emptyLinks.length) findings.push({ sev: 'LOW', where: tag, msg: 'empty/dead link(s): ' + a.emptyLinks.join(' | ') });
  if (leak.length) findings.push({ sev: 'MED', where: tag, msg: 'untranslated English strings visible in AR: ' + [...new Set(leak)].join(', ') });
  if (latinRuns.length) findings.push({ sev: 'REVIEW', where: tag, msg: 'Latin-script run(s) outside the allowlist — may be a real translation gap OR legitimate data (a name, a company): ' + latinRuns.slice(0, 20).map(h => `"${h.run}" in ${h.where} (…${h.context}…)`).join(' | ') });
  const shotName = SHOTS + '/' + name.replace(/[^a-z0-9]+/gi, '-') + (extra ? '-' + extra : '') + '-' + lang + '.png';
  await p.screenshot({ path: shotName, fullPage: true }).catch(() => {});
}

// ---- EN pass ----
console.log('=== EN pass ===');
for (const pg of PAGES) {
  await sweepOne(pg, 'en');
  if (pg.label === 'Finance') {
    for (const tab of ['Overview', 'Ledger', 'Reports', 'Import']) {
      await p.evaluate((t) => { const b = [...document.querySelectorAll('#view button, #view [role="tab"]')].find(x => new RegExp('^' + t + '$', 'i').test(x.textContent.trim())); if (b) b.click(); }, tab);
      await p.waitForTimeout(700);
      const a = await p.evaluate(analyze);
      const tag = 'Finance / ' + tab + ' (EN)';
      if (a.lorem.length) findings.push({ sev: 'MED', where: tag, msg: 'placeholder/lorem-like text: ' + a.lorem.join(' | ') });
      if (a.nanUndefined.length) findings.push({ sev: 'HIGH', where: tag, msg: 'NaN/undefined/[object Object] on screen: ' + a.nanUndefined.join(' | ') });
      if (a.overlaps.length) findings.push({ sev: 'MED', where: tag, msg: 'possible element overlap: ' + JSON.stringify(a.overlaps.slice(0, 5)) });
      if (a.hOverflow) findings.push({ sev: 'MED', where: tag, msg: `horizontal overflow: scrollWidth=${a.scrollW} clientWidth=${a.clientW}` });
      if (a.moneyOdd.length) findings.push({ sev: 'LOW', where: tag, msg: 'odd money formatting: ' + a.moneyOdd.join(' | ') });
      await p.screenshot({ path: SHOTS + '/finance-' + tab.toLowerCase() + '-en.png', fullPage: true }).catch(() => {});
    }
  }
}

// ---- switch to Arabic ----
console.log('=== switching to AR ===');
await p.evaluate(() => { try { if (typeof setLang === 'function') { setLang('ar'); } else if (typeof LANG !== 'undefined') { LANG = 'ar'; if (typeof render === 'function') render(); } } catch (e) {} });
await p.waitForTimeout(1500);
console.log('dir:', await p.evaluate(() => document.documentElement.dir || document.body.dir));

console.log('=== AR pass ===');
for (const pg of PAGES) {
  await sweepOne(pg, 'ar');
  if (pg.label === 'Finance') {
    for (const tab of [{ en: 'Overview', ar: 'نظرة عامة' }, { en: 'Ledger', ar: 'دفتر' }, { en: 'Reports', ar: 'تقارير' }, { en: 'Import', ar: 'استيراد' }]) {
      await p.evaluate((t) => { const b = [...document.querySelectorAll('#view button, #view [role="tab"]')].find(x => x.textContent.trim().indexOf(t) !== -1); if (b) b.click(); }, tab.ar);
      await p.waitForTimeout(700);
      const a = await p.evaluate(analyze);
      const leak = await p.evaluate(englishLeakCheck);
      const latinRuns = await p.evaluate(latinRunCheck);
      const tag = 'Finance / ' + tab.en + ' (AR)';
      if (a.lorem.length) findings.push({ sev: 'MED', where: tag, msg: 'placeholder/lorem-like text: ' + a.lorem.join(' | ') });
      if (a.nanUndefined.length) findings.push({ sev: 'HIGH', where: tag, msg: 'NaN/undefined/[object Object] on screen: ' + a.nanUndefined.join(' | ') });
      if (a.overlaps.length) findings.push({ sev: 'MED', where: tag, msg: 'possible element overlap: ' + JSON.stringify(a.overlaps.slice(0, 5)) });
      if (a.hOverflow) findings.push({ sev: 'MED', where: tag, msg: `horizontal overflow: scrollWidth=${a.scrollW} clientWidth=${a.clientW}` });
      if (leak.length) findings.push({ sev: 'MED', where: tag, msg: 'untranslated English strings visible in AR: ' + [...new Set(leak)].join(', ') });
      if (latinRuns.length) findings.push({ sev: 'REVIEW', where: tag, msg: 'Latin-script run(s) outside the allowlist — may be a real translation gap OR legitimate data (a name, a company): ' + latinRuns.slice(0, 20).map(h => `"${h.run}" in ${h.where} (…${h.context}…)`).join(' | ') });
      await p.screenshot({ path: SHOTS + '/finance-' + tab.en.toLowerCase() + '-ar.png', fullPage: true }).catch(() => {});
    }
  }
}

console.log('\n=== FINDINGS (' + findings.length + ') ===');
for (const f of findings) console.log('[' + f.sev + '] ' + f.where + ' — ' + f.msg);
console.log('\nconsole warnings sample:', [...new Set(consoleWarnings)].slice(0, 15));
fs.writeFileSync(SHOTS + '/../manual-sweep-findings.json', JSON.stringify({ findings, consoleWarnings: [...new Set(consoleWarnings)] }, null, 2));
console.log('\nscreenshots in', SHOTS);
await b.close(); srv.close();
