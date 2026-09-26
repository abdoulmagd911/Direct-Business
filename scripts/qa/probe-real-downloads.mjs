/* probe-real-downloads.mjs (2026-09-26) — every download button the app has, pressed for real, with the REAL
   engines: nothing it fetches from a CDN is swapped for a stand-in, except the Supabase library itself.

   Why: #44 found two download buttons that had never worked — Reports → PowerPoint loaded its engine from an
   address that does not exist, and the Projects decks loaded an engine build that needs a helper the app never
   loads. Both passed every test for months, because the harness answers EVERY cdn.jsdelivr.net request with the
   Supabase library: the engine "loaded", and no test ever pressed the button and looked at the file.
   The oversight's rule (2026-09-26): one test per real download path, running the real app code without the
   stand-in — and the same downloads are part of every release's live check (docs/BACKLOG.md).

   Under test, in English and in Arabic, each by pressing the button a person presses:
     · Reports → "PowerPoint (.pptx)"  → a real .pptx arrives, opens as a zip, has slides, text in DirectFont;
     · Reports → "Print / PDF"         → the print window opens and prints to a real PDF in DirectFont;
     · Projects → the proposal's "PPTX" and "PDF" buttons, and the service-fee proposal's → the same;
     · Finance → an invoice's print    → a real PDF in DirectFont;
     · Offers → the client proposal     → a real PDF in DirectFont;
     · Generator → each document's print button (price offer, service fees, tender pack, company profile,
       contract) → print is called, and the page prints to a real PDF in DirectFont.
   "Real PDF" = the browser's own PDF of what would reach paper: over 20 KB and carrying DirectFont; where the
   document has Arabic, every Arabic letter is drawn in DirectFont (nothing left to a system font).
   Sabotage-tested 2026-09-26: with core-10's old cdnjs address and core-08's pptxgen.min.js put back, 8 checks go red
   (all three decks in both languages, and the error names the missing helper: "JSZip is not defined").

   LIVE=1 — THE RELEASE LIVE CHECK. The same presses on https://www.directksab2b.com against the real database,
   signed in as the QA account, READ-ONLY: every table write, save_state, log_* and storage write is answered by the
   test and never reaches the database (the list is printed at the end — it must say "none reached"). The files
   carry real company data, so they go to a temp folder that is deleted (KEEP=1 keeps it for a look; never commit
   them). A path with nothing to print on the live data (no project yet) says so instead of passing.
   PORTS 9481, 9482 (free when written).                                                                         */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'realdl-'));
let failures = 0, seq = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const check = (c, m, detail) => c ? ok(m) : fail(m + (detail ? ' — ' + detail : ''));

