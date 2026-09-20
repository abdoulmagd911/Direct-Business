/* Structure tripwire. Run before any deploy: NODE_USE_ENV_PROXY=1 node check-structure.mjs
   (no network needed — it only reads files).

   Every rule here exists because its violation already happened and cost real time:
   inline-pasted layers gave the sidebar two Brand buttons and the Proposals page two
   identity banners; duplicate ids made layers fight; hidden <option>s still showed in
   Chrome's native dropdown. A doc rule did not stop the second occurrence. This does. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* 2026-09-18 (fire #92): this used to derive the repo root from the CURRENT DIRECTORY — it looked for
   index.html in `.` then `..`, so running it from anywhere else died on "ENOENT: /index.html" before
   checking a single rule. A pre-deploy gate that only works from one directory is a gate that can be
   skipped by accident. Its two sibling gates (check-decisions-wired, check-probe-integrity) already
   resolve the root from the file's OWN location; this now does the same, and works from anywhere. */
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const at = p => path.join(ROOT, p);
const problems = [];

const html = fs.readFileSync(at('index.html'), 'utf8');

/* 1 — no inline <script> bodies in index.html. Logic lives in js/ files, once. */
const inline = html.match(/<script>(?![\s\S]{0,40}src=)/g) || [];
if (inline.length) problems.push(`index.html contains ${inline.length} inline <script> block(s). Logic belongs in a js/ file — pasting it inline is how the app grew two identity banners.`);

/* 2 — no js file loaded twice */
const tags = [...html.matchAll(/src="(\/js\/[^"]+)"/g)].map(m => m[1]);
const dup = tags.filter((t, i) => tags.indexOf(t) !== i);
if (dup.length) problems.push('Duplicate <script src> tags: ' + [...new Set(dup)].join(', '));

/* 3 — every js file on disk is either loaded or deliberately not; every loaded file exists */
for (const t of tags) if (!fs.existsSync(at(t.slice(1)))) problems.push(`index.html loads ${t} but the file does not exist.`);

/* 4 — no two layers may define the same element id (the Brand-button collision class).
       Ids created via createElement/id= or getElementById guards are compared across files.
   Found in the 2026-08-17 audit: this only ever read js/, never js/core/ — so the two
   hardcoded-name violations sitting in js/core/core-06 and core-07 passed every run of this
   check silently. Both directories are scanned now, or a tripwire with a blind spot is worse
   than no tripwire: it says "clean" about a file it never looked at. */
