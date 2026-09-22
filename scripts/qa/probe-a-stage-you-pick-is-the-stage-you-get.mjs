/* probe-a-stage-you-pick-is-the-stage-you-get.mjs — the app never offers a stage it cannot keep,
   and its own stage-change entries read as words in both languages.

   Fire #198, two findings from one drive against the live database.

   ONE — a choice that does not stick. The record page offered seven stages. Captured on the wire
   (every write intercepted, never forwarded): picking **Negotiation** sends `in_discussion`, and
   `in_discussion` reads back as **"Qualified"**. The word a person deliberately chose is replaced
   by a different one on the next load, silently. `stageToApp`'s `prev` argument cannot rescue it,
   because the save writes `stage` to the COLUMN only and never into the record's raw blob — checked
   against the data rather than assumed: 27 of the 108 live records carry a stage word in their
   blob and every one reads Won/won/Lost, never a round-trip word. "On hold" has the same shape
   (`on_hold` → "Prospect"), latent today because no live record is on hold.
   The fix puts the question where the two conversion maps live — `stageKeepable(word)` in js/02,
   which asks whether a word survives a save and a reload — and the three places a person can SET a
   stage offer only words that pass. `LEAD_STAGES` itself is untouched on purpose: `leadSortVal`
   and `leadScore` both read positions out of it, so dropping an entry would quietly move every
   later stage's score, and a record already carrying Negotiation must still draw with its own
   colour and its own place in the row.

   TWO — my own previous round's gap, found by the same drive. Fire #197 keyed the activity words
   against the values in the `activities` TABLE, where a stage change is `stage_change`. The app
   writes its own stage changes into the record's blob as **"Stage change"** — a space, not an
   underscore — so `setLeadStage`'s entries missed the fix of one round earlier and would have read
   English in Arabic the first time anyone advanced a lead. It stayed invisible because nobody had
   moved a stage through the app since the data was rebuilt, so the live table held none. Separators
   are normalised now, in both the label helper and the timeline's from → to rendering.

   What this holds:
     1. for a record on an ordinary stage, every stage the page offers survives a save and a
        reload — asked of the app's own conversion maps, not a list copied into this probe;
     2. "Negotiation" is offered by none of the three places a person can set a stage;
     3. a record that ALREADY carries Negotiation still displays it — this governs choosing, not
        displaying, and a fix that hid existing data would be worse than the defect;
     4. the app's own "Stage change" entry reads as a phrase in both languages, never as itself;
     5. …and keeps the from → to rendering that makes it worth reading;
     6. the pickers still offer the real stages — at least five, including Won and Lost;
     7. if `stageKeepable` is unavailable the pickers fall back to the full list rather than
        emptying, so a load-order accident cannot leave someone unable to set any stage at all;
     8. every screen word the conversion maps recognise reports its own record in the picker —
        added in fire #202, which measured all nine and found **"New" and "On hold"** drawing a
        dropdown without their own stage, so the browser selected the first option and the page
        said "Prospect". Pre-existing rather than introduced by #198: neither word has ever been in
        LEAD_STAGES, so the picker never held them before that round either;
     9. a word LEAD_STAGES never listed is shown only on the record that carries it, never offered
        to a record that does not;
    10. no JS errors in either language.

   Checks 3, 6 and 7 are the brakes. Deleting the stage vocabulary outright would pass 1, 2, 4 and
   5 and fail 6 and 7; hiding every record that carries an awkward word would pass 1 and 2 and fail
   3. Check 1 is deliberately computed from `window.stageKeepable` rather than a hardcoded list, so
   a future word added to the maps is held to the same rule without editing this file.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both runs real:
     · pointing the record's stage select back at `LEAD_STAGES` — fails 1 and 2. Check 2 also shows
       which picker was broken: the modal's list stays correct while the select's does not.
     · removing the separator normalisation from both sites — fails 4 alone. Check 5 survives it,
       and the reason is worth stating rather than leaving as a surprise: the "Contacted → Qualified"
       text comes from the entry's own note, so it is still on screen even when the LABEL above it
       has fallen back to the raw stored type. Check 5 guards the rendering, check 4 guards the word.
   Fire #202 added two more runs for checks 8 and 9:
     · removing the branch that shows a word LEAD_STAGES never listed — fails 8, and the printed
       line is the defect itself: New and On hold both read "shows: Prospect".
     · appending "On hold" to every picker unconditionally — fails 9 and also **1**, the deeper
       reason being that the leaked word does not survive a save at all.
   One sabotage attempt in between failed to break anything and is recorded because the lesson is
   the same discipline: it set `current = current || 'On hold'`, and `current` is already truthy on
   an ordinary record, so nothing leaked. A sabotage that changes nothing proves nothing about the
   check — read what it actually did before reading the result.
   Run: node scripts/qa/probe-a-stage-you-pick-is-the-stage-you-get.mjs                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9231 — one mock. */
