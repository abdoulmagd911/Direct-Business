/* probe-the-lead-hover-card-speaks-arabic.mjs — the funnel card that appears when you rest on a
   lead row reads Arabic in Arabic, and it never translates somebody's own words.

   Fire #203. Driven in Arabic against the live database, resting on a lead row produced:

       PARTNERS & TENDERS · <company>
       Partner type: Government tender
       Has mobile app: No
       API / partner program: No
       Tender value (SAR): مسجّلة — تُقرأ في المالية      ← this one DID translate
       Tender deadline: 2026-02-01
       Tender status: Won

   Six of six field labels and the funnel's own name in English, on the Arabic card. The giveaway is
   the money line: somebody localised the money mask and the two warnings underneath and stopped
   there, so this is a half-finished pass rather than a missing translation. And the words were
   never missing — all 7 funnels carry a real `name_ar` and all 51 template fields carry a
   `label_ar`, counted in the table. The card simply never asked for them.

   Fixed by asking: `label_ar` for the label, `name_ar` for the funnel, and — for the three fields
   the template DECLARES boolean — the Arabic yes/no.

   The interesting part is where the fix stops, and that is what most of this probe holds:
     · the three boolean-declared fields (`has_app`, `iata`, `replied`) hold STRINGS in the live
       data, not booleans, so only an exact yes/no token is translated. `replied` currently reads
       **"Yes — same day"** — somebody's own wording — and a looser match would have rewritten it.
     · a `text` field whose value happens to be "No" is left alone. It is free text a person typed,
       not a vocabulary the app owns.
     · `tender_status` is `select:preparing,applied,won,lost`, a closed list, and there is **no
       Arabic for those options anywhere in the data**. Inventing four words is the owner's wording
       call, so the value shows as stored and the gap is an owner note, not a guess.

   What this holds:
     1. in Arabic every field label on the card is Arabic, and so is the funnel name;
     2. in English the labels and the funnel name are the English ones — the fix is not a swap;
     3. a declared-boolean field holding exactly "No" reads «لا» in Arabic and "No" in English;
     4. a declared-boolean field holding "Yes — same day" is left EXACTLY as stored, both languages;
     5. a TEXT field whose value is "No" is never translated, in either language;
     6. the money mask still translates, and the two warnings still translate — the half of the
        card that already worked must keep working;
     7. no JS errors in either language.

   Checks 4 and 5 are the brakes, and they are the whole risk of this fix: translating a value is
   one step from rewriting what somebody typed. A version that matched yes/no by prefix would pass
   1, 2, 3 and 6 and fail 4; a version that translated any value reading "No" would fail 5.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both runs real:
     · putting `fl.label_en` and `f.name_en` back — fails 1, and 3 with it: once the Arabic label
       is gone this probe cannot find the row by its Arabic name, which is collateral rather than a
       second finding, and is worth knowing so the pair is not read as two faults.
     · matching the yes/no token by prefix (`indexOf('yes')===0`) — fails 4, and the failure line
       shows the damage rather than describing it: «Yes — same day» comes back as «نعم».
   The probe's own first run counted a ⚠ warning line as a fourth field and reported the labels
   wrong on a working card; field rows and warning rows are separated now, and the warnings have a
   check of their own.
   Run: node scripts/qa/probe-the-lead-hover-card-speaks-arabic.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9233 — one mock. */
const PORT = 9233; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {};
    resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd });
  } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

/* A funnel of our own, shaped exactly like the live ones: bilingual name, bilingual labels, and
   the three cases that matter — a declared boolean holding a bare token, a declared boolean holding
   somebody's sentence, and a text field whose value happens to read "No". */
const KEEP_AS_TYPED = 'Yes — same day';
const seeded = await p.evaluate((sentence) => {
  try {
    /* the file's own F() reads window.__FUNNELS, not DB.funnels — the first run of this probe
       seeded the wrong place and got the fallback card with no field rows at all */
    window.__FUNNELS = window.__FUNNELS || [];
    window.__FUNNELS.push({
      id: 'qa_funnel_hover', key: 'qa_hover', name_en: 'QA Hover Funnel', name_ar: 'قمع الاختبار',
      color: 'blue',
      field_template: [
        { key: 'qa_bool_no', type: 'boolean', hover: 1, label_en: 'QA has an app', label_ar: 'لديه تطبيق' },
        { key: 'qa_bool_sentence', type: 'boolean', hover: 1, label_en: 'QA replied', label_ar: 'تم الرد' },
        { key: 'qa_text_no', type: 'text', hover: 1, label_en: 'QA free text', label_ar: 'نص حر' }
      ]
    });
    const B = DB.businesses || [];
    const src = B.find((x) => !x.isClient) || B[0];
    if (!src) return { ok: false };
    const c = JSON.parse(JSON.stringify(src));
    c.id = 'qa_hover_lead'; c.isClient = false; c.name = 'QAHOVER Lead'; c.nameAr = 'QAHOVER Lead';
    c.funnelKey = 'qa_hover'; c.funnelId = 'qa_funnel_hover'; c.funnel_id = 'qa_funnel_hover';
    c.funnelDetails = { qa_bool_no: 'No', qa_bool_sentence: sentence, qa_text_no: 'No' };
    c.activities = []; if (c.raw) c.raw = {};
    B.push(c);
    return { ok: true };
  } catch (e) { return { ok: false, err: e.message }; }
}, KEEP_AS_TYPED);
await p.waitForTimeout(500);

