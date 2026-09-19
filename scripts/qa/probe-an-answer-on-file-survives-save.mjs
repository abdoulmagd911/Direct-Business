/* probe-an-answer-on-file-survives-save.mjs — guards the 2026-09-20 (fire #115) fix in
   js/09-funnels.js.

   Each funnel carries a field template, and five of its fields are dropdowns with a fixed option
   list plus three are yes/no. The answers were written by the importer from the source files; the
   option lists were written separately. Seven live answers do not match their own list — "Partner"
   where the list reads partner_target, "Won" where it reads won, "Government tender", "Verified",
   and yes/no fields holding the words "No" and "Yes — same day".

   A <select> with no matching option opens on "—". Save reads an empty control as "cleared on
   purpose" and deletes the key. So opening the funnel-details form on such a lead and pressing
   Save WITHOUT TOUCHING ANYTHING destroyed the answers: measured on a real lead against the real
   database, three of its six answers went, in English and in Arabic, with no warning and nothing
   on screen to show it had happened. The card had been showing those answers correctly the whole
   time, which is what makes it so easy to walk into — you see the answer, you open Edit to change
   the deadline, you press Save, and three answers are gone.

   The fix has three parts, because the same trap is in three kinds of control: a dropdown carries
   the stored answer as its own option, selected and marked as what is on file, so Save writes it
   back unchanged; a yes/no control turns only the two words it writes itself into true/false, so a
   "Yes — same day" keeps its detail instead of collapsing to a bare no; and a number or date box
   falls back to a plain text box when the stored answer is not something it would accept, since a
   strict box refuses the value, comes up empty, and lands in the same deletion. Picking one of the
   standard options instead is still a choice the person makes on purpose.

   Today's live numbers and dates are all well-formed — that third part is the same defect in a
   field type where the data happens to be clean, fed by the same importer as the dropdowns, where
   it is not.

   This is the second half of a pair. Round 42 fixed Save destroying an answer whose KEY is not in
   the template; this one is an answer whose VALUE the template cannot represent. Both are checked
   below, because they are one Save.

   Sabotage-tested 2026-09-20, each part separately, each restored byte-for-byte afterwards:
     · the on-file option removed: 5 checks FAIL — the dropdowns open empty and Save takes
       stance, iata and replied away, in both languages, exactly as the live lead lost three of six.
     · the boolean conversion put back to (v2==='true'): 2 checks FAIL — "Yes — same day"
       becomes false, which reverses what it says.
     · the number/date fallback removed: 3 checks FAIL — "about 40" and "March 2026" are gone.
   Run: node scripts/qa/probe-an-answer-on-file-survives-save.mjs                                 */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9088; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

/* the shapes the live data is actually in, put on one lead so one Save covers them all */
const STORED = {
  stance: 'Partner',            // a dropdown answer the option list does not contain
  iata: 'No',                   // a yes/no field holding the word
  replied: 'Yes — same day', // a yes that carries a detail — must not become a bare false
  headcount: 'about 40',        // a number field holding something that is not a number
  deadline: 'March 2026',       // and a date field holding a month rather than a day
  city: 'Riyadh',               // an ordinary answer, to prove the form still works normally
  research_status: 'done',      // an answer that IS in the list, to prove it is untouched
  legacy_note: 'kept from an older template', // no longer in the template — the round-42 rule
};
const TEMPLATE = [
  { key: 'stance', type: 'select:competitor,partner_target,neutral', label_en: 'Competitor or partner', label_ar: 'منافس أم شريك' },
  { key: 'research_status', type: 'select:pending,done', label_en: 'Research status', label_ar: 'حالة البحث' },
  { key: 'iata', type: 'boolean', label_en: 'IATA', label_ar: 'اياتا' },
  { key: 'replied', type: 'boolean', label_en: 'Replied?', label_ar: 'تم الرد؟' },
  { key: 'headcount', type: 'number', label_en: 'Staff', label_ar: 'الموظفون' },
  { key: 'deadline', type: 'date', label_en: 'Deadline', label_ar: 'الموعد' },
  { key: 'city', type: 'text', label_en: 'City', label_ar: 'المدينة' },
];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
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
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0 && typeof window.__editFunnelDetails === 'function', { timeout: 120000 });
  await p.waitForTimeout(4000);

  const id = await p.evaluate(({ tpl, stored }) => {
    window.__FUNNELS = window.__FUNNELS || [];
    window.__FUNNELS.push({ key: 'qa_on_file', name_en: 'QA on-file', name_ar: 'اختبار', color: 'blue', field_template: tpl });
    const b0 = (DB.businesses || [])[0];
    b0.funnelKey = 'qa_on_file';
    b0.funnelDetails = JSON.parse(JSON.stringify(stored));
    current = 'leads'; openLead = b0.id; render();
    return b0.id;
  }, { tpl: TEMPLATE, stored: STORED });
  await p.waitForTimeout(2500);

  /* what the card says — the answers have to be readable before anyone would open the form */
  const card = await p.evaluate(() => {
    const c = document.getElementById('funnelCard'); if (!c) return null;
    const out = {};
    [].slice.call(c.querySelectorAll('.fact')).forEach((f) => {
      out[((f.querySelector('.k') || {}).textContent || '').trim()] = ((f.querySelector('.v') || {}).textContent || '').trim();
    });
    return out;
  });

  /* what the form shows, then Save with NOTHING touched */
  const out = await p.evaluate((leadId) => {
    const lead = (DB.businesses || []).find((x) => x.id === leadId);
    const before = JSON.parse(JSON.stringify(lead.funnelDetails || {}));
    window.__editFunnelDetails(leadId);
    const ctrl = (k) => {
      const e = document.getElementById('fd_' + k); if (!e) return null;
      return { tag: e.tagName, value: e.value,
        optionValues: e.tagName === 'SELECT' ? [].slice.call(e.options).map((o) => o.value) : null,
        selectedText: e.tagName === 'SELECT' && e.selectedIndex >= 0 ? (e.options[e.selectedIndex].textContent || '').trim() : null };
    };
    const shown = { stance: ctrl('stance'), iata: ctrl('iata'), replied: ctrl('replied'),
      headcount: ctrl('headcount'), deadline: ctrl('deadline'), city: ctrl('city'),
      research_status: ctrl('research_status') };
    const sawBox = !!document.getElementById('fdModal');
    document.getElementById('fd_save').click();
    const after = JSON.parse(JSON.stringify(lead.funnelDetails || {}));
    return { before, after, shown, sawBox, boxGone: !document.getElementById('fdModal') };
  }, id);
  await p.waitForTimeout(1200);
  await ctx.close();
  return { card, ...out };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const lost = (r) => Object.keys(r.before).filter((k) => !(k in r.after));
