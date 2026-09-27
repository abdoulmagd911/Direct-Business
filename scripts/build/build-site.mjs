/* build-site.mjs (2026-09-27) — what Vercel serves: the site with its scripts INSIDE the page (speed, finding B).

   Why: every page load asked the server for 108 separate script files (3.2 MB of source, most of them unchanged since the
   last visit — each still one more round trip to check). Now the page carries them: one request, and when nothing changed
   since the last visit the server answers "unchanged" and nothing is downloaded at all.

   How, and why this way: each `<script src="/js/…">` line of index.html is replaced by an inline `<script>` holding that
   file's text — one inline script PER FILE, in the same order. The browser still runs each file as its own script, so
   nothing about how the app runs changes: a file's "use strict" stays its own (core-01 starts with one — merged into a
   single script it would switch every other file into strict mode); a function a later file declares is not "hoisted"
   ahead of an earlier file's code; a file that throws on load still stops only itself. (A single merged file would change
   all three — that is why this is not one big bundle.)
   The repository itself is untouched: index.html keeps its one line per file, every test runs the files as they are,
   and this runs only at deploy (vercel.json buildCommand → outputDirectory dist/). The site's other files (css/, brand/,
   js/ itself for anything that asks for a file by name) are copied as they are; the rest of the repository (docs/,
   scripts/, supabase/, the notes) is no longer published — nothing in the app links to it.

   Refuses to build (exit 1, and Vercel keeps serving the previous version) when:
     · a script line names a file that does not exist;
     · a file does not compile;
     · a file holds both "<!--" and "<script" — the one combination that changes how a browser reads an inline script.
   Any "</script" inside a file is written "<\/script", which is the same text to JavaScript.
   Run: node scripts/build/build-site.mjs [outDir]   (default dist/) — prints what it did. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
const COPY = ['css', 'brand', 'js'];
const fail = (m) => { console.error('build-site: ' + m); process.exit(1); };

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LINE = /<script src="(\/js\/[^"]+\.js)"><\/script>/g;
let n = 0, bytes = 0;
const hash = crypto.createHash('sha256');
const built = html.replace(LINE, (whole, src) => {
  const file = path.join(ROOT, src);
  if (!fs.existsSync(file)) fail(`index.html loads ${src}, which does not exist`);
  let code = fs.readFileSync(file, 'utf8');
  try { new vm.Script(code, { filename: src }); } catch (e) { fail(`${src} does not compile: ${e.message}`); }
  if (code.includes('<!--') && /<script/i.test(code)) fail(`${src} holds both "<!--" and "<script", which changes how a browser reads an inline script — split one of them (e.g. '<'+'!--')`);
  code = code.replace(/<\/script/gi, (m) => '<\\/' + m.slice(2));
  n++; bytes += code.length; hash.update(src + '\0' + code);
  return `<script data-src="${src}">\n${code}\n</script>`;
});
if (!n) fail('index.html has no /js/ script lines — nothing to build');
if (/<script src="\/js\//.test(built)) fail('a /js/ script line was left unreplaced');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const d of COPY) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
const stamp = hash.digest('hex').slice(0, 12);
fs.writeFileSync(path.join(OUT, 'index.html'), built.replace('</head>', `<meta name="direct-build" content="${stamp}">\n</head>`));
console.log(`build-site: ${n} script files inlined (${(bytes / 1024).toFixed(0)} KB), build ${stamp} → ${path.relative(ROOT, OUT) || OUT}`);