/* fonts a PDF carries, and which of them draw Arabic (read from each font's letter map) */
function pdfFonts(buf) {
  const raw = buf.toString('latin1'); const objs = new Map();
  for (const m of raw.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objs.set(m[1], m[2]);
  const streamOf = (body) => { const i = body.indexOf('stream'); if (i < 0) return '';
    let s = i + 6; if (body[s] === '\r') s++; if (body[s] === '\n') s++;
    const bytes = Buffer.from(body.slice(s, body.lastIndexOf('endstream')), 'latin1');
    try { return /\/FlateDecode/.test(body.slice(0, i)) ? zlib.inflateSync(bytes).toString('latin1') : bytes.toString('latin1'); } catch (_) { return ''; } };
  const out = new Map();
  for (const body of objs.values()) {
    const bf = body.match(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([^\s/\]>]+)/); if (!bf || !/\/Type\s*\/Font/.test(body)) continue;
    const tu = body.match(/\/ToUnicode\s+(\d+) 0 R/); const cm = tu && objs.has(tu[1]) ? streamOf(objs.get(tu[1])) : '';
    const arabic = [...cm.matchAll(/<[0-9A-Fa-f]+>\s*<([0-9A-Fa-f]{4})>/g)].some((m) => { const c = parseInt(m[1], 16); return (c >= 0x0620 && c <= 0x064A) || (c >= 0xFB50 && c <= 0xFEFC); });
    const o = out.get(bf[1]) || { name: bf[1], arabic: false }; o.arabic = o.arabic || arabic; out.set(bf[1], o);
  }
  return [...out.values()];
}
function judgePdf(buf, label) {
  if (!buf) return fail(`${label}: no PDF came out`);
  const f = pdfFonts(buf); const names = f.map((x) => x.name).join(' ');
  const stray = f.filter((x) => x.arabic && !/^DirectFont/.test(x.name));
  check(buf.length > 20000 && f.some((x) => /^DirectFont/.test(x.name)) && stray.length === 0,
    `${label}: a real PDF (${Math.round(buf.length / 1024)} KB) in DirectFont${f.some((x) => x.arabic) ? ', its Arabic too' : ''}`,
    `fonts: ${names}${stray.length ? ' — Arabic left to ' + stray.map((x) => x.name).join(', ') : ''}`);
}
function judgePptx(file, label, rtl) {
  if (!file) return fail(`${label}: no file came down`);
  const dir = file + '.x'; let slides = [];
  try { execFileSync('unzip', ['-o', '-q', file, '-d', dir]); const sd = path.join(dir, 'ppt', 'slides');
    slides = fs.readdirSync(sd).filter((f) => /^slide\d+\.xml$/.test(f)).map((f) => fs.readFileSync(path.join(sd, f), 'utf8')); } catch (e) { return fail(`${label}: the file is not a PowerPoint (${e.message.slice(0, 80)})`); }
  const faces = [...new Set(slides.join('').match(/latin typeface="[^"]+"/g) || [])].map((x) => x.slice(16, -1));
  check(slides.length >= 2 && faces.includes('DirectFont'), `${label}: a real .pptx (${Math.round(fs.statSync(file).size / 1024)} KB, ${slides.length} slides) naming DirectFont`, 'slides ' + slides.length + ', fonts ' + faces.join(' '));
  if (rtl !== undefined) check(/<a:pPr[^>]*rtl="1"/.test(slides[0]) === rtl, `${label}: ${rtl ? 'right-to-left' : 'left-to-right'}`);
}

const LIVE = process.env.LIVE === '1'; const SITE = 'https://www.directksab2b.com'; const heldBack = [];
async function run(lang, PORT) {
  let srv = null, BASE = SITE;
  if (!LIVE) { process.env.MOCK_ROLE = 'admin'; delete process.env.MOCK_PAGE_ACCESS;
    const { start } = await import('./mock-supabase.mjs?run=' + (++seq)); srv = start(PORT); BASE = 'http://localhost:' + PORT; }
  /* the browser goes to the internet directly, as a person's does — fonts and engines are the real files */
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: 'direct://' }, args: ['--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true, ignoreHTTPSErrors: true }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  /* a real print dialog would stop a test browser dead — in EVERY window (the documents open their own), a press is
     counted instead, and the test prints the page to PDF itself */
  await ctx.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
  /* LIVE: the real database, READ-ONLY. Every write the app sends to Supabase — a table write, save_state, a log_*
     rpc, a storage upload — is answered inside the page and never leaves it. Done in the page's own fetch rather
     than by intercepting, because interception has to be switched off while a document window opens (above). */
  if (LIVE) await ctx.addInitScript(() => {
    const real = window.fetch.bind(window); window.__held = [];
    window.fetch = (input, init) => { try { const url = String(input && input.url || input); const m = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (url.includes('vkxoeeoauexyfpzqufqd.supabase.co')) { const u = new URL(url); const rpc = /\/rpc\//.test(u.pathname);
        if ((!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && !rpc) || (rpc && /save_state|log_|_save|upsert|insert|delete|update|issue|create/.test(u.pathname)) || (u.pathname.startsWith('/storage/') && m !== 'GET')) {
          window.__held.push(m + ' ' + u.pathname); return Promise.resolve(new Response(rpc ? '""' : '[]', { status: 200, headers: { 'content-type': 'application/json' } })); } } } catch (_) { }
      return real(input, init); };
  });
  /* Only the MAIN page is intercepted, and only while no document window is opening: Playwright holds back every
     request a window opened from an intercepted page makes (measured: its stylesheet arrives only when it closes),
     which would make every document here print in a system font for a reason that is the test's, not the app's. */
  const routes = async () => {
    if (LIVE) return;   /* LIVE writes are held back inside the page (below), which never switches off */
    await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
      try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
        const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
    /* the ONE stand-in: the Supabase library, which the mock needs. Every other CDN file is the real one. */
    await p.route((u) => /supabase-js/.test(u.href), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
    await p.route((u) => u.href.includes('clearbit.com'), (r) => r.abort());
  };
  await routes();
  await p.goto(BASE + '/today' + (LIVE ? '?cb=' + Date.now() : ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction((live) => typeof window.dgGo === 'function' && typeof window.rptPpt === 'function' && (DB.businesses || []).length > 0 && (live || (DB.projects || []).length > 0), LIVE, { timeout: 120000 }); await p.waitForTimeout(LIVE ? 5000 : 2000);
  const has = await p.evaluate(() => ({ projects: (DB.projects || []).length, invoices: (DB.invoices || []).length }));
  /* window.print cannot open a dialog in a test browser; count the presses instead, then print to PDF ourselves */
  const go = (k) => p.evaluate((x) => { openLead = null; current = x; render(); }, k).then(() => p.waitForTimeout(1500));
  const download = async (press, name) => { try { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), press()]);
    const f = path.join(TMP, `${lang}-${name}.pptx`); await dl.saveAs(f); return f; } catch (e) { errors.push(name + ': ' + e.message.split('\n')[0]); return null; } };
  const limit = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' took over ' + ms / 1000 + ' s')), ms))]);
  const popupPdf = (press) => limit(popupPdf0(press), 90000, 'the document window').catch((e) => { errors.push('popup: ' + e.message); return null; });
  const popupPdf0 = async (press) => { if (!LIVE) await p.unrouteAll({ behavior: 'wait' }); try { const [w] = await Promise.all([ctx.waitForEvent('page', { timeout: 30000 }), press()]);
    await w.waitForLoadState('load', { timeout: 30000 }); await w.evaluate(() => document.fonts.ready); await w.waitForTimeout(400);
    await w.emulateMedia({ media: 'print' }); const pdf = await w.pdf({ format: 'A4', printBackground: true }); await w.close(); return pdf; } catch (e) { errors.push('popup: ' + e.message); return null; } finally { if (!LIVE) await routes(); } };
  const selfPdf = async () => { await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(500);
    const pdf = await p.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } }); await p.emulateMedia({ media: 'screen' }); return pdf; };
  const L = lang.toUpperCase();

  console.log(`— ${L}: Reports`);
  await go('reports'); await p.evaluate(() => rptGo('report')); await p.waitForTimeout(1200);
  judgePptx(await download(() => p.click('button[onclick="rptPpt()"]'), 'reports'), `${lang} Reports → PowerPoint`, lang === 'ar');
  judgePdf(await popupPdf(() => p.click('button[onclick="rptPrintReport()"]')), `${lang} Reports → Print / PDF`);

  console.log(`— ${L}: Projects and the service-fee proposal`);
  await go('projects');
  const openPP = async () => { await p.evaluate(() => v25OpenProjectProposalGen()); await p.waitForTimeout(600);
    await p.selectOption('#ppg_proj', { index: 1 }); };   /* the first project, as a person picks it */
  if (!has.projects) console.log(`  · ${lang} Projects → proposal: not run — there is no project in this data yet`);
  else { await openPP(); judgePptx(await download(() => p.click('button[onclick*="v25DoProjectProposal(\'pptx\')"]'), 'project'), `${lang} Projects → proposal deck`);
    await openPP(); judgePdf(await popupPdf(() => p.click('button[onclick*="v25DoProjectProposal(\'pdf\')"]')), `${lang} Projects → proposal PDF`); }
  /* a fee card to propose when the data has none (in this page's memory only); the button itself is the app's own */
  await p.evaluate(() => { if (!(DB.serviceFeePricing || []).length) DB.serviceFeePricing = [{ id: 'qa_fee', name: 'QA fee card', perItem: { flight: 50, hotel: 40 } }]; });
  const openSF = async () => { await p.evaluate(() => v25OpenServiceFeeGen()); await p.waitForTimeout(600);
    await p.evaluate(() => { const c = document.getElementById('sfg_client'); if (c && c.options.length > 1) c.selectedIndex = 1; }); };
  await openSF(); judgePptx(await download(() => p.click('button[onclick="v25DoServiceFee(\'pptx\')"]'), 'fees'), `${lang} Service-fee proposal → deck`);
  await openSF(); judgePdf(await popupPdf(() => p.click('button[onclick="v25DoServiceFee(\'pdf\')"]')), `${lang} Service-fee proposal → PDF`);
  try { await p.evaluate(() => closeModal()); } catch (_) { }

  console.log(`— ${L}: Finance and Offers`);
  if (!has.invoices) console.log(`  · ${lang} Invoice → print: not run — there is no invoice in this data yet`);
  else judgePdf(await popupPdf(() => p.evaluate(() => v21PrintInvoice((DB.invoices || [])[0].id))), `${lang} Invoice → print`);
  await p.evaluate(() => { DB.offers = DB.offers || []; if (!DB.offers.find((o) => o.id === 'qa_off')) DB.offers.push({ id: 'qa_off', ref: 'OFR-QA-1', client: 'Test Company 0', proposalType: 'Price offer', title: 'QA offer', scope: 'Flights | 1,000 SAR\nHotels | 2,000 SAR', value: '3000', currency: 'SAR', status: 'Draft', date: '2026-09-26' }); });
  judgePdf(await popupPdf(() => p.evaluate(() => o_genProposal('qa_off'))), `${lang} Offer → client proposal`);

  console.log(`— ${L}: Generator`);
  await go('documents');
  for (const [ed, fn] of [['offer', 'poPrint'], ['fees', 'sfPrint'], ['tender', 'tdPrint'], ['profile', 'cpPrint'], ['contract', 'ctPrint']]) {
    await p.evaluate((e) => dgGo(e), ed); await p.waitForTimeout(2500); await p.evaluate(() => document.fonts.ready);
    const before = await p.evaluate(() => window.__prints);
    try { await p.click(`button[onclick="${fn}()"]`, { timeout: 10000 }); } catch (_) { }
    const pressed = (await p.evaluate(() => window.__prints)) > before;
    check(pressed, `${lang} Generator ${ed}: its print button reaches the browser's print`);
    judgePdf(await selfPdf(), `${lang} Generator ${ed} → PDF`);
    await p.evaluate(() => { try { DG.view = 'home'; render(); } catch (_) { } }); await p.waitForTimeout(400);
  }
  check(errors.length === 0, `${lang}: no JS errors, alerts or failed windows`, errors.slice(0, 3).join(' | '));
  if (LIVE) heldBack.push(...await p.evaluate(() => window.__held || []));
  await b.close(); srv?.close?.();
}

try { for (const [lang, PORT] of [['en', 9481], ['ar', 9482]]) await run(lang, PORT); }
catch (e) { fail('probe crashed: ' + (e && e.stack || e)); }
finally { if (!process.env.KEEP) fs.rmSync(TMP, { recursive: true, force: true }); else console.log('kept: ' + TMP); }
if (LIVE) check(true, 'writes the app tried, answered by the test, none reached the database: ' + ([...new Set(heldBack)].join(', ') || 'none tried'));
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — every download path produced a real file, with the real engines');
process.exit(failures ? 1 : 0);
