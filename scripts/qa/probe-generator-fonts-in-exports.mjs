/* probe-generator-fonts-in-exports.mjs (2026-09-26) — document headings are DirectFont in what actually
   LEAVES the app: the printed PDF and the PowerPoint file, in English and in Arabic; Cairo when DirectFont
   cannot load; and the Arabic stays joined either way.

   Why: the owner OK'd DirectFont (DECISIONS D4) and the oversight asked for the Generator's headings to use it
   through brand/tokens.css (--font-head), Cairo behind it. A font list that is right in the code can still
   lose on paper — measured while building this: in Arabic mode "Price Offer" drew in a serif fallback,
   because the design file re-fonts every element inside a heading. So this reads the fonts the files carry.

   Under test:
     A. The Generator, EN and AR, DirectFont reachable — its own screen draws DirectFont (the old Arabic
        exception is gone); every document heading on screen draws DirectFont; each editor's printed PDF
        carries a DirectFont face; the Arabic in those PDFs is shaped (joined, see below).
     B. The same with assets.directksa.com blocked — headings draw Cairo, the PDFs carry Cairo and no
        DirectFont, the Arabic is still joined.
     C. PowerPoint, EN and AR — the Reports deck and the service-fee deck download (the engine address
        works: both used to fail, see core-08/core-10), the heading runs name DirectFont (read from
        tokens.css by window.dgHeadFont) — body text too since the owner's pick of 2026-09-26 — and an Arabic deck is written right-to-left.
     D. The Arabic deck opened by LibreOffice: with DirectFont installed the headings come out in
        DirectFont, joined; with DirectFont absent they come out in a substitute — a .pptx names ONE font
        and the viewer's computer picks the stand-in — and the Arabic is STILL joined, not broken letters.
   "Joined" is read from the PDF itself: every font in a PDF carries a map from its drawn shapes back to
   letters. Joined Arabic draws one letter with several shapes (start, middle, end of a word), so some
   Arabic letter maps from two or more shapes; letters drawn apart only ever use one.
   The fonts are fetched by the test (Direct's server, Google Fonts) into a temp folder and deleted —
   never stored in the repo. Nothing is written to any database (mock only).
   Sabotage-tested 2026-09-26: with the heading rule taken out of brand/tokens.css AND the old cdnjs address put
   back in core-10, 12 checks go red (every heading check in all four runs, the Arabic-joined checks, both Reports
   deck downloads, the LibreOffice part) — exit 1.
   PORTs 9471–9474 (free when written).                                                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'genfonts-'));
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const check = (c, m, detail) => c ? ok(m) : fail(m + (detail ? ' — ' + detail : ''));

/* ---------- reading a PDF: font names, and whether its Arabic was shaped ---------- */
function pdfFonts(buf) {
  const raw = buf.toString('latin1'); const objs = new Map();
  for (const m of raw.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objs.set(m[1], m[2]);
  const streamOf = (body) => { const i = body.indexOf('stream'); if (i < 0) return null;
    let s = i + 6; if (body[s] === '\r') s++; if (body[s] === '\n') s++;
    const e = body.lastIndexOf('endstream'); const bytes = Buffer.from(body.slice(s, e), 'latin1');
    if (/\/FlateDecode/.test(body.slice(0, i))) { try { return zlib.inflateSync(bytes).toString('latin1'); } catch (_) { try { return zlib.inflateSync(bytes.subarray(0, bytes.length - 1)).toString('latin1'); } catch (__) { return ''; } } }
    return bytes.toString('latin1'); };
  const out = [];
  for (const body of objs.values()) {
    const bf = body.match(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([^\s/\]>]+)/); if (!bf || !/\/Type\s*\/Font/.test(body)) continue;
    const tu = body.match(/\/ToUnicode\s+(\d+) 0 R/); const map = new Map();   /* letter -> set of shapes */
    const cm = tu && objs.has(tu[1]) ? streamOf(objs.get(tu[1])) : '';
    /* Two ways a PDF writer records a joined shape: Chrome maps it to the Arabic "presentation form" of the
       letter (U+FE70–FEFF, U+FB50–FDFF: the start / middle / end shapes), LibreOffice maps it back to the plain
       letter — so one letter then has several shapes. Either one means the text was joined. */
    let contextual = 0;
    const add = (g, u) => { const cps = [...u.matchAll(/[0-9A-Fa-f]{4}/g)].map((x) => parseInt(x[0], 16)); if (cps.length !== 1) return; let cp = cps[0];
      if ((cp >= 0xFE70 && cp <= 0xFEFC) || (cp >= 0xFB50 && cp <= 0xFDFF)) { contextual++; cp = String.fromCharCode(cp).normalize('NFKC').charCodeAt(0); }
      if (!(cp >= 0x0620 && cp <= 0x064A)) return;
      if (!map.has(cp)) map.set(cp, new Set()); map.get(cp).add(parseInt(g, 16)); };
    for (const blk of (cm || '').matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const e of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) add(e[1], e[2]);
    for (const blk of (cm || '').matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const e of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const a = parseInt(e[1], 16), b = parseInt(e[2], 16), u = parseInt(e[3], 16); for (let g = a; g <= b; g++) add(g.toString(16), (u + g - a).toString(16).padStart(4, '0')); }
    const arabic = [...map.entries()];
    out.push({ name: bf[1], arabicLetters: arabic.length, joinedLetters: contextual + arabic.filter(([, s]) => s.size > 1).length });
  }
  const byName = new Map(); for (const f of out) { const k = f.name; const o = byName.get(k) || { name: k, arabicLetters: 0, joinedLetters: 0 };
    o.arabicLetters += f.arabicLetters; o.joinedLetters += f.joinedLetters; byName.set(k, o); }
  return [...byName.values()];
}
const has = (fonts, re) => fonts.some((f) => re.test(f.name));
const arabicJoined = (fonts, re) => { const fs2 = fonts.filter((f) => re.test(f.name) && f.arabicLetters > 0); return fs2.length > 0 && fs2.every((f) => f.joinedLetters > 0); };
const arabicSummary = (fonts) => fonts.filter((f) => f.arabicLetters).map((f) => `${f.name} ${f.joinedLetters}/${f.arabicLetters}`).join(', ');