const PORT = 9231; const BASE = 'http://localhost:' + PORT;

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

/* one lead already carrying Negotiation, and one carrying the app's own stage-change entry */
const seeded = await p.evaluate(() => {
  const B = DB.businesses || [];
  const src = B.find((x) => !x.isClient) || B[0];
  if (!src) return { ok: false };
  const mk = (id, name, extra) => {
    const c = JSON.parse(JSON.stringify(src));
    c.id = id; c.isClient = false; c.name = name; c.nameAr = name; if (c.raw) c.raw = {};
    return Object.assign(c, extra);
  };
  B.push(mk('qa_stage_neg', 'QASTAGE neg', { stage: 'Negotiation', activities: [] }));
  /* fire #202: the two screen words the conversion maps know that LEAD_STAGES never listed */
  B.push(mk('qa_stage_new', 'QASTAGE new', { stage: 'New', activities: [] }));
  B.push(mk('qa_stage_hold', 'QASTAGE hold', { stage: 'On hold', activities: [] }));
  B.push(mk('qa_stage_sc', 'QASTAGE sc', { stage: 'Contacted', activities: [
    { date: Date.now(), type: 'Stage change', status: 'Qualified', note: 'Contacted → Qualified', by: 'qa' }] }));
  return { ok: true };
});
await p.waitForTimeout(400);

const openRecord = async (id) => { await p.evaluate((x) => { try { openLead = x; current = 'leads'; render(); } catch (_) {} }, id); await p.waitForTimeout(2600); };
const setLang = async (l) => { await p.evaluate((x) => { try { LANG = x; if (typeof applyLang === 'function') applyLang(); } catch (_) {} }, l); await p.waitForTimeout(800); };

/* every word the three setters offer, read off the screen */
const offered = async (id) => {
  await openRecord(id);
  const fromPage = await p.evaluate(() => {
    const sel = [...document.querySelectorAll('#view select')].find((s) => String(s.getAttribute('onchange') || '').indexOf('setLeadStage') >= 0);
    const btns = [...document.querySelectorAll('#view button')].filter((x) => String(x.getAttribute('onclick') || '').indexOf('setLeadStage') >= 0)
      .map((x) => (x.textContent || '').trim());
    return { select: sel ? [...sel.options].map((o) => o.value) : null, buttons: btns };
  });
  /* the modal's "Move stage to" */
  const modal = await p.evaluate((x) => {
    try { if (typeof logActivity === 'function') { logActivity(x); } } catch (_) {}
    try {
      const s = document.getElementById('a_status');
      return s ? [...s.options].map((o) => o.value).filter(Boolean) : null;
    } catch (_) { return null; }
  }, id);
  await p.evaluate(() => { try { if (typeof closeModal === 'function') closeModal(); } catch (_) {} });
  await p.waitForTimeout(500);
  return { select: fromPage.select, buttons: fromPage.buttons, modal };
};

/* Checks 1, 2, 6 and 7 ask about a record on an ORDINARY stage. Asking them of the Negotiation
   record would be asking the wrong question: that record's own stage is deliberately included, so
   the answer would say "Negotiation is offered" and mean nothing. The first run of this probe did
   exactly that and reported the fix broken. One record per question. */
const picks = await offered('qa_stage_sc');

/* does each offered word survive a save and a reload? asked of the app's own maps */
const roundTrip = await p.evaluate((words) => {
  const out = {};
  (words || []).forEach((w) => {
    let keep = null;
    try { keep = (typeof window.stageKeepable === 'function') ? window.stageKeepable(w) : null; } catch (_) { keep = 'THREW'; }
    out[w] = keep;
  });
  return out;
}, picks.select || []);

/* a record already carrying Negotiation still shows it */
await openRecord('qa_stage_neg');
const existingShown = await p.evaluate(() => {
  const v = document.querySelector('#view'); const t = v ? (v.innerText || '') : '';
  const sel = [...document.querySelectorAll('#view select')].find((s) => String(s.getAttribute('onchange') || '').indexOf('setLeadStage') >= 0);
  return { onScreen: t.indexOf('Negotiation') >= 0, selectValue: sel ? sel.value : null,
    appStage: (function () { try { return (DB.businesses || []).find((x) => x.id === 'qa_stage_neg').stage; } catch (_) { return null; } })() };
});

