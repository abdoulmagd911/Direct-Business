/* check-decisions-wired.mjs — the mechanical half of docs/DECISIONS.md's P5 ("a correct rule
   that nothing consults is not a rule"), 2026-08-23.

   P5 exists because the same failure shape hit this project three times: the Takamol
   exclusion list (correct, seeded, wired into every importer function — and never called
   anyway, because the real write went in through direct SQL that bypassed all of them);
   MIN_PW (the Supabase Auth policy was 10, a screen hardcoded `<8`, so the client silently
   accepted an 8-char password the server then rejected); and /brand/tokens.css (a real
   design-token file that neither of the two pages that render Direct's brand actually
   loads). In every case, the DOCUMENT was correct and the CODE existed — the two just never
   met. A rule that only lives in prose can't be probed to catch that; this script gives it a
   floor that can.

   WHAT THIS CHECKS, and — just as importantly — what it does NOT: this is NOT a claim that a
   cited function's logic is correct, or that it runs on every code path that matters (that is
   what the actual QA probes are for — this file complements them, it doesn't replace them).
   It checks a narrower, purely mechanical thing: every ACTIVE rule that cites a concrete
   enforcement point — a function call like `finExclusionCheck()`, an ALL_CAPS constant like
   `MIN_PW`, or a file path like `js/62-finance-guardrails.js` — must have that citation
   resolve to something that (a) actually exists in this codebase, and (b) for functions and
   constants, is referenced from somewhere OTHER than its own definition. A citation that
   fails (a) is a rule pointing at code that was renamed or deleted out from under it — stale
   documentation, caught before it misleads the next session. A citation that fails (b) is the
   Takamol shape exactly: the thing was built, and nothing else in the codebase ever calls it.

   This is a floor, not a ceiling — a rule can still cite something that's wired but wired
   wrong (the actual bug class the real QA probes exist to catch). But "defined once, called
   zero times" is a purely structural fact this script can prove in seconds, on every future
   commit, without a human having to remember to go check — which is the whole point of P5. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const DECISIONS = path.join(ROOT, 'docs/DECISIONS.md');

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
function skip(msg) { console.log('  · ' + msg); }

// Every .js/.mjs file under the repo, excluding node_modules/vendored copies — read once,
// kept in memory, so each citation check is a fast in-memory scan rather than a re-read.
function walkJsFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (/\.(m?js)$/.test(entry.name)) out.push(full);
  }
}
const JS_FILES = [];
walkJsFiles(ROOT, JS_FILES);
const FILE_TEXT = new Map(JS_FILES.map((f) => [f, fs.readFileSync(f, 'utf8')]));

function countOccurrences(re) {
  let total = 0;
  const files = new Set();
  for (const [f, text] of FILE_TEXT) {
    const m = text.match(re);
    if (m && m.length) { total += m.length; files.add(f); }
  }
  return { total, fileCount: files.size };
}

function main() {
  const md = fs.readFileSync(DECISIONS, 'utf8');
  // Split into rule blocks: a bolded rule statement through its own "*Date: ... Status: ...*"
  // line. Only ACTIVE rules are checked — a SUPERSEDED or OPEN-CONTESTED rule describing old
  // code is expected to point at something that may no longer be wired the same way.
  const blocks = md.split(/\n(?=\*\*)/).filter((b) => /^\*\*/.test(b));
  let checkedRules = 0, citedSymbols = 0;

  for (const block of blocks) {
    const statusM = block.match(/Status:\s*(ACTIVE|OPEN\s*—\s*CONTESTED|SUPERSEDED-BY[^*]*)\.?\*/i);
    const status = statusM ? statusM[1].toUpperCase() : null;
    if (!status || !status.startsWith('ACTIVE')) continue;
    const titleM = block.match(/^\*\*([^*]+)\*\*/);
    const title = titleM ? titleM[1].trim().slice(0, 70) : '(untitled rule)';
    checkedRules++;

    // Pull every backtick-quoted citation out of this rule's own text — a function call
    // `name()`, an ALL_CAPS constant `NAME`, or a file path `a/b/c.ext`.
    const cites = [...block.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    for (const cite of cites) {
      let fnM, constM, pathM;
      if ((fnM = cite.match(/^([A-Za-z_$][\w$]*)\(\)$/))) {
        citedSymbols++;
        const name = fnM[1];
        const defRe = new RegExp('function\\s+' + name + '\\s*\\(|\\b' + name + '\\s*=\\s*function\\b', 'g');
        const callRe = new RegExp('\\b' + name + '\\s*\\(', 'g');
        const def = countOccurrences(defRe);
        const calls = countOccurrences(callRe);
        if (def.total === 0) fail(`"${title}": cites \`${cite}\` but no function named ${name} is defined anywhere in js/ — stale citation, the code moved or was renamed out from under this rule`);
        else if (calls.total <= def.total) fail(`"${title}": \`${cite}\` is defined but every occurrence of ${name}( looks like the definition itself — nothing in the codebase calls it. This is the exact Takamol shape: correct, written, never consulted.`);
        else ok(`"${title}": ${name}() is defined and called ${calls.total - def.total} time(s) beyond its own definition`);
      } else if ((constM = cite.match(/^([A-Z][A-Z0-9_]{2,})$/))) {
        citedSymbols++;
        const name = constM[1];
        const re = new RegExp('\\b' + name + '\\b', 'g');
        const occ = countOccurrences(re);
        if (occ.total === 0) fail(`"${title}": cites constant \`${cite}\` but it does not appear anywhere in js/ — stale citation`);
        else if (occ.fileCount < 2 && occ.total < 2) fail(`"${title}": constant \`${cite}\` appears only once in the whole codebase — defined (maybe) but nothing reads it`);
        else ok(`"${title}": ${name} appears ${occ.total} time(s) across ${occ.fileCount} file(s)`);
      } else if ((pathM = cite.match(/^[\w./-]+\.(js|mjs|css|md|html)$/))) {
        citedSymbols++;
        const rel = pathM[0];
        const full = path.join(ROOT, rel);
        if (!fs.existsSync(full)) fail(`"${title}": cites file \`${cite}\` which does not exist in the repo — stale citation`);
        else ok(`"${title}": file ${rel} exists`);
      }
      // Anything else in backticks (a column name, a URL fragment, a short phrase) is prose,
      // not a code citation this script can resolve — silently skipped, not a failure.
    }
  }

  console.log(`\n${checkedRules} ACTIVE rule(s) scanned, ${citedSymbols} code citation(s) checked.`);
  if (failures) {
    console.log(`\nFAILED — ${failures} citation(s) in docs/DECISIONS.md point at code that is missing or never actually called.`);
    process.exit(1);
  }
  console.log('decisions-wired OK — every ACTIVE rule\'s code citation resolves to something that exists and is actually called.');
  process.exit(0);
}

main();
