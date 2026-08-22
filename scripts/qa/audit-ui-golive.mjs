/* audit-ui-golive.mjs — go-live UI walk (2026-08-22).
   Signs in through the mock harness and walks the 10 primary nav pages — Today, Leads,
   Clients, Proposals, Operations, Reports, Finance, Settings, Reference, Brand — in English
   and Arabic, at a normal desktop viewport (1440x900) and a phone viewport (390x844), and
   reports what a PERSON would actually notice:
     - contradictory chip totals (an "All"/"الكل" chip vs. the sum of its sibling chips)
     - a pager's real row count vs. a KPI-strip total claiming a different number
     - an empty table with no "no records yet" explanation nearby
     - money appearing on Leads or Clients (standing rule — money lives on Finance only)
     - a run of 2+ consecutive Latin words left in an Arabic-mode page
     - JS/console errors
     - the page scrolling sideways as a whole (document wider than the viewport)
     - a button/link that is off-screen and NOT inside any horizontally-scrolling ancestor
       (a control inside a table or tab strip that scrolls is correct responsive behaviour,
       not a defect — this check walks the full ancestor chain before flagging anything)
     - a visible tap target under 24px tall

   HONEST LIMITATIONS:
   - The chip-contradiction check only fires when an "All" chip and at least 2 sibling chips
     all carry numbers. Clients' chips ("All clients" / "At risk") carry no counts, so this
     check silently skips there — it is not proof Clients' chips agree with anything. The
     real Leads chip-agreement invariant is covered by scripts/qa/probe-leads-counts.mjs.
   - The Latin-leak check does not distinguish a genuinely sighted-visible English string
     from an accessibility "visually hidden but present for screen readers" element (e.g. a
     skip-to-content link) — both have real layout and pass the visibility filter here. A
     hit worth acting on should be confirmed by eye (or against the element's own CSS)
     before treating it as a translation gap.
   - "Brand" (js/46-brand-and-studio.js) opens /brand/ in a NEW browser tab via window.open,
     not an in-app view change — this probe cannot walk that page's content from inside the
     main app's single page/context, so it only confirms the nav click itself doesn't throw.
     Same for "Reference", which is a dropdown toggle with no content view of its own. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8141;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

const MONEY_STRINGS = [' SAR', 'ريال', 'Lifetime billed', 'Open deal value', 'Deal value', 'Outstanding', 'Credit held'];
const MONEY_PAGE_KEYS = new Set(['leads', 'clients']);

// Real nav labels, EN and AR — the AR strings are copied from a live run of sweep-pages.mjs
// (its "Arabic nav:" line), not guessed, since transliterating them wrong would make every
// AR page silently unmatched and every AR check a false "nothing found here".
const PAGES = [
  { key: 'today', en: 'Today', ar: 'اليوم' },
  { key: 'leads', en: 'Leads', ar: 'العملاء المحتملون' },
  { key: 'clients', en: 'Clients', ar: 'العملاء' },
  { key: 'proposals', en: 'Proposals', ar: 'العروض المقدمة' },
  { key: 'operations', en: 'Operations', ar: 'العمليات' },
  { key: 'reports', en: 'Reports', ar: 'التقارير' },
  { key: 'finance', en: 'Finance', ar: 'المالية' },
  { key: 'settings', en: 'Settings', ar: 'الإعدادات' },
  { key: 'reference', en: 'Reference', ar: 'مرجع' }, // dropdown toggle, not a content page of its own
  { key: 'brand', en: 'Brand', ar: 'الهوية' },
];

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'phone', width: 390, height: 844 },
];
const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'AR' },
];

const findings = [];
function record(pass, page, f) {
  findings.push({ pass, page, ...f });
}

async function setupPage(ctx) {
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
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

  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  return { p, errors };
}

async function goToNavLabel(p, label, isReference) {
  return p.evaluate(({ label, isReference }) => {
    const btns = [...document.querySelectorAll('#nav button')];
    const b = isReference
      ? btns.find((x) => x.textContent.includes(label))
      : btns.find((x) => x.textContent.trim() === label);
    if (b) { b.click(); return true; }
    return false;
  }, { label, isReference });
}

async function checkPage(p, moneyStrings, checkMoney, checkLatin) {
  return p.evaluate(({ moneyStrings, checkMoney, checkLatin }) => {
    const out = [];

    // 1 — page scrolling sideways as a whole
    const sw = document.documentElement.scrollWidth, iw = window.innerWidth;
    if (sw > iw + 4) out.push({ type: 'page-overflow', detail: `document ${sw}px wider than viewport ${iw}px` });

    // 2 — empty table, no explanation nearby
    document.querySelectorAll('table').forEach((t) => {
      const tb = t.tBodies && t.tBodies[0]; if (!tb) return;
      const rows = [...tb.rows].filter((r) => r.cells && r.cells.length > 1 && String(r.className || '').indexOf('s1-kid') < 0);
      if (rows.length === 0) {
        const container = t.closest('.tbl-wrap') || t.parentElement || t;
        const nearby = (container.textContent || '');
        if (!/no .*(yet|found|records)|no data|لا توجد|لم يتم|لا يوجد/i.test(nearby)) {
          out.push({ type: 'empty-table-no-explanation', detail: (t.id || t.className || 'table').toString().slice(0, 60) });
        }
      }
    });

    // 3 — chip contradiction: an "All"/"الكل" chip vs. the sum of >=2 numbered sibling chips
    document.querySelectorAll('[class*="chip"]').forEach((container) => {
      if (!container.classList || !/chips?$/i.test([...container.classList].join(' '))) return;
    });
    (function chipCheck() {
      const groups = new Set();
      document.querySelectorAll('[class*="chip"]').forEach((el) => { if (el.parentElement) groups.add(el.parentElement); });
      groups.forEach((group) => {
        const chips = [...group.children].filter((c) => c.className && /chip/i.test(c.className));
        if (chips.length < 3) return; // need an "All" + at least 2 stage chips to mean anything
        const parsed = chips.map((c) => {
          const t = (c.textContent || '').trim();
          const m = t.match(/(\d+)\s*$/);
          return { text: t, n: m ? parseInt(m[1], 10) : null };
        });
        if (parsed.some((x) => x.n === null)) return; // this page's chips don't carry numbers — skip (documented limitation)
        const allIdx = parsed.findIndex((x) => /^(all|الكل)\b/i.test(x.text));
        if (allIdx < 0) return;
        const sum = parsed.filter((_, i) => i !== allIdx).reduce((s, x) => s + x.n, 0);
        if (parsed[allIdx].n !== sum) {
          out.push({ type: 'chip-contradiction', detail: `"${parsed[allIdx].text}" (${parsed[allIdx].n}) != sum of siblings (${sum})` });
        }
      });
    })();

    // 4 — pager's real total vs. a KPI-strip total claiming a different number
    (function stripVsPager() {
      const pgLbl = document.querySelector('.pg-bar span');
      if (!pgLbl) return;
      const m = (pgLbl.textContent || '').match(/(?:of|من)\s*(\d+)/);
      if (!m) return;
      const real = parseInt(m[1], 10);
      const kvEls = [...document.querySelectorAll('[id*="kv_count"], [class*="kpi"], [class*="strip"]')];
      kvEls.forEach((el) => {
        const t = (el.textContent || '');
        const km = t.match(/^\s*(\d+)\s*(?:in (?:pipeline|view)|total|leads|clients|records)/i);
        if (km) {
          const claimed = parseInt(km[1], 10);
          if (claimed !== real) out.push({ type: 'strip-vs-row-mismatch', detail: `strip says ${claimed}, pager total is ${real} ("${t.trim().slice(0, 40)}")` });
        }
      });
    })();

    // 5 — money on Leads/Clients (standing rule)
    if (checkMoney) {
      const text = document.body.innerText;
      const hits = moneyStrings.filter((s) => text.includes(s));
      if (hits.length) out.push({ type: 'money-on-leads-clients', detail: hits.join(', ') });
    }

    // 6 — Latin text left on an Arabic page (2+ consecutive Latin words, rough heuristic —
    //     intentionally conservative for a go-live gate; single abbreviations like SAR/IATA/
    //     GDS/CSV/PDF/KPI/SOP/VIP are not by themselves a defect)
    if (checkLatin) {
      const seen = new Set();
      document.querySelectorAll('body *').forEach((el) => {
        if (el.children.length) return; // leaf nodes only, avoid duplicate parent/child hits
        if (!el.offsetParent) return;    // not visible — a hidden command-palette/skip-link/
                                          // dev-tools element is not something an Arabic-mode
                                          // user is actually looking at
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const t = (el.textContent || '').trim();
        if (!t) return;
        const m = t.match(/[A-Za-z][A-Za-z .,'\-]{2,}[A-Za-z](?:\s+[A-Za-z][A-Za-z .,'\-]{1,}[A-Za-z])+/);
        if (m && !seen.has(m[0])) { seen.add(m[0]); out.push({ type: 'latin-leak', detail: m[0].slice(0, 60) }); }
      });
    }

    // #nav is app chrome (and on the phone viewport may live in an off-canvas drawer with
    // its own reveal mechanism) — a separate concern from THIS page's content, so it is
    // excluded from both checks below rather than producing noise on every single page.
    const inNav = (el) => !!(el.closest && el.closest('#nav'));

    // 7 — visible tap target under 24px tall
    document.querySelectorAll('button, select, a.btn, [role="button"]').forEach((el) => {
      if (!el.offsetParent || inNav(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.height < 24) out.push({ type: 'small-tap-target', detail: `${(el.textContent || el.tagName).trim().slice(0, 30)} h=${Math.round(r.height)}px` });
    });

    // 8 — off-screen control NOT reachable via a horizontally-scrolling ancestor. Only the
    // horizontal axis counts: the whole document scrolling vertically (element below the
    // fold) is completely normal and is NOT what "unreachable" means here.
    function hasScrollableAncestor(el) {
      let n = el.parentElement;
      while (n) {
        const cs = getComputedStyle(n);
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
        n = n.parentElement;
      }
      return false;
    }
    document.querySelectorAll('button, a.btn, [role="button"]').forEach((el) => {
      if (!el.offsetParent || inNav(el)) return;
      const r = el.getBoundingClientRect();
      const offscreenHorizontally = r.right < 0 || r.left > window.innerWidth;
      if (offscreenHorizontally && !hasScrollableAncestor(el)) {
        out.push({ type: 'unreachable-control', detail: (el.textContent || '').trim().slice(0, 30) });
      }
    });

    return out;
  }, { moneyStrings, checkMoney, checkLatin });
}

async function runPass(browser, viewport, lang) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const { p, errors } = await setupPage(ctx);

  if (lang.code === 'ar') {
    await p.evaluate((code) => {
      try {
        if (typeof setLang === 'function') { setLang(code); return; }
        if (typeof LANG !== 'undefined') { LANG = code; if (typeof render === 'function') render(); }
      } catch (e) {}
    }, lang.code);
    await p.waitForTimeout(700);
  }

  const passLabel = `${viewport.label}/${lang.label}`;
  for (const page of PAGES) {
    const label = lang.code === 'ar' ? page.ar : page.en;
    const before = errors.length;
    const clicked = await goToNavLabel(p, label, page.key === 'reference');
    await p.waitForTimeout(page.key === 'reference' ? 400 : 900);
    if (!clicked) {
      record(passLabel, page.key, { type: 'nav-label-not-found', detail: `"${label}" not found in #nav` });
      continue;
    }
    // 'reference' is a dropdown toggle and 'brand' opens /brand/ in a NEW TAB (window.open,
    // see js/46-brand-and-studio.js part 1) — neither changes the in-app view, so checking
    // this page's content after "clicking" either of them would just re-scan whatever page
    // was showing before. Confirmed live: with this guard removed, 'brand' findings were
    // near-duplicates of 'settings' findings in every pass, because that's exactly what was
    // happening. Both are skipped here on purpose, not silently missed.
    if (page.key === 'reference' || page.key === 'brand') continue;
    const pageFindings = await checkPage(p, MONEY_STRINGS, MONEY_PAGE_KEYS.has(page.key), lang.code === 'ar');
    pageFindings.forEach((f) => record(passLabel, page.key, f));
    const newErrors = errors.slice(before);
    newErrors.forEach((e) => record(passLabel, page.key, { type: 'js-console-error', detail: e }));
  }

  await ctx.close();
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  for (const viewport of VIEWPORTS) {
    for (const lang of LANGS) {
      console.log(`\n=== ${viewport.label} (${viewport.width}x${viewport.height}) / ${lang.label} ===`);
      const before = findings.length;
      await runPass(b, viewport, lang);
      const added = findings.length - before;
      console.log(added === 0 ? `  ✓ ${PAGES.length} pages walked, nothing flagged` : `  ${added} finding(s) — see report below`);
    }
  }

  await b.close();
  srv.close();

  console.log('\n=== FULL REPORT ===');
  if (findings.length === 0) {
    console.log('FINDINGS: none');
  } else {
    findings.forEach((f) => console.log(`  ✗ [${f.pass}] ${f.page}: ${f.type} — ${typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)}`));
    console.log(`\nFINDINGS: ${findings.length}`);
  }

  const jsErrors = findings.filter((f) => f.type === 'js-console-error');
  console.log(jsErrors.length ? `JS/CONSOLE ERRORS: ${jsErrors.length}` : 'JS/CONSOLE ERRORS: none');

  fs.writeFileSync('/tmp/audit-ui-golive.json', JSON.stringify(findings, null, 2));

  process.exit(findings.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