const changed = (r) => Object.keys(r.before).filter((k) => k in r.after && String(r.after[k]) !== String(r.before[k]));
console.log('  EN lost', JSON.stringify(lost(en)), '· changed', JSON.stringify(changed(en).map((k) => k + ': ' + JSON.stringify(en.before[k]) + ' -> ' + JSON.stringify(en.after[k]))));
console.log('  AR lost', JSON.stringify(lost(ar)), '· changed', JSON.stringify(changed(ar).map((k) => k + ': ' + JSON.stringify(ar.before[k]) + ' -> ' + JSON.stringify(ar.after[k]))));
console.log('  EN shown', JSON.stringify(en.shown));
console.log('  AR stance', JSON.stringify(ar.shown.stance), '· AR card', JSON.stringify(ar.card));

const checks = [
  ['the form opened and the lead really carries the funnel', en.sawBox && ar.sawBox && !!en.card && Object.keys(en.card).length === 7,
    'card rows: EN ' + (en.card ? Object.keys(en.card).length : 0) + ' · AR ' + (ar.card ? Object.keys(ar.card).length : 0)],
  ['a dropdown shows the answer that is on file, rather than opening empty',
    en.shown.stance.value === 'Partner' && ar.shown.stance.value === 'Partner',
    JSON.stringify({ en: en.shown.stance.value, ar: ar.shown.stance.value })],
  ['and it still offers every standard option, so the person can change it',
    ['competitor', 'partner_target', 'neutral'].every((o) => en.shown.stance.optionValues.indexOf(o) >= 0),
    JSON.stringify(en.shown.stance.optionValues)],
  ['the extra option says, in the page\'s own language, that it is what is on file',
    /on file/.test(en.shown.stance.selectedText) && /المسجَّل/.test(ar.shown.stance.selectedText),
    JSON.stringify({ en: en.shown.stance.selectedText, ar: ar.shown.stance.selectedText })],
  ['a yes/no field holding the word shows it too', en.shown.iata.value === 'No' && en.shown.replied.value === 'Yes — same day',
    JSON.stringify({ iata: en.shown.iata.value, replied: en.shown.replied.value })],
  ['an answer that IS one of the standard options is selected normally',
    en.shown.research_status.value === 'done' && en.shown.research_status.selectedText === 'done',
    JSON.stringify(en.shown.research_status)],
  /* the whole point: nothing is touched, Save is pressed, and the record is the same record */
  ['pressing Save without touching anything loses no answer, in either language',
    lost(en).length === 0 && lost(ar).length === 0, JSON.stringify({ en: lost(en), ar: lost(ar) })],
  ['and changes no answer either', changed(en).length === 0 && changed(ar).length === 0,
    JSON.stringify({ en: changed(en), ar: changed(ar) })],
  ['a yes that carries a detail is not flattened into a plain no',
    en.after.replied === 'Yes — same day' && ar.after.replied === 'Yes — same day', JSON.stringify(en.after.replied)],
  ['a number field holding something that is not a number keeps the words, never NaN',
    en.after.headcount === 'about 40' && ar.after.headcount === 'about 40',
    JSON.stringify({ en: en.after.headcount, ar: ar.after.headcount })],
  ['and a date field holding a month rather than a day keeps it too',
    en.after.deadline === 'March 2026' && ar.after.deadline === 'March 2026', JSON.stringify(en.after.deadline)],
  /* the other half of the same Save, fixed in round 42 and kept here because it is one code path */
  ['an answer whose field is no longer in the template still survives Save',
    en.after.legacy_note === STORED.legacy_note && ar.after.legacy_note === STORED.legacy_note, JSON.stringify(en.after.legacy_note)],
  ['the Arabic card reads a plain yes/no answer in Arabic',
    ar.card['اياتا'] === 'لا' && en.card.IATA === 'No',
    JSON.stringify({ ar: ar.card['اياتا'], en: en.card.IATA })],
  ['the box closed on Save', en.boxGone && ar.boxGone],
  /* Save is SUPPOSED to write — that is the whole point of the button, and every write here was
     intercepted so nothing left the sandbox. What this asserts is that the save path really ran:
     without it, "no answer was lost" could pass simply because nothing happened at all. */
  ['Save really tried to store the record, and the attempt went no further than this test',
    wrote.filter((w) => /businesses|save_state/.test(w)).length >= 2,
    JSON.stringify(wrote.filter((w) => !/finance_client_links/.test(w)).slice(0, 5))],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
