/* probe-one-arabic-word-per-thing.mjs — the Arabic dictionary does not answer one English thing
   with two different words, unless somebody has written down why.

   Fire #225. Found by driving the Leads page in Arabic: the page's primary action button read
   «+ عمل جديد» — "new work", "new job" — while the dialog it opens is titled «جهة جديدة» and that
   dialog's first field is «اسم الجهة». Three words for one object on the busiest page, and the one
   on the button was the odd one out: a record here is a company, not a job.

   Scanning the whole dictionary the same way turned up one more: "Chain of command" was «سلسلة
   القرار» in one place and «تسلسل المسؤولية» in another, while the BUTTON a person actually presses
   on a client card says «التسلسل الإداري». Both now match the button — the word you click should be
   the word you read.

   Everything else the scan finds is correct Arabic, and the list below says so one by one. This is
   the point of the probe: it is not "no duplicates", which would be wrong, but "no duplicate that
   nobody has accounted for". A new divergence fails; a deliberate one is added to ALLOWED with its
   reason, which is a sentence somebody has to write.

   What this holds:
     1. every English label the dictionary translates twice is either identical in Arabic or listed
        in ALLOWED with a reason;
     2. the two this fire fixed stay fixed — a button and the dialog it opens use the same word;
     3. the dictionary is still big enough to be the real one (a truncated read must not pass);
     4. ALLOWED does not rot: an entry that no longer matches anything is reported, so the list
        cannot quietly grow into a blanket exemption.
   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · putting «+ عمل جديد» back on the button — fails 1 and 2, printing both words side by side;
     · translating "Notes" as «تعليقات» in one place and «ملاحظات» in another — a word this fire
       never touched — fails 1. That second run is the one that matters: it shows the check holds
       the whole class, not just the two labels it was written for.
   Run: node scripts/qa/probe-one-arabic-word-per-thing.mjs                                        */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* Deliberate, each with the reason. Keys are the normalised English. */
const ALLOWED = {
  'booking':          'a heading («الحجز», definite) and a button («+ حجز», indefinite)',
  'client':           'definite «العميل» in a fact row, indefinite «عميل» in a badge',
  'email':            'the full «البريد الإلكتروني» and the short «البريد» for a narrow column',
  'open':             '«مفتوحة» is the state of a request; «فتح» is the verb on a button',
  'overdue':          'Arabic adjectives agree in gender — متأخر with a masculine noun, متأخرة with a feminine one',
  'paid':             'same agreement: مدفوع / مدفوعة',
  'standard':         'same agreement: قياسي / قياسية',
  'target':           '«مستهدف» is the adjective on a badge; «الهدف» is the noun in a report column',
  'void':             '«الإبطال» names the airline rule (a column); «ملغاة» is a status on a ticket',
};

/* The app root is this file's own tree — scripts/qa/.. /.. — so the probe runs wherever the
   repository is checked out; APP_DIR points it at a COPY for a sabotage run, the same way the
   browser probes are pointed. (check-probe-integrity refuses a hardcoded absolute path, rightly.) */
const ROOT = process.env.APP_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'js', '21-v27-arabic-column-header-stat-label-transl.js');
const src = fs.readFileSync(SRC, 'utf8');
const pairs = [];
const re = /'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g;
let m;
while ((m = re.exec(src))) {
  const en = m[1], ar = m[2];
  if (!/[A-Za-z]/.test(en)) continue;
  if (!/[؀-ۿ]/.test(ar)) continue;
  pairs.push({ en, ar });
}
const DECOR = /^[\s+★☆⚠✓✕⧉↩↪⤷∑📊📥📦🧹🔄🎯💰📈🌐👤🏛🎪🖨💬🧾▸▾›‹→←]+/;
const TAIL = /[\s.:·…]+$/;
const norm = (s) => String(s).replace(DECOR, '').replace(TAIL, '').trim().toLowerCase();
const normAr = (s) => String(s).replace(DECOR, '').replace(TAIL, '').trim();

const byEn = {};
pairs.forEach((p) => { const k = norm(p.en); if (!k) return; (byEn[k] = byEn[k] || []).push(p); });

const divergent = [];
Object.keys(byEn).forEach((k) => {
  const set = [...new Set(byEn[k].map((p) => normAr(p.ar)))];
  if (set.length > 1) divergent.push({ k, set, rows: byEn[k] });
});
const unexplained = divergent.filter((d) => !ALLOWED[d.k]);
const staleAllowed = Object.keys(ALLOWED).filter((k) => !divergent.some((d) => d.k === k));

const has = (en, ar) => pairs.some((p) => p.en === en && p.ar === ar);
const bad = [];
const check = (name, ok, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + name + (detail ? ' — ' + detail : '')); if (!ok) bad.push(name); };

check('every English label translated twice is identical in Arabic, or listed with a reason',
  unexplained.length === 0,
  unexplained.length ? JSON.stringify(unexplained.map((d) => ({ en: d.k, arabic: d.set }))) : String(divergent.length) + ' accounted for');
check('the button and the dialog it opens use the same word',
  has('+ New business', '+ جهة جديدة') && has('New business', 'جهة جديدة'),
  JSON.stringify(pairs.filter((p) => /New business/.test(p.en)).map((p) => p.en + ' → ' + p.ar)));
check('"Chain of command" has one wording, and it is the one on the button',
  pairs.filter((p) => p.en === 'Chain of command').every((p) => p.ar === 'التسلسل الإداري') &&
  pairs.some((p) => p.en === 'Chain of command'),
  JSON.stringify([...new Set(pairs.filter((p) => p.en === 'Chain of command').map((p) => p.ar))]));
check('the dictionary really was read (a truncated file must not pass)',
  pairs.length > 600, pairs.length + ' translated labels');
check('no entry in ALLOWED has stopped matching anything',
  staleAllowed.length === 0, staleAllowed.length ? JSON.stringify(staleAllowed) : 'all ' + Object.keys(ALLOWED).length + ' still apply');

process.exit(bad.length ? 1 : 0);
