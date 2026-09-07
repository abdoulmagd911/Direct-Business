/* sweep-language-deep.mjs (2026-09-07, round 61) — the Arabic pass on the surfaces that only
   open when you CLICK something.

   sweep-language walks the nav and reads each page as it lands. That is the shallow half of the
   app, and it is now clean (1 residue, and that one is a mock fixture's company name). Everything
   underneath it has never been read in Arabic by any tool: the quick-edit dialogs, the expense
   capture form, the importer's teach-a-mapping screen, the Finance sub-tabs, the document editors.
   Those are dialogs — they exist only after a button is pressed, so a sweep that never presses a
   button cannot see one, and a green from it says nothing about them.

   This sweep presses the buttons. On every page, in Arabic, it clicks each visible control, and
   when a dialog opens it reads THE DIALOG (not the page behind it) and reports any line that is
   Latin-only. It also drives the sub-tab strips, which swap the page's whole body without a
   navigation and are invisible to a nav-driven walk for the same reason.

   The judgement rules are sweep-language's, deliberately — they were paid for:
     · only text that is actually ON SCREEN counts (round 45: reading hidden nodes produced 28
       false leaks on two pages, buttons no employee can see);
     · an <option> has no box, so its <select> is measured instead;
     · industry terms a Riyadh travel or finance professional writes in Latin anyway — NDC, EMD,
       ZATCA, IATA, PNR — are not leaks, and "translating" them would be wrong, not thorough.

   Under test:
     1. No dialog shows Latin-only user text while the app is in Arabic.
     2. No sub-tab panel does either.
     3. A control that the sweep can fail: it must actually have OPENED some dialogs and driven
        some sub-tabs. Zero of either means the walk broke, not that the app is clean — that is
        the failure this file exists to avoid, and it is the reason it does not simply print a
        list and exit 0 like the sweep it extends.

   Run:  node scripts/qa/sweep-language-deep.mjs        (port 9016)
   Sabotage (file-level): replace one Arabic dialog title in js/ with its English original —
   e.g. the expense-capture heading — and the run must go red naming that dialog.
   Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9016;
const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const srv = start(PORT);

/* Runs inside the page. `root` is a selector; returns the Latin-only visible strings under it.

   The owners' and companies' names are DATA, not chrome. They arrive in the assigned-to and
   client dropdowns as ordinary <option>s, and a sweep that cannot tell them apart reports the
   team roster as an Arabic gap — six times over, once per dialog. So the page's own data is read
   first and any string that appears in it is not a finding. This is the same distinction js/21
   makes when it refuses to translate a value-less <option>: a name is not a label. */
const SCAN = (rootSel) => {
  const root = document.querySelector(rootSel);
  if (!root) return null;
  const data = new Set();
  try {
    const add = (s) => { if (s && typeof s === 'string') data.add(s.trim()); };
    (DB.businesses || []).forEach((b) => { add(b.name); add(b.assignedTo); add(b.accountManager); add(b.owner); });
    (DB.requests || []).forEach((r) => { add(r.owner); add(r.client); });
    (DB.people || DB.team || []).forEach((t) => add(typeof t === 'string' ? t : (t && t.name)));
    (DB.projects || []).forEach((p) => add(p.name || p.title));
    if (typeof teamList === 'function') teamList().forEach(add);   // the roster the owner dropdowns are built from
  } catch (_) { }
  /* A client-facing document rendered inside the app is authored in the DOCUMENT's language,
     which the user picks separately — an Arabic user producing an English price offer is the
     app working, not an Arabic gap. js/21 makes the same exemption in its own words ("the
     client-facing preview document itself is deliberately left as authored"). And a language
     picker writes each language in its own script on purpose: "English" beside "العربية" is
     how a person finds their language, so the pair is chrome that is right as it stands. */
  const exempt = (el) => !!el.closest('.po-page, .po-seg, .dg-doc, .dg-preview, [data-doc-preview]');
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const visible = (el) => (el.tagName === 'OPTION') ? (el.parentElement ? shown(el.parentElement) : false) : shown(el);
  const out = new Set();
  root.querySelectorAll('button, label, th, h1, h2, h3, h4, option, legend, summary, [class*=title], [class*=head]').forEach((el) => {
    const t = (el.textContent || '').trim();
    if (!t || t.length < 3 || t.length > 60) return;
    if (/[؀-ۿ]/.test(t)) return;              // has Arabic -> translated
    if (!/[A-Za-z]{3}/.test(t)) return;                 // no real words
    if (/^[\d\s.,%+\-\/]+$/.test(t)) return;
    if (/(SAR|VAT|PNR|GDS|SLA|SOP|IATA|CSV|PDF|PPTX|XLSX|B2B|B2C|ID|KSA|NDC|EMD|ZATCA|API|ADM|BSP|TTL|FOP|RBD|QR|UUID|Direct|DPIN|Test Company|QA Test|Provider \d|Airline \d|Event \d|INV-|https?:|@)/i.test(t)) return;
    if (data.has(t)) return;                            // a name from the data, not a label
    if (exempt(el)) return;                             // a client-facing document, or a language picker
    if (!visible(el)) return;
    out.add(t.replace(/\s+/g, ' '));
  });
  return [...out];
};