/* ---------- the browser run ---------- */
async function realFetch(r) { try { const resp = await fetch(r.request().url()); const buf = Buffer.from(await resp.arrayBuffer());
  await r.fulfill({ status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/octet-stream', 'access-control-allow-origin': '*' }, body: buf }); } catch (_) { await r.abort(); } }
const PRE = { offer: 'po', fees: 'sf', tender: 'td', profile: 'cp', contract: 'ct' };
async function run(lang, PORT, block) {
  process.env.MOCK_ROLE = 'admin'; delete process.env.MOCK_PAGE_ACCESS;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq)); const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('cdn.jsdelivr.net/npm/pptxgenjs'), realFetch);      /* registered later = asked first */
  await p.route((u) => u.href.includes('cdnjs.cloudflare.com'), realFetch);                 /* so the old address fails as it does live */
  await p.route((u) => u.href.includes('fonts.googleapis.com') || u.href.includes('fonts.gstatic.com'), realFetch);
  await p.route((u) => u.href.includes('assets.directksa.com'), (r) => block ? r.abort() : realFetch(r));
  await p.route((u) => u.href.includes('clearbit.com'), (r) => r.abort());
  const cdp = await ctx.newCDPSession(p); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const drawn = async () => { try { const { root } = await cdp.send('DOM.getDocument', { depth: 0 }); const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-pf]' });
    if (!nodeId) return null; const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }); const f = (r.fonts || []).sort((x, y) => y.glyphCount - x.glyphCount)[0]; return f ? f.familyName : null; } catch (_) { return null; } };
  /* a heading's words may sit in an inner element — ask about the element that holds the text */
  const mark = (sel) => p.evaluate((s) => { document.querySelectorAll('[data-pf]').forEach((x) => x.removeAttribute('data-pf'));
    const h = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0 && /\p{L}{2}/u.test(e.textContent)); if (!h) return null;
    const t = [h, ...h.querySelectorAll('*')].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /\p{L}{2}/u.test(n.textContent))) || h;
    t.setAttribute('data-pf', '1'); return h.textContent.trim().slice(0, 40); }, sel);
  await p.goto(BASE + '/documents', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof window.dgGo === 'function' && typeof window.rptPpt === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 }); await p.waitForTimeout(2000);
  await p.evaluate(() => { current = 'documents'; openLead = null; render(); }); await p.waitForTimeout(1200);
  await p.evaluate(async () => { try { await document.fonts.ready; } catch (_) { } });
  const res = { chrome: null, heads: {}, bodies: {}, pdfs: {}, decks: {}, headFont: await p.evaluate(() => window.dgHeadFont && window.dgHeadFont()), errors };
  if (await mark('#dgWrap .dg-home-h1')) res.chrome = await drawn();
  for (const ed of Object.keys(PRE)) {
    await p.evaluate((e) => dgGo(e), ed); await p.waitForTimeout(2500);
    await p.evaluate(async () => { try { await document.fonts.ready; } catch (_) { } });
    const pg = PRE[ed]; res.heads[ed] = [];
    for (const side of ['en', 'ar']) { const txt = await mark(`#${pg}Pages .${pg}-page.${side} :is(h1,h2,h3,h4)`); if (txt) res.heads[ed].push({ side, txt, font: await drawn() }); }
    /* body text (2026-09-26, the owner's pick): the first paragraph / cell / list line on each side of the page */
    res.bodies[ed] = [];
    for (const side of ['en', 'ar']) { const txt = await mark(`#${pg}Pages .${pg}-page.${side} :is(p,td,li)`); if (txt) res.bodies[ed].push({ side, txt, font: await drawn() }); }
    await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(600);
    const pdf = await p.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    await p.emulateMedia({ media: 'screen' });
    fs.writeFileSync(path.join(TMP, `${block ? 'blocked-' : ''}${lang}-${ed}.pdf`), pdf);
    res.pdfs[ed] = pdfFonts(pdf);
    await p.evaluate(() => { try { DG.view = 'home'; render(); } catch (_) { } }); await p.waitForTimeout(500);
  }
  if (!block) {
    const grab = async (fire, name) => { try { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.evaluate(fire)]);
      const f = path.join(TMP, `${lang}-${name}.pptx`); await dl.saveAs(f); return f; } catch (e) { return null; } };
    await p.evaluate(() => { current = 'reports'; openLead = null; render(); }); await p.waitForTimeout(1500);
    res.decks.reports = await grab(() => { rptPpt(); }, 'reports');
    await p.evaluate(() => { DB.serviceFeePricing = [{ id: 'qa_fee', name: 'QA fee card', perItem: { flight: 50, hotel: 40 } }]; v25OpenServiceFeeGen(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const c = document.getElementById('sfg_client'); if (c && c.options.length > 1) c.selectedIndex = 1; });
    res.decks.fees = await grab(() => { v25DoServiceFee('pptx'); }, 'fees');
  }
  await b.close(); srv.close?.();
  return res;
}