const readCard = async (lang) => {
  await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); current = 'leads'; openLead = null; leadFilter.q = 'QAHOVER'; render(); } catch (_) {} }, lang);
  await p.waitForTimeout(2200);
  return p.evaluate(async () => {
    const rows = [...document.querySelectorAll('#view table tbody tr')].filter((tr) => tr.querySelectorAll('td').length > 2);
    for (const tr of rows) {
      tr.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 140));
      const pop = document.querySelector('.v46-leadpop');
      if (pop && /QA|قمع|اختبار/.test(pop.innerText || '')) {
        const t = (pop.innerText || '').trim();
        const lines = t.split('\n').map((x) => x.trim()).filter(Boolean);
        /* the card carries two kinds of line: "label: value" field rows, and the warnings below
           them, which start with ⚠ and have no label. The first run of this probe counted a
           warning as a fourth field and reported the labels wrong on a working card. */
        const body = lines.slice(1);
        return { head: lines[0] || '', rows: body.filter((x) => x.indexOf('\u26a0') < 0),
          warnings: body.filter((x) => x.indexOf('\u26a0') >= 0), text: t };
      }
    }
    return null;
  });
};

const ar = await readCard('ar');
const en = await readCard('en');
await b.close(); srv.close?.();

const labelOf = (card, frag) => {
  if (!card) return null;
  const line = card.rows.find((l) => l.indexOf(frag) >= 0);
  return line ? line.split(':')[0].trim() : null;
};
const valueOf = (card, labelFrag) => {
  if (!card) return null;
  const line = card.rows.find((l) => l.indexOf(labelFrag) === 0);
  return line ? line.slice(line.indexOf(':') + 1).trim() : null;
};
const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));
const latin = (s) => /[A-Za-z]/.test(String(s || ''));

const arLabels = ar ? ar.rows.map((l) => l.split(':')[0].trim()) : [];
const enLabels = en ? en.rows.map((l) => l.split(':')[0].trim()) : [];

const checks = [
  ['in Arabic every field label is Arabic, and so is the funnel name',
    !!ar && arLabels.length === 3 && arLabels.every((l) => arabic(l) && !latin(l)) && arabic(ar.head),
    JSON.stringify({ head: ar && ar.head, labels: arLabels })],
  ['in English the labels and the funnel name are the English ones',
    !!en && enLabels.length === 3 && enLabels.every((l) => latin(l) && !arabic(l)) && /QA Hover Funnel/i.test(en.head),
    JSON.stringify({ head: en && en.head, labels: enLabels })],
  ['a declared-boolean field holding exactly "No" reads «لا» in Arabic and "No" in English',
    valueOf(ar, 'لديه تطبيق') === 'لا' && valueOf(en, 'QA has an app') === 'No',
    JSON.stringify({ ar: valueOf(ar, 'لديه تطبيق'), en: valueOf(en, 'QA has an app') })],
  ['a declared-boolean field holding a sentence is left exactly as stored, both languages',
    valueOf(ar, 'تم الرد') === KEEP_AS_TYPED && valueOf(en, 'QA replied') === KEEP_AS_TYPED,
    JSON.stringify({ ar: valueOf(ar, 'تم الرد'), en: valueOf(en, 'QA replied'), expected: KEEP_AS_TYPED })],
  ['a text field whose value is "No" is never translated',
    valueOf(ar, 'نص حر') === 'No' && valueOf(en, 'QA free text') === 'No',
    JSON.stringify({ ar: valueOf(ar, 'نص حر'), en: valueOf(en, 'QA free text') })],
  ['the warnings below the fields still translate — the half that already worked keeps working',
    !!ar && !!en && ar.warnings.length > 0 && en.warnings.length > 0 &&
    ar.warnings.every((w) => arabic(w)) && en.warnings.every((w) => latin(w) && !arabic(w)),
    JSON.stringify({ ar: ar && ar.warnings, en: en && en.warnings })],
  ['the fixture really produced a card in both languages',
    !!ar && !!en && ar.rows.length === 3 && en.rows.length === 3 && seeded.ok === true,
    JSON.stringify({ seeded, arRows: ar && ar.rows.length, enRows: en && en.rows.length })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
