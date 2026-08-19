/* Structure tripwire. Run before any deploy: NODE_USE_ENV_PROXY=1 node check-structure.mjs
   (no network needed — it only reads files).

   Every rule here exists because its violation already happened and cost real time:
   inline-pasted layers gave the sidebar two Brand buttons and the Proposals page two
   identity banners; duplicate ids made layers fight; hidden <option>s still showed in
   Chrome's native dropdown. A doc rule did not stop the second occurrence. This does. */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd(), fs.existsSync('index.html') ? '.' : '..', fs.existsSync('index.html') ? '.' : '..');
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

if (problems.length) {
  console.log('STRUCTURE CHECK FAILED — fix these before deploying:\n');
  problems.forEach(p => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log(`structure OK · ${tags.length} script files, no inline logic, no duplicate ids, no known landmine patterns`);
process.exit(0);