/* ---------- a .pptx is a zip of XML: read the slides ---------- */
function slidesXml(file) {
  const dir = path.join(TMP, path.basename(file) + '.x'); fs.mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', file, '-d', dir]);
  const sd = path.join(dir, 'ppt', 'slides');
  return fs.readdirSync(sd).filter((f) => /^slide\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/))).map((f) => fs.readFileSync(path.join(sd, f), 'utf8'));
}
const runsWith = (xml) => [...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map((m) => ({ face: (m[1].match(/<a:latin typeface="([^"]+)"/) || [])[1] || '', text: (m[1].match(/<a:t>([\s\S]*?)<\/a:t>/) || [])[1] || '' }));

/* ---------- LibreOffice with a font folder of our choosing ---------- */
async function fetchTo(url, file) { const r = await fetch(url, { headers: { 'user-agent': 'curl/8' } }); if (!r.ok) throw new Error(url + ' ' + r.status); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); }
async function fontDir(withDirect) {
  const d = path.join(TMP, withDirect ? 'fonts-direct' : 'fonts-cairo'); fs.mkdirSync(d, { recursive: true });
  const css = await (await fetch('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700', { headers: { 'user-agent': 'curl/8' } })).text();
  let i = 0; for (const m of css.matchAll(/url\((https:[^)]+\.ttf)\)/g)) await fetchTo(m[1], path.join(d, `cairo-${i++}.ttf`));
  if (withDirect) for (const w of ['400-DirectFont-Regular', '700-DirectFont-Bold', '800-DirectFont-Black']) {
    const src = path.join(d, w + '.woff2'); await fetchTo(`https://assets.directksa.com/direct_font_woff2/${w}.woff2`, src);
    execFileSync('python3', ['-c', `from fontTools.ttLib import TTFont\nf=TTFont(${JSON.stringify(src)});f.flavor=None;f.save(${JSON.stringify(src.replace('.woff2', '.ttf'))})`]); fs.unlinkSync(src); }
  const conf = path.join(d, 'fonts.conf');
  fs.writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include><dir>${d}</dir><cachedir>${d}/cache</cachedir></fontconfig>`);
  return conf;
}
function lo(pptx, conf, tag) {
  const out = path.join(TMP, 'lo-' + tag); fs.mkdirSync(out, { recursive: true });
  const prof = 'file://' + path.join(TMP, 'lo-profile-' + tag);
  let log = '';
  try { log = execFileSync('soffice', ['-env:UserInstallation=' + prof, '--headless', '--convert-to', 'pdf', '--outdir', out, pptx], { env: { ...process.env, FONTCONFIG_FILE: conf }, timeout: 180000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { log = String(e.stdout || '') + String(e.stderr || ''); }
  const pdf = path.join(out, path.basename(pptx).replace(/\.pptx$/, '.pdf'));
  if (!fs.existsSync(pdf)) throw new Error('LibreOffice made no PDF: ' + log.slice(-400));
  return pdfFonts(fs.readFileSync(pdf));
}

try {
  const R = {};
  for (const [lang, PORT, block] of [['en', 9471, false], ['ar', 9472, false], ['en', 9473, true], ['ar', 9474, true]]) {
    const k = (block ? 'blocked-' : '') + lang; const r = R[k] = await run(lang, PORT, block);
    const want = block ? 'Cairo' : 'DirectFont'; const wantRe = block ? /^Cairo/ : /^DirectFont/;
    /* the screen around the documents falls back like every other page: Inter in English, Cairo in Arabic */
    const chromeWant = block ? (lang === 'en' ? 'Inter' : 'Cairo') : 'DirectFont';
    console.log(`— ${lang.toUpperCase()}${block ? ', DirectFont blocked' : ''}`);
    check(r.chrome && r.chrome.startsWith(chromeWant), `${k}: the Generator's own screen draws ${chromeWant}`, 'drew ' + r.chrome);
    const heads = Object.entries(r.heads).flatMap(([ed, hs]) => hs.map((h) => ({ ed, ...h })));
    const badH = heads.filter((h) => !wantRe.test(h.font || ''));
    const sides = new Set(heads.map((h) => h.side));
    check(heads.length >= 4 && sides.size === 2 && badH.length === 0, `${k}: every document heading on screen draws ${want} (${heads.map((h) => h.ed + '/' + h.side).join(' ')})`, badH.map((h) => `${h.ed}/${h.side} "${h.txt}"=${h.font}`).join('; ') || 'only ' + heads.length + ' on sides ' + [...sides]);
    const bodies = Object.entries(r.bodies).flatMap(([ed, hs]) => hs.map((h) => ({ ed, ...h })));
    const badB = bodies.filter((h) => !wantRe.test(h.font || ''));
    check(bodies.length >= 4 && new Set(bodies.map((h) => h.side)).size === 2 && badB.length === 0, `${k}: document body text on screen draws ${want} too (${bodies.map((h) => h.ed + '/' + h.side).join(' ')})`, badB.map((h) => `${h.ed}/${h.side} "${h.txt}"=${h.font}`).join('; ') || 'only ' + bodies.length);
    /* and on paper: every Arabic letter in every printed document is drawn in the document font — no letter left
       to a system font (they were DejaVu Sans before the owner's pick) */
    const arStray = Object.keys(PRE).filter((ed) => r.pdfs[ed].some((f) => f.arabicLetters && !wantRe.test(f.name)));
    check(arStray.length === 0, `${k}: no Arabic in the printed PDFs falls to a system font`, arStray.map((ed) => ed + ': ' + arabicSummary(r.pdfs[ed])).join('; '));
    const withHeads = Object.keys(PRE).filter((ed) => r.heads[ed].length);
    const badPdf = withHeads.filter((ed) => !has(r.pdfs[ed], wantRe) || (block && has(r.pdfs[ed], /^DirectFont/)));
    check(badPdf.length === 0, `${k}: each printed PDF carries the ${want} heading face${block ? ' and no DirectFont' : ''} (${withHeads.join(', ')})`, badPdf.map((ed) => ed + ': ' + r.pdfs[ed].map((f) => f.name).join(' ')).join('; '));
    const arEds = withHeads.filter((ed) => r.pdfs[ed].some((f) => wantRe.test(f.name) && f.arabicLetters));
    check(arEds.length >= 1 && arEds.every((ed) => arabicJoined(r.pdfs[ed], wantRe)), `${k}: the Arabic headings in the PDFs are joined (${arEds.join(', ')})`, arEds.map((ed) => ed + ': ' + arabicSummary(r.pdfs[ed])).join('; ') || 'no Arabic heading in ' + want);
    check(r.errors.length === 0, `${k}: no JS errors or alerts`, r.errors.slice(0, 3).join(' | '));
  }
  console.log('— PowerPoint');
  for (const lang of ['en', 'ar']) {
    const r = R[lang];
    check(r.headFont === 'DirectFont', `${lang}: the heading font read from brand/tokens.css is DirectFont`, String(r.headFont));
    for (const deck of ['reports', 'fees']) {
      const f = r.decks[deck];
      check(!!f && fs.statSync(f).size > 20000, `${lang}: the ${deck} deck downloads (the PowerPoint engine loads)`, f ? fs.statSync(f).size + ' bytes' : 'no download');
      if (!f) continue;
      const slides = slidesXml(f); const runs = slides.flatMap(runsWith);
      const title = runs.find((x) => x.text === 'Direct Business');
      check(title && title.face === 'DirectFont', `${lang}/${deck}: the cover heading names DirectFont`, title ? title.face : 'no cover heading');
      if (deck === 'reports') {
        const other = runs.filter((x) => x.face && x.face !== 'DirectFont');
        check(runs.length > 20 && other.length === 0, `${lang}/reports: every text run names DirectFont, body text included (${runs.length} runs)`, [...new Set(other.map((x) => x.face))].join(', '));
        const rtl = /<a:pPr[^>]*rtl="1"/.test(slides[0]);
        check(lang === 'ar' ? rtl : !rtl, `${lang}/reports: ${lang === 'ar' ? 'written right-to-left' : 'left-to-right'}`);
      }
    }
  }
  const arDeck = R.ar.decks.reports;
  /* LibreOffice opens a .pptx only with its presentation part (libreoffice-impress); a container without it
     says so here instead of passing quietly — the file checks in C still ran. */
  let impress = false; try { impress = /libreoffice-impress/.test(execFileSync('dpkg', ['-l', 'libreoffice-impress'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (_) { }
  if (!impress) console.log('  · D not run: LibreOffice Impress is not installed in this container (apt-get install libreoffice-impress to run it)');
  else if (arDeck && fs.existsSync(arDeck)) {
    console.log('— The Arabic deck in LibreOffice');
    const withD = lo(arDeck, await fontDir(true), 'direct');
    check(has(withD, /^DirectFont/) && arabicJoined(withD, /^DirectFont/), 'DirectFont installed: the headings come out in DirectFont, Arabic joined', withD.map((x) => x.name).join(' ') + ' | ' + arabicSummary(withD));
    const noD = lo(arDeck, await fontDir(false), 'cairo');
    const arFonts = noD.filter((x) => x.arabicLetters);
    check(!has(noD, /^DirectFont/) && arFonts.length > 0 && arFonts.every((x) => x.joinedLetters > 0), 'DirectFont absent: a stand-in draws the headings and every Arabic line is still joined', noD.map((x) => x.name).join(' ') + ' | ' + arabicSummary(noD));
    console.log('    (fonts in that file: ' + noD.map((x) => x.name).join(', ') + ')');
  } else fail('no Arabic deck to open in LibreOffice');
} catch (e) { fail('probe crashed: ' + (e && e.stack || e)); }
finally { if (!process.env.KEEP) fs.rmSync(TMP, { recursive: true, force: true }); else console.log('kept: ' + TMP); }
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — headings are DirectFont in the PDF and the PowerPoint, Cairo when it cannot load, Arabic joined');
process.exit(failures ? 1 : 0);