const files = [
  ...fs.readdirSync(at('js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
  ...fs.readdirSync(at('js/core')).filter(f => f.endsWith('.js')).map(f => 'js/core/' + f),
];
const idOwner = {};
for (const f of files) {
  const src = fs.readFileSync(at(f), 'utf8');
  const ids = new Set([...src.matchAll(/\.id=['"]([A-Za-z_][\w-]{3,})['"]/g)].map(m => m[1]));
  for (const id of ids) {
    if (/^(v\d+|cl_|fl_|xp_|tm_|eb_|ei_|f_|x_|p_)/.test(id) === false) continue;   // app-made ids only
    if (idOwner[id] && idOwner[id] !== f) problems.push(`Element id "${id}" is created by two layers: ${idOwner[id]} and ${f}. Two layers drawing the same element is the duplicate-button disease.`);
    else idOwner[id] = f;
  }
}

/* 5 — no hidden-option trimming: Chrome's native dropdown shows hidden options anyway */
for (const f of files) {
  const src = fs.readFileSync(at(f), 'utf8');
  if (/option[^;\n]{0,60}\.hidden\s*=\s*true|o\.hidden=true/.test(src)) problems.push(`${f} hides <option>s instead of removing them — the OS dropdown shows hidden options.`);
  /* was one literal name; any person's name hardcoded into a record has the same failure
     shape, so this now matches the pattern, not the one name that happened to get caught. */
  if (/user\s*:\s*['"][A-Z][a-z]+(\s[A-Z][a-z]+)*['"]/.test(src)) problems.push(`${f} hard-codes a person's name into records — stamp the real signed-in user instead.`);
  if (/if\s*\(\s*!window\.DB\b/.test(src)) problems.push(`${f} guards on window.DB — DB is a top-level let, so that guard is always false and fails silently.`);
  /* 6 — no zero-argument createClient() calls. Found in the 2026-08-17 audit: if this is ever
     the first call on the page, before the login layer creates the real client, it builds a
     client with no project URL and no key and memoises that broken thing for everything after
     it. window.fc() (js/16) is the safe accessor — it never creates a client of its own. */
  if (/supabase\s*\.\s*createClient\s*\(\s*\)/.test(src)) problems.push(`${f} calls supabase.createClient() with no arguments — if this ever runs before the login layer, it builds a client with no URL and no key. Use window.fc() instead.`);
}

/* 7 — money lives on the Finance page only (owner ruling 2026-08-21). Leads and Clients
       report the RELATIONSHIP, never the money — that belongs on Finance, one company with
       its profiles nested underneath. Real violations shipped here twice already (a stale
       "Lifetime billed" chip, a proposal value span, a whole Finance panel with an inverted
       isClient check) because nothing scanned for it. Comments are stripped first so this
       checks live code, not the doc-comments explaining why a field was removed. */
const MONEY_FILES = ['js/core/core-02-leads.js', 'js/13-leads-list.js', 'js/28-lead-card.js', 'js/38-client-card.js'];
const MONEY_STRINGS = [' SAR', 'ريال', 'Lifetime billed', 'Open deal value', 'Deal value', 'Outstanding', 'Credit held'];
const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
for (const f of MONEY_FILES) {
  if (!fs.existsSync(at(f))) continue;
  const code = stripComments(fs.readFileSync(at(f), 'utf8'));
  for (const s of MONEY_STRINGS) {
    if (code.includes(s)) problems.push(`${f} contains "${s}" outside a comment — money belongs on Finance only, never on Leads or Clients (owner ruling 2026-08-21).`);
  }
}

/* RULE 8 — no NEW untranslated user-facing strings.
   Owner decision 2026-08-22: Arabic is translated in ONE sweep at the end of the build,
   not incrementally. That only stays cheap if the backlog does not grow in the meantime.
   So: any user-visible English literal added to a UI layer must go through the translator
   (t(...) / LANG check), or be listed in KNOWN_UNTRANSLATED below with a reason.
   This does NOT block today's build — it freezes the debt at its current, known size. */
const UI_LAYERS = ['js/04-ui-basics.js'];
// Strings already known-English and scheduled for the end-of-build sweep. Do not add to this
// list to silence a new violation — translate it instead.
const KNOWN_UNTRANSLATED = ['Show all', ' / page', '‹ Prev', 'Next ›', 'All'];
const UNTRANSLATED_HINT = /['"`](Show all|Prev|Next|Save|Cancel|Delete|Close|Search|Export|Filter|Loading|All)['"`]/g;
for (const f of UI_LAYERS) {
  if (!fs.existsSync(at(f))) continue;
  const code = stripComments(fs.readFileSync(at(f), 'utf8'));
  const hits = [...code.matchAll(UNTRANSLATED_HINT)].map(m => m[1]);
  for (const h of new Set(hits)) {
    const known = KNOWN_UNTRANSLATED.some(k => k.includes(h) || h.includes(k.trim()));
    if (!known) problems.push(`${f} adds a new untranslated user-facing string "${h}" — wrap it in the translator, or the end-of-build Arabic sweep grows (owner decision 2026-08-22).`);
  }
}

/* 8 — no raw control bytes in any source file (2026-09-02). js/65 shipped a binary-file
       detector whose regex character class contained LITERAL bytes 0x00/0x03/0x04/0x08/0x0e/0x1f
       instead of the escapes \\x00…; it worked in the browser, but every text tool then treated
       the file as binary — grep skipped it (so the rule-7 name sweep silently missed it), diff
       tools choke, editors may strip the bytes on save. Escapes only. */
const SOURCE_FILES = [...files, ...fs.readdirSync(at('scripts/qa')).filter(f => f.endsWith('.mjs')).map(f => 'scripts/qa/' + f)];
for (const f of SOURCE_FILES) {
  if (!fs.existsSync(at(f))) continue;
  const buf = fs.readFileSync(at(f));
  let bad = 0; for (const b of buf) if ((b >= 0x00 && b <= 0x08) || (b >= 0x0e && b <= 0x1f)) bad++;
  if (bad) problems.push(`${f} contains ${bad} raw control byte(s) (0x00–0x08 / 0x0e–0x1f). Write them as \\xNN escapes — a raw byte turns the file "binary" for grep/diff and can be stripped by an editor.`);
}

/* 9 — the harness's own finance fixture must obey the live money trigger (2026-09-02, round 38).
       finance_derive_fields() in Postgres defines, on every insert and update:
           revenue = total_incl_vat − wallet
           profit  = revenue − cost
       The seeded fixture used to store revenue = total − cost and profit = revenue instead, so
       12 of 17 rows broke the second rule and 13 broke the first. The Performance tiles then
       showed a Cost LARGER than Revenue — which reads as an app bug and was a fixture bug, and
       every finance probe in the harness was asserting against numbers no real invoice could
       have had. Checked here rather than in a probe because it needs no browser and it should
       block a deploy: a fixture that cannot exist makes every check standing on it meaningless.

       ONE DELIBERATE EXCEPTION: i-qa-vatclean, the VAT canary owned by probe-no-vat-display.
       It is built with revenue deliberately net of VAT to prove the app never shows a
       VAT-contaminated money figure (M1). Live has no VAT stored on any invoice, so the trigger
       never gets to disagree with it in practice. Do not "correct" it. */
try {
  const mockSrc = fs.readFileSync(at('scripts/qa/mock-supabase.mjs'), 'utf8');
  const CANARY = 'i-qa-vatclean';
  const rowRe = /\{[^{}]*?total_incl_vat_sar:\s*([^,]+?),\s*wallet_portion_sar:\s*([^,]+?),\s*revenue_sar:\s*([^,]+?),\s*cost_sar:\s*([^,]+?),\s*profit_sar:\s*([^,]+?),/g;
  let m, checked = 0;
  while ((m = rowRe.exec(mockSrc))) {
    const around = mockSrc.slice(Math.max(0, m.index - 200), m.index + 200);
    if (around.includes(CANARY)) continue;
    const [, tot, wal, rev, cost, prof] = m.map((x) => String(x).trim());
    checked++;
    // literal-number rows only; expression rows (_tot/_rev/_prof) are checked by their algebra below
    if (/^-?[0-9.]+$/.test(tot) && /^-?[0-9.]+$/.test(rev) && /^-?[0-9.]+$/.test(cost) && /^-?[0-9.]+$/.test(prof)) {
      const T = +tot, W = /^-?[0-9.]+$/.test(wal) ? +wal : 0, R = +rev, C = +cost, P = +prof;
      if (Math.abs(R - (T - W)) > 0.01) problems.push(`scripts/qa/mock-supabase.mjs: a finance_invoices fixture has revenue ${R} but total−wallet is ${T - W}. The live trigger would rewrite it — the fixture cannot exist.`);
      if (Math.abs(P - (R - C)) > 0.01) problems.push(`scripts/qa/mock-supabase.mjs: a finance_invoices fixture has profit ${P} but revenue−cost is ${R - C}. The live trigger would rewrite it — the fixture cannot exist.`);
    }
  }
  if (!checked) problems.push('scripts/qa/mock-supabase.mjs: could not find any finance_invoices fixture rows to check — the money-doctrine guard has stopped matching and is no longer protecting anything.');
  if (!/const _wal=0;const _rev=_tot-_wal;const _prof=_rev-_cost;/.test(mockSrc)) problems.push('scripts/qa/mock-supabase.mjs: the generated finance_invoices rows no longer derive revenue = total − wallet and profit = revenue − cost the way the live trigger does.');
} catch (e) {
  problems.push('money-doctrine check could not run: ' + e.message);
}

/* ---- every full-screen overlay must have a keyboard way out (added 2026-09-18, fire #92) ----
   Three separate overlays were found ignoring the Escape key in two consecutive rounds: js/57's
   confirm box and js/31's two panels (fire #91), then js/77's share panel (fire #92). The cause is
   structural, so it will keep happening: js/35's global handler, from 2026-08-08, only ever looks at
   `#modal` and calls closeModal(), so every layer that builds its own element has to wire the key
   itself — and nothing reminded anyone to.
   A file that creates a fixed, full-screen overlay of its own must therefore wire the key.
   TIGHTENED 2026-09-20 (fire #129), because the crude version of this rule was satisfied by a
   comment: it looked for the WORD "Escape" anywhere in the file, and js/16 contains "Cancel/Escape"
   in a note about js/57's pfPrompt twelve hundred lines above its own invoice box — the box with the
   Delete invoice button on it, which was measured live ignoring the key completely. A comment about a
   different box is not a handler. The test is now a real key comparison, and a box that genuinely
   must NOT be dismissible is judged in scripts/qa/overlays-without-escape.txt with its reason. That
   list gates both ways, like reports.txt and select-lists-judged.txt: an unlisted box with no handler
   fails, and a listed box that has since grown one fails too. */
try {
  const fs2 = fs; const jsDir = path.join(ROOT, 'js');
  const listPath = path.join(ROOT, 'scripts', 'qa', 'overlays-without-escape.txt');
  const judged = new Map();
  try {
    for (const line of fs2.readFileSync(listPath, 'utf8').split('\n')) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue;
      const [name, ...rest] = t.split('\t');
      judged.set(name.trim(), rest.join('\t').trim());
    }
  } catch (_) { problems.push('overlays-without-escape.txt is missing — the overlay rule needs it to know which boxes are deliberately not dismissible'); }
  const walk = (dir, pre) => fs2.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name), pre + d.name + '/') : (d.name.endsWith('.js') ? [pre + d.name] : []));
  const overlayFiles = walk(jsDir, '');
  const offenders = []; const seen = new Set();
  for (const f of overlayFiles) {
    const src = fs2.readFileSync(path.join(jsDir, f), 'utf8');
    /* its own overlay: a fixed element that covers the viewport, built in this file */
    const makesOverlay = /position:fixed;inset:0/.test(src) && /createElement\('div'\)|createElement\("div"\)/.test(src);
    if (!makesOverlay) continue;
    const key = f.includes('/') ? f : 'js/' + f;
    const name = f.includes('/') ? f.split('/').pop() : f;
    const handler = /key\s*===\s*['"]Escape['"]|keyCode\s*===\s*27/.test(src);
    const listedAs = judged.has(name) ? name : (judged.has(key) ? key : null);
    if (listedAs) { seen.add(listedAs);
      if (handler) offenders.push(key + ' is listed in overlays-without-escape.txt as a box that must NOT be dismissible, but it now wires the key — the entry is stale, remove it or the handler');
      if (!(judged.get(listedAs) || '').length) offenders.push(key + ' is listed in overlays-without-escape.txt with no reason written beside it');
      continue; }
    if (handler) continue;
    offenders.push(key + ' builds a full-screen overlay of its own and never compares a key to Escape, so a person cannot close it from the keyboard (js/35\'s global handler only covers #modal) — wire it, or judge it in scripts/qa/overlays-without-escape.txt');
  }
  for (const name of judged.keys()) if (!seen.has(name)) offenders.push(name + ' is judged in overlays-without-escape.txt but no longer builds a full-screen overlay — remove the stale entry');
  if (offenders.length) problems.push('overlay Escape rule: ' + offenders.join(' · '));
} catch (e) {
  problems.push('overlay-escape check could not run: ' + e.message);
}

/* ---- a money document is never served by a permanent public address (added 2026-09-20, #133) ----
   payment-proofs and expenses — the buckets holding proof of real payments and real receipts —
   were marked public AND had a read policy with no condition, so an unauthenticated caller could
   list them and fetch anything in them for ever. Measured before it was changed: the anonymous list
   call returned 200 on both. Nothing real was exposed, because every file in them was a zero-byte
   placeholder; the door was simply open in front of a feature about to hold real receipts.
   company-docs, written later, already had the right shape and js/66 says so in its own comment:
   a private bucket and a link that expires. The buckets are fixed; this stops the CODE half coming
   back, because `getPublicUrl` on one of these three silently re-opens it the moment somebody
   writes it. Other buckets (site, app, ksa-events-app, and proposals, whose address is stored in
   the offer record by design) are untouched by this rule. */
try {
  const PRIVATE_BUCKETS = ['payment-proofs', 'expenses', 'company-docs'];
  const jsDir2 = path.join(ROOT, 'js');
  const walk2 = (dir, pre) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk2(path.join(dir, d.name), pre + d.name + '/') : (d.name.endsWith('.js') ? [pre + d.name] : []));
  const bad = [];
  for (const f of walk2(jsDir2, '')) {
    const src = fs.readFileSync(path.join(jsDir2, f), 'utf8');
    for (const line of src.split('\n')) {
      if (line.trim().startsWith('/*') || line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
      if (!/getPublicUrl/.test(line)) continue;
      const hit = PRIVATE_BUCKETS.find((b) => line.includes("'" + b + "'") || line.includes('"' + b + '"'));
      if (hit) bad.push('js/' + f + " builds a permanent public address for the '" + hit + "' bucket — that bucket holds documents for real money and is private; use createSignedUrl(path, 600) the way js/66 does");
    }
  }
  if (bad.length) problems.push('money-document buckets: ' + bad.join(' · '));
} catch (e) {
  problems.push('private-bucket check could not run: ' + e.message);
}

/* ---- every date, time and number must name its language (added 2026-09-18, fire #94) ----
   toLocaleString(), toLocaleDateString(undefined, …) and toLocaleTimeString([], …) do not mean
   English. They mean "whatever language this laptop is set to". Driven for real against the live
   database: with the app in ENGLISH in a browser set to Arabic, a lead's detail page printed its
   dates as the HIJRI year in Arabic-Indic digits, and the client-facing quotation printed its option
   totals as "١٬٢٣٤٬٥٦٧٫٥" beside a headline total in Western digits — one price document, two number
   systems, chosen by whose machine opened it.
   The app has its own language switch; the browser's is nobody's business. So every one of these
   three calls must name a locale. Like the Escape rule above, this has one right answer, which is
   why it can be a gate at all: correct code always names a language, so there is nothing for it to
   flag falsely. Files under js/ only — scripts/ and docs are not shipped to a browser. */
try {
  const fs3 = fs;
  const roots = [path.join(ROOT, 'js'), path.join(ROOT, 'js', 'core')];
  const bad = [];
  const RX = /\.toLocale(?:String|DateString|TimeString)\(\s*(?:\)|undefined\b|\[\s*\])/;
  for (const dir of roots) {
    let names = []; try { names = fs3.readdirSync(dir).filter((f) => f.endsWith('.js')); } catch (_) { continue; }
    for (const f of names) {
      const src = fs3.readFileSync(path.join(dir, f), 'utf8');
      src.split('\n').forEach((line, i) => {
        if (/^\s*(\/\*|\*|\/\/)/.test(line)) return;   /* a comment explaining the rule is not a breach of it */
        if (RX.test(line)) bad.push(path.relative(ROOT, path.join(dir, f)) + ':' + (i + 1));
      });
    }
  }
  if (bad.length) problems.push('these lines format a date, time or number without naming a language, so the employee\'s own browser decides the digits — an Arabic-set laptop prints Hijri dates and Arabic-Indic numerals inside the English app: ' + bad.join(', '));
} catch (e) {
  problems.push('locale-named check could not run: ' + e.message);
}

/* ---- "today" must be the user's today, not UTC (added 2026-09-18, fire #95) ----
   `new Date().toISOString().slice(0,10)` is the date in UTC. The team works in Riyadh, UTC+3, so
   from midnight to 3am local it is yesterday's date — and it was being used for every "due today /
   overdue" comparison, every pre-filled date box and every "recorded on" stamp, 70 places in all,
   while the Today header printed the real local date beside them. Driven live at 01:13 Riyadh: the
   app called today "2026-09-18" under a header reading "19 Sept 2026".
   core-01's todayISO() reads the browser's own calendar instead. Like the Escape rule and the
   named-locale rule above, this class has exactly one right answer, so the gate has no correct code
   to flag falsely: converting a STORED instant still uses toISOString and is untouched here,
   because only the no-argument `new Date()` form means "now".
   js/65 is exempt BY STANDING RULE, not because it is right: it is the oversight lane, which this
   session may read and test but never edit. Its three uses build a batch LABEL
   ("dp-import-2026-09-18"), not a business date, so the exemption costs nothing — but it is an
   exemption, and it is written down here rather than left to look like an oversight. */
try {
  const fs4 = fs;
  const roots = [path.join(ROOT, 'js'), path.join(ROOT, 'js', 'core')];
  const bad = [];
  /* only the form that CUTS A DATE OUT of the timestamp. A whole `new Date().toISOString()` is an
     instant, not a calendar date, and is correct as it stands — flagging it would be a false
     positive on 39 lines that are perfectly fine, which is exactly what disqualified the M1 rule
     measured in fire #93. */
  const RX = /new Date\(\)\.toISOString\(\)\s*\.\s*(?:slice|substr(?:ing)?)\(\s*0\s*,\s*10\s*\)|new Date\(\)\.toISOString\(\)\s*\.\s*split\(\s*['"`]T['"`]\s*\)\s*\[\s*0\s*\]/;
  for (const dir of roots) {
    let names = []; try { names = fs4.readdirSync(dir).filter((f) => f.endsWith('.js')); } catch (_) { continue; }
    for (const f of names) {
      if (/^js\/6[25]-/.test(path.relative(ROOT, path.join(dir, f)))) continue;   /* the oversight lane */
      const src = fs4.readFileSync(path.join(dir, f), 'utf8');
      src.split('\n').forEach((line, i) => {
        if (/^\s*(\/\*|\*|\/\/)/.test(line)) return;
        if (RX.test(line)) bad.push(path.relative(ROOT, path.join(dir, f)) + ':' + (i + 1));
      });
    }
  }
  if (bad.length) problems.push('these lines take today\'s date from UTC instead of the user\'s own calendar (use todayISO()) — in Riyadh that is yesterday from midnight to 3am, on comparisons, pre-filled date boxes and stamps alike: ' + bad.join(', '));
} catch (e) {
  problems.push('today-from-UTC check could not run: ' + e.message);
}

/* ---- every dropdown that shows a stored value must have been judged (added 2026-09-21, fire #123) ----
   A <select> whose option list does not contain the value it was handed selects its FIRST option,
   and a Save that reads the box writes that first option back. This codebase has been bitten by it
   five times, each found by hand a round apart: round 30 (the access matrix calling unknown roles
   "Admin"), fire #115 (the funnel form deleting answers), fire #116 (all 108 companies losing where
   they came from), fire #119 (nineteen companies filed as ministries).
   The gate does not try to decide which are dangerous — that needs the live data. It finds every
   dropdown of the shape and requires each to carry a written verdict in
   scripts/qa/select-lists-judged.txt, so the sixth is judged when it is written. It gates BOTH
   ways, like reports.txt: an unjudged dropdown fails, and so does a judged one that no longer
   exists, because a stale entry is as misleading as a missing one.
   A box that carries an empty option (the fix applied in #115/#116/#119/#121) drops out of the scan
   by itself, which is how the list shrank from 45 to 41. */
try {
  const JUDGED = at('scripts/qa/select-lists-judged.txt');
  const judged = new Set(fs.readFileSync(JUDGED, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(':').slice(0, 2).join(':').trim()));
  const SEL = /<select\b[\s\S]*?<\/select>/g;
  const found = new Set();
  const srcFiles = files.filter((f) => /\.js$/.test(f)).concat(['index.html']);
  for (const rel of srcFiles) {
    let src = ''; try { src = fs.readFileSync(at(rel), 'utf8'); } catch (_) { continue; }
    const base = rel.split('/').pop();
    let m;
    while ((m = SEL.exec(src))) {
      const blk = m[0];
      if (blk.length > 6000 || !blk.includes('selected') || !blk.includes('.map(')) continue;
      if (/value=(""|'')/.test(blk)) continue;                 /* has an empty option — safe */
      const fld = blk.match(/\b([a-zA-Z_]\w*\.\w+)\s*(?:===|==)/);
      if (!fld) continue;                                      /* nothing compared to a record */
      const idm = blk.match(/id=["']?([a-zA-Z_0-9]+)/);
      found.add(base + ':' + (idm ? idm[1] : fld[1]));
    }
  }
  const unjudged = [...found].filter((k) => !judged.has(k)).sort();
  const stale = [...judged].filter((k) => !found.has(k)).sort();
  if (unjudged.length) problems.push('these dropdowns show a stored value with no empty option and no written verdict — judge each one in scripts/qa/select-lists-judged.txt (is it a FILTER, is every live value IN-LIST, or does it edit a record type with NO-ROWS yet?): ' + unjudged.join(', '));
  if (stale.length) problems.push('scripts/qa/select-lists-judged.txt judges dropdowns that no longer match — delete these lines, a stale entry is as misleading as a missing one: ' + stale.join(', '));
} catch (e) {
  problems.push('judged-dropdowns check could not run: ' + e.message);
}

if (problems.length) {
  console.log('STRUCTURE CHECK FAILED — fix these before deploying:\n');
  problems.forEach(p => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log(`structure OK · ${tags.length} script files, no inline logic, no duplicate ids, no known landmine patterns`);
process.exit(0);