const dialogOpen = () => !!document.querySelector('#ov.show, #modal.show, .modal-back.show, #modal[style*="flex"], #modal[style*="block"]');

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.dismiss().catch(() => { }));
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); });
  await p.waitForTimeout(1500);
  const lang = await p.evaluate(() => (typeof LANG !== 'undefined' ? LANG : '?'));
  if (lang !== 'ar') { fail(`the app is in "${lang}", not Arabic — nothing below would mean anything`); srv.close(); await b.close(); process.exit(1); }
  ok('app switched to Arabic (dir=' + await p.evaluate(() => document.documentElement.dir) + ')');

  const PAGES = [
    { name: 'اليوم / Today', spec: { page: 'today' } },
    { name: 'العملاء المحتملون / Leads list', spec: { page: 'leads' } },
    { name: 'بطاقة عميل محتمل / Lead detail', spec: { page: 'leads', lead: 'L_alyusr' } },
    { name: 'بطاقة عميل / Client detail', spec: { page: 'leads', lead: 'L_bright' } },
    { name: 'العملاء / Clients list', spec: { page: 'clients' } },
    { name: 'المالية / Finance', spec: { page: 'finance' } },
    { name: 'التشغيل / Ops', spec: { page: 'ops' } },
    { name: 'المستندات / Documents', spec: { page: 'documents' } },
    { name: 'الإعدادات / Settings', spec: { page: 'settings' } },
  ];

  const goPage = async (spec) => {
    await p.evaluate((s) => {
      try { if (typeof closeModal === 'function') closeModal(); } catch (_) { }
      try { document.querySelectorAll('#ov,#modal,.modal-back').forEach((m) => m.classList.remove('show', 'open')); } catch (_) { }
      try { openLead = s.lead || null; current = s.page; render(); } catch (_) { }
    }, spec);
    await p.waitForTimeout(1100);
  };
  const closeAny = async () => {
    await p.evaluate(() => {
      try { if (typeof closeModal === 'function') closeModal(); } catch (_) { }
      try { document.querySelectorAll('#ov,#modal,.modal-back').forEach((m) => m.classList.remove('show', 'open')); } catch (_) { }
    });
    await p.waitForTimeout(250);
  };

  const dialogLeaks = [];   // {page, opener, lines[]}
  const panelLeaks = [];    // {page, tab, lines[]}
  let dialogsOpened = 0, tabsDriven = 0, buttonsTried = 0, flips = 0;

  /* THE TRAP THIS SWEEP FELL INTO ON ITS FIRST RUN, KEPT SO IT CANNOT RECUR.
     Settings carries a language card, in #view, that flips the whole app to English. The walk
     pressed it like any other button and every page and dialog after it was English — and the
     sweep dutifully reported five Settings dialogs as untranslated. All five were false: driven by
     hand with the toggle left alone, those dialogs are Arabic. A tool that flips the very setting
     it is measuring is not measuring the app.
     Two guards, because either alone leaves a hole: skip the toggle, AND re-read LANG at every
     scan so any other route to English (a reload, a sign-out, a control added later) is caught
     rather than being reported as an Arabic gap. */
  const isLangToggle = (i) => p.evaluate((i) => {
    const el = [...document.querySelectorAll('#view button')].filter((e) => e.offsetParent !== null)[i];
    if (!el) return false;
    const oc = (el.getAttribute('onclick') || '') + ' ' + (el.className || '');
    return /toggleLang|setLang|applyLang|switchLang/i.test(oc) || /(^|\W)(EN|AR)\s*[\/&·]?\s*(AR|EN)(\W|$)/.test(el.textContent || '');
  }, i).catch(() => false);
  const arNow = () => p.evaluate(() => { try { return LANG === 'ar'; } catch (_) { return false; } }).catch(() => false);
  const restoreAr = async () => {
    flips++;
    await p.evaluate(() => { try { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); } catch (_) { } });
    await p.waitForTimeout(900);
  };

  for (const pg of PAGES) {
    await goPage(pg.spec);

    /* --- sub-tab strips: they replace the body without navigating, so nothing that walks the
       nav ever sees the second, third or fourth of them. Drive each, read the panel.
       These are NOT marked as tabs in the markup — Finance's five are plain `btn sm` buttons in
       a flex row, and Documents' are the same — so they are found by the function they call,
       which is what actually makes them a tab. A class-based selector found zero of them. --- */
    const tabSel = '#view button[onclick*="finGo("], #view button[onclick*="dgGo("], #view [role=tab], #view [class*=tab] button';
    const tabCount = await p.$$eval(tabSel, (els) => els.filter((e) => e.offsetParent !== null).length).catch(() => 0);
    for (let i = 0; i < Math.min(tabCount, 8); i++) {
      const label = await p.evaluate(({ sel, i }) => {
        const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null);
        if (!els[i]) return null; const t = els[i].textContent.trim(); els[i].click(); return t;
      }, { sel: tabSel, i }).catch(() => null);
      if (!label) continue;
      tabsDriven++;
      await p.waitForTimeout(700);
      if (!(await arNow())) { await restoreAr(); await goPage(pg.spec); continue; }
      const lines = await p.evaluate(SCAN, '#view');
      if (lines && lines.length) panelLeaks.push({ page: pg.name, tab: label, lines });
    }
    await goPage(pg.spec);

    /* --- dialogs --- */
    const btnCount = await p.$$eval('#view button', (els) => els.filter((e) => e.offsetParent !== null).length).catch(() => 0);
    for (let i = 0; i < Math.min(btnCount, 40); i++) {
      if (await isLangToggle(i)) continue;
      const label = await p.evaluate((i) => {
        const els = [...document.querySelectorAll('#view button')].filter((e) => e.offsetParent !== null);
        if (!els[i]) return null; const t = els[i].textContent.trim().slice(0, 40);
        try { els[i].click(); } catch (_) { }
        return t || '(unlabelled)';
      }, i).catch(() => null);
      if (label === null) continue;
      buttonsTried++;
      await p.waitForTimeout(550);
      if (!(await arNow())) { await restoreAr(); await goPage(pg.spec); continue; }
      const open = await p.evaluate(dialogOpen).catch(() => false);
      if (open) {
        dialogsOpened++;
        const root = await p.evaluate(() => (document.querySelector('#ov.show') ? '#ov' : '#modal'));
        const lines = await p.evaluate(SCAN, root);
        if (lines && lines.length) dialogLeaks.push({ page: pg.name, opener: label, lines });
        await closeAny();
      }
      /* a button may have navigated, re-rendered or signed us out — put the page back before the
         next one, or every later click is measuring a page nobody asked for */
      const still = await p.evaluate(() => { try { return typeof current !== 'undefined' ? current : null; } catch (_) { return null; } });
      if (still !== pg.spec.page) {
        const alive = await p.evaluate(() => typeof render === 'function').catch(() => false);
        if (!alive) { await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500); await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(800); }
        await goPage(pg.spec);
      }
    }
  }

  await ctx.close(); await b.close();

  console.log(`\nwalked ${PAGES.length} pages in Arabic: pressed ${buttonsTried} buttons, opened ${dialogsOpened} dialogs, drove ${tabsDriven} sub-tabs${flips ? `, and put the app back into Arabic ${flips} time(s) after a control flipped it (those readings were discarded, not reported)` : ''}`);

  /* Check 3 first — it decides whether checks 1 and 2 are evidence at all. */
  if (dialogsOpened >= 5) ok(`${dialogsOpened} dialogs actually opened, so a clean result below is about the dialogs and not about a walk that pressed nothing`);
  else fail(`only ${dialogsOpened} dialogs opened across ${buttonsTried} buttons — the walk is broken, and a clean Arabic result from it would be a false green. Fix the walk before reading anything else here.`);
  if (tabsDriven >= 3) ok(`${tabsDriven} sub-tabs driven`);
  else fail(`only ${tabsDriven} sub-tabs driven — the sub-tab selector no longer matches the app's tab strips, so the panels behind them went unread`);

  if (!dialogLeaks.length) ok('no dialog shows Latin-only text while the app is in Arabic');
  else {
    for (const d of dialogLeaks) fail(`dialog opened by "${d.opener}" on ${d.page} is still English in Arabic: ${d.lines.join(' · ')}`);
  }
  if (!panelLeaks.length) ok('no sub-tab panel shows Latin-only text while the app is in Arabic');
  else {
    for (const t of panelLeaks) fail(`sub-tab "${t.tab}" on ${t.page} is still English in Arabic: ${t.lines.join(' · ')}`);
  }

  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
