/* probe-messages-bilingual.mjs — guards the 2026-09-18 (fire #88) change across six files.
   Found while running the statement-of-account dialog to ground: it never opens against live data,
   because there are 0 invoices, and what a person actually gets instead is the sentence
   "No invoices for this client." — in English, in an Arabic session. Counting the class turned up
   SEVENTEEN such messages, in core-01, core-04, core-06, core-08, core-10 and js/02. They are the last
   thing somebody reads when something does not work — a blocked pop-up, an unlinked proposal, a file
   that would not import, a missing email address — and every one of them spoke only English.

   This is about the WORDS, not the box. A native alert() is this app's house style for a message and is
   used about 150 times; what was banished, and stays banished, is native confirm(), which freezes the
   whole tab — probe-no-native-dialogs guards that, and nothing here changes it.

   WHY THIS PROBE READS THE SOURCE RATHER THAN DRIVING, said plainly instead of implied: each of these
   messages sits behind a state that cannot be manufactured honestly — a browser that really blocks a
   pop-up, a file that really fails to parse, a statement whose client really has no invoices. Three
   different drives were tried against the seeded data and not one produced a single message. The defect
   itself, though, IS in the source: a message written with only one language in it. So the source is
   what is checked, across all eleven core and login files, and that catches every message including the
   ones no drive could reach. If a future round finds a reliable way to click one of these into
   existence, add it here rather than replacing this.

   Sabotage-tested: with the six files' edits stashed, 3 checks go FAIL, exit 1 — 17 English-only
   messages reappear, the bilingual count collapses, and the statement message is among the missing.
   Run: node scripts/qa/probe-messages-bilingual.mjs                                                   */
import fs from 'fs';
const AR = /[؀-ۿ]/;
const FILES = ['js/core/core-01-foundation.js', 'js/core/core-02-leads.js', 'js/core/core-03-reference-ops.js',
  'js/core/core-04-proposals.js', 'js/core/core-05-records.js', 'js/core/core-06-v18-v21.js',
  'js/core/core-07-v22-v24.js', 'js/core/core-08-v25.js', 'js/core/core-09-v26.js',
  'js/core/core-10-v29-reports.js', 'js/02-direct-business-cloud-layer-login-shared-c.js'];

const englishOnly = [], bilingual = [], badForm = [];
for (const f of FILES) {
  const src = fs.readFileSync(f, 'utf8'); const short = f.split('/').pop();
  /* a message written as a bare literal: alert('…') with nothing else in the call */
  const bare = /alert\((['"])((?:(?!\1)[^\\]|\\.)*)\1\)/g; let m;
  while ((m = bare.exec(src))) { const msg = m[2];
    if (!/[A-Za-z]/.test(msg)) continue;            // a code or a symbol, not a sentence
    if (AR.test(msg)) continue;                      // already Arabic
    englishOnly.push(short + ': ' + msg.slice(0, 60)); }
  /* a message written the app's way: alert(<language test> ? '<arabic>' : '<english>') */
  const pair = /alert\(\(typeof LANG!=='undefined'&&LANG==='ar'\)\?(['"])((?:(?!\1)[^\\]|\\.)*)\1:(['"])((?:(?!\3)[^\\]|\\.)*)\3\)/g;
  while ((m = pair.exec(src))) { const ar = m[2], en = m[4];
    bilingual.push({ file: short, ar, en });
    if (!AR.test(ar)) badForm.push(short + ': the Arabic side has no Arabic in it — ' + ar.slice(0, 50));
    else if (!en.trim() || !ar.trim()) badForm.push(short + ': one side of the pair is empty');
    else if (ar === en) badForm.push(short + ': both sides are the same string — ' + en.slice(0, 50)); }
}
/* the message this round started from, and five others a person meets often */
const has = (en) => bilingual.some((b) => b.en === en);
const WANT = ['No invoices for this client.', 'Pop-up blocked.', 'Enter their email address.',
  'Invalid file.', 'Pick a project.', 'Linked lead not found.'];
const missing = WANT.filter((w) => !has(w));

const checks = [
  ['every one of the eleven core and login files was read', FILES.every((f) => fs.existsSync(f))],
  ['no message in those files is written in English only', englishOnly.length === 0],
  ['the seventeen rewritten messages are all there, each carrying both languages', bilingual.length >= 17],
  ['no pair is malformed — empty, duplicated, or with no Arabic on the Arabic side', badForm.length === 0],
  ['the message this round started from is among them, in both languages', missing.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
console.log(`(${bilingual.length} bilingual message(s); ${englishOnly.length} English-only)`);
if (fail) { console.log('detail:', JSON.stringify({ englishOnly: englishOnly.slice(0, 25), badForm, missing, bilingualCount: bilingual.length }, null, 1)); }
process.exit(fail ? 1 : 0);