/* the app's own stage-change entry, both languages */
const scIn = async (lang) => {
  await setLang(lang);
  await openRecord('qa_stage_sc');
  return p.evaluate(() => {
    const v = document.querySelector('#view'); const t = v ? (v.innerText || '') : '';
    /* "Stage changed" CONTAINS "Stage change", so a substring test on the page text reports the
       raw type present whenever the fix is working. The first run of this probe did exactly that
       and called English a failure. The raw type is a LABEL, so look at the labels: the entry's
       own bold word must not be the stored type verbatim. */
    const labels = [...v.querySelectorAll('b')].map((el) => (el.textContent || '').trim());
    return { raw: labels.indexOf('Stage change') >= 0,
      phrase: labels.some((x) => x === 'Stage changed' || x === 'تغيّرت المرحلة'),
      fromTo: /Contacted\s*→\s*Qualified|تم التواصل\s*→|→\s*مؤهل/.test(t) };
  });
};
const scEn = await scIn('en');
const scAr = await scIn('ar');
await setLang('en');

/* BRAKE: with stageKeepable gone the pickers must fall back, not empty */
await p.evaluate(() => { try { window.__keepBackup = window.stageKeepable; delete window.stageKeepable; } catch (_) {} });
const fallback = await offered('qa_stage_sc');
await p.evaluate(() => { try { window.stageKeepable = window.__keepBackup; } catch (_) {} });

/* fire #202 — every screen word the maps recognise must report its own record, including the two
   LEAD_STAGES never listed. Asked of the app (stageIsKnown) rather than from a list copied here. */
const KNOWN = await p.evaluate(() => {
  const words = ['Prospect', 'New', 'Contacted', 'Qualified', 'Negotiation', 'Proposal', 'Won', 'Lost', 'On hold'];
  try { return words.filter((w) => typeof window.stageIsKnown === 'function' ? window.stageIsKnown(w) : true); } catch (_) { return words; }
});
const selfReport = [];
for (const [id, word] of [['qa_stage_new', 'New'], ['qa_stage_hold', 'On hold'], ['qa_stage_neg', 'Negotiation']]) {
  await openRecord(id);
  const r = await p.evaluate(() => {
    const sel = [...document.querySelectorAll('#view select')].find((s) => String(s.getAttribute('onchange') || '').indexOf('setLeadStage') >= 0);
    const b = (DB.businesses || []).find((x) => x.id === openLead);
    return { stage: b ? b.stage : null, shows: sel ? sel.value : null, options: sel ? [...sel.options].map((o) => o.value) : [] };
  });
  selfReport.push({ word, stage: r.stage, shows: r.shows, ok: r.stage === r.shows, count: r.options.length });
}
/* and the borrowed word must not be offered to a record that does not carry it */
const ordinaryOffers = (await offered('qa_stage_sc')).select || [];

await b.close(); srv.close?.();

const sel = picks.select || [];
const checks = [
  ['every stage the record page offers survives a save and a reload',
    sel.length > 0 && sel.every((w) => roundTrip[w] === true),
    JSON.stringify(roundTrip)],
  ['"Negotiation" is offered by none of the three places a person can set a stage',
    sel.indexOf('Negotiation') < 0 && (picks.buttons || []).indexOf('Negotiation') < 0 &&
    (picks.modal || []).indexOf('Negotiation') < 0,
    JSON.stringify({ select: sel, buttons: picks.buttons, modal: picks.modal })],
  ['a record that already carries Negotiation still displays it',
    existingShown.appStage === 'Negotiation' && existingShown.onScreen === true,
    JSON.stringify(existingShown)],
  ['the app\'s own "Stage change" entry reads as a phrase in both languages, never as itself',
    scEn.phrase === true && scEn.raw === false && scAr.phrase === true && scAr.raw === false,
    JSON.stringify({ en: scEn, ar: scAr })],
  ['…and keeps the from → to rendering', scEn.fromTo === true && scAr.fromTo === true,
    JSON.stringify({ en: scEn.fromTo, ar: scAr.fromTo })],
  ['the pickers still offer the real stages',
    sel.length >= 5 && sel.indexOf('Won') >= 0 && sel.indexOf('Lost') >= 0,
    sel.length + ' offered: ' + JSON.stringify(sel)],
  ['with stageKeepable unavailable the pickers fall back to the full list, not to nothing',
    (fallback.select || []).length >= sel.length && (fallback.select || []).indexOf('Negotiation') >= 0,
    JSON.stringify(fallback.select)],
  ['every screen word the maps recognise reports its own record in the picker',
    selfReport.length === 3 && selfReport.every((x) => x.ok),
    JSON.stringify(selfReport)],
  ['a word LEAD_STAGES never listed is shown only on the record that carries it',
    ordinaryOffers.indexOf('New') < 0 && ordinaryOffers.indexOf('On hold') < 0 && ordinaryOffers.indexOf('Negotiation') < 0,
    JSON.stringify(ordinaryOffers)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
if (!seeded.ok) { console.log('FAIL · the fixture did not seed'); bad++; }
process.exit(bad ? 1 : 0);
