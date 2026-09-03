/* check-probe-integrity.mjs — the meta-guard: it audits the QA suite itself.

   Standing rule (docs/DECISIONS.md, skill `bulletproof-audit`): "A guard that has never
   failed is not evidence." Two sessions wrote ~150 probes and declared areas safe on their
   say-so; nobody had checked whether those probes were CAPABLE of failing. A probe that
   passes vacuously is worse than no probe — it turns an untested area into a falsely
   reassured one.

   This runs in under a second, drives no browser, and scans every probe for the vacuity
   tells found by the 2026-09-03 meta-audit:

     T1 NO_FAIL_SIGNAL   counts/prints failures but never exits non-zero, so a real
                         regression reads as a pass to anything using the exit code.
                         (Sabotage-proven on probe-landmines: the .exe and 26MB upload
                         guards were disabled, L17/L18 printed FAIL, exit code was 0.)
     T2 LITERAL_TRUE     an assertion handed a hard-coded `true` — usually "element not
                         found, call it a pass", which is the exact inversion of a guard.
     T3 SWALLOWED        an assertion inside try{...}catch(_){} — the failure is discarded.
     T4 TAUTOLOGY        a failure condition that cannot be false (`>= 0`,
                         `typeof x !== 'undefined'`).
     T5 PORT_DUP         two probes hard-code the same mock port; they cannot run
                         concurrently and the clash surfaces as EADDRINUSE, not a result.

   GATE vs WARN. GATE holds the load-bearing probes whose ability to fail was established
   by real sabotage (each was broken in the app, watched go red, then restored). If any of
   them regresses into vacuity, this exits 1 — that is the ratchet. Everything else is
   reported as a warning, plus one budget: the number of NO_FAIL_SIGNAL probes may not grow
   above the recorded baseline. New probes must be able to fail.

   Run: node scripts/qa/check-probe-integrity.mjs
   Sabotage: node scripts/qa/check-probe-integrity.mjs --sabotage
     (rewrites a gated probe's exit to a constant 0 in a scratch copy and demands this
      checker exits non-zero — proving the checker really checks.)                        */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const ROOT = process.env.PROBE_ROOT || REPO;
const DIRS = ['scripts/qa', 'scripts/generator-qa'];

/* Support files: rigs, mocks and seeds. They have no assertions of their own, so the
   fail-signal tells do not apply to them. Named explicitly rather than pattern-matched,
   so a real probe can never quietly acquire an exemption by being named "…-rig.mjs". */
const SUPPORT = new Set([
  'emp-rig.mjs', 'mock-supabase.mjs', 'mock-seed.mjs', 'mock-seed-live.mjs',
  'stress-data.mjs', 'check-probe-integrity.mjs',
]);

/* MUST BE ABLE TO FAIL. Every entry below was sabotage-proven on 2026-09-03: the thing it
   claims to protect was broken in the app, the probe was watched go red and exit non-zero,
   and the app file was restored. If one of these stops being able to fail, this check
   fails the build. */
const GATE = [
  'probe-finance-invariants.mjs',   // exclusion filter removed from js/16 live() -> red
  'probe-no-vat-display.mjs',       // VAT baked into revenue_sar in finSanitizeMoney -> red
  'probe-csv-injection.mjs',        // csvGuard() neutralisation stripped -> red
  'probe-two-tabs.mjs',             // js/19 made to send the whole blob -> red
  'probe-save-confirms-rows.mjs',   // M13 silent-refusal detection removed from js/02 -> red
  'probe-overview-attacks.mjs',     // finSanitizeMoney disabled -> red
  'probe-landmines.mjs',            // upload guards disabled -> red (after the exit-code fix)
  'probe-golive.mjs',               // same exit-code defect, fixed the same way
  'probe-viewer-writes.mjs',
  'probe-clients-attacks.mjs', 'probe-ledger-attacks.mjs', 'probe-report-builder-attacks.mjs',
  'probe-generator-brand.mjs', 'probe-tender.mjs', 'probe-price-offer.mjs',
  'probe-service-fees.mjs', 'probe-contract.mjs', 'probe-company-profile.mjs',
];

/* Baseline measured 2026-09-03: 43 files cannot report a failure through their exit code.
   27 of them count and print FAILs and then exit 0 (the dangerous shape — they look like
   probes); the other 16 are diag-/sweep-/audit- dumps with no assertions at all. Both are
   listed in the audit report and are the other session's to triage. May go DOWN freely.
   It going UP means a new probe was written that cannot fail — which is the thing this
   whole file exists to stop. */
const NO_FAIL_SIGNAL_BUDGET = 43;

/* --sabotage: prove this checker really checks. Copy the suite to a scratch tree, blunt one
   gated probe's exit into a constant 0 — the exact regression this file exists to catch —
   and demand that a run against that tree exits non-zero. */
if (process.argv.includes('--sabotage')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-integrity-sab-'));
  for (const d of DIRS) fs.cpSync(path.join(REPO, d), path.join(tmp, d), { recursive: true });
  const victim = path.join(tmp, 'scripts/qa/probe-csv-injection.mjs');
  const blunted = fs.readFileSync(victim, 'utf8').replace(/process\.exit\([^)]*\)/g, 'process.exit(0)');
  fs.writeFileSync(victim, blunted);
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)],
    { env: { ...process.env, PROBE_ROOT: tmp }, stdio: 'pipe', encoding: 'utf8' });
  const caught = r.status !== 0 && /probe-csv-injection/.test(r.stdout);
  console.log(caught
    ? 'PASS  sabotage: a gated probe blunted to always-exit-0 was caught and the checker exited non-zero'
    : 'FAIL  sabotage: the checker stayed green with a gated probe unable to fail — it is not actually checking\n' + r.stdout);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(caught ? 0 : 1);
}

const files = [];
for (const d of DIRS) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.mjs')).sort()) {
    files.push({ rel: d + '/' + f, base: f, src: fs.readFileSync(path.join(abs, f), 'utf8') });
  }
}

/* Strip block and line comments before pattern-matching. Without this, a probe that
   *documents* its own sabotage recipe in a header comment reads as if it contained the
   very tell being searched for. */
function decomment(s) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');   // keep every newline so line numbers stay true
  return s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])(\/\/[^\n]*)/g, (m, a, b) => a + blank(b));
}

const findings = [];
const add = (file, line, tell, detail) => findings.push({ file, line, tell, detail });
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

const portsByFile = new Map();

for (const f of files) {
  const code = decomment(f.src);
  const support = SUPPORT.has(f.base);

  /* ---- T1 NO_FAIL_SIGNAL ---------------------------------------------------------
     Does the probe have a way to notice a failure at all, and if so can it report one? */
  const signalsFailure = /\bfail\s*\(|failures\s*\+\+|fails\.push|failed\s*=\s*true|✗|'FAIL'|"FAIL"|`FAIL/.test(code);
  const exitsNonZero =
    /process\.exit\(\s*(?!0\s*\))[^)]*\)/.test(code) ||          // exit(1), exit(fails?1:0), exit(n)
    /process\.exitCode\s*=\s*(?!0\b)/.test(code);
  if (!support && signalsFailure && !exitsNonZero) {
    const m = code.match(/process\.exit\(\s*0\s*\)/);
    add(f.rel, m ? lineOf(code, m.index) : 1, 'NO_FAIL_SIGNAL',
      'counts or prints failures but never exits non-zero — a regression reads as a pass');
  }
  if (!support && !signalsFailure && !exitsNonZero) {
    add(f.rel, 1, 'NO_FAIL_SIGNAL', 'no failure path of any kind — this file cannot report a defect');
  }

  /* ---- T2 LITERAL_TRUE: an assertion handed a hard-coded pass --------------------- */
  const litTrue = /\b(?:STEP|ok|OK|check|CHECK|assert|expect)\s*\(\s*(?:[`'"][^`'"]{3,120}[`'"])\s*,\s*true\s*[,)]/g;
  for (let m; (m = litTrue.exec(code));) {
    add(f.rel, lineOf(code, m.index), 'LITERAL_TRUE',
      'assertion given a literal `true` — usually "element missing, call it a pass"');
  }

  /* ---- T3 SWALLOWED: an assertion inside an empty catch --------------------------- */
  /* The body may nest one level of braces at most, and may not itself contain try/catch —
     without that bound a lazy match runs from one statement's `try {` all the way to a
     LATER empty catch and reports every assertion in between (a false positive found while
     sabotage-testing this checker against verify-audit-round2-fixes.mjs). */
  const tryEmpty = /try\s*\{((?:[^{}]|\{[^{}]*\})*?)\}\s*catch\s*\(\s*[_a-zA-Z$]*\s*\)\s*\{\s*\}/g;
  for (let m; (m = tryEmpty.exec(code));) {
    if (/\b(?:try|catch)\b/.test(m[1])) continue;
    if (/\bfail\s*\(|failures\s*\+\+|fails\.push|✗/.test(m[1])) {
      add(f.rel, lineOf(code, m.index), 'SWALLOWED',
        'an assertion sits inside try{...}catch(_){} — its failure is discarded');
    }
  }

  /* ---- T4 TAUTOLOGY: a failure condition that cannot be false --------------------- */
  const taut = /\bif\s*\([^)\n]{0,160}?(>=\s*0\b|typeof\s+[\w.$[\]]+\s*!==?\s*['"]undefined['"])[^)\n]{0,80}\)\s*(?:\{[^}]{0,120})?\bfail\s*\(/g;
  for (let m; (m = taut.exec(code));) {
    add(f.rel, lineOf(code, m.index), 'TAUTOLOGY',
      'failure condition uses `>= 0` / `typeof !== undefined` — it can never be true');
  }

  /* ---- T5 PORT_DUP: collected here, reported after the sweep ---------------------- */
  const portRe = /\bPORT\s*=\s*(\d{4,5})\b/g;
  for (let m; (m = portRe.exec(code));) {
    const p = m[1];
    if (!portsByFile.has(p)) portsByFile.set(p, []);
    if (!portsByFile.get(p).includes(f.rel)) portsByFile.get(p).push(f.rel);
  }
}

for (const [port, owners] of portsByFile) {
  if (owners.length > 1) {
    for (const o of owners) {
      add(o, 1, 'PORT_DUP', `mock port ${port} is also bound by ${owners.filter((x) => x !== o).join(', ')}`);
    }
  }
}

/* ---------------------------------- report ---------------------------------------- */
const gateHits = findings.filter((x) => GATE.includes(path.basename(x.file)));
const otherHits = findings.filter((x) => !GATE.includes(path.basename(x.file)));
const noSignal = findings.filter((x) => x.tell === 'NO_FAIL_SIGNAL');

console.log(`scanned ${files.length} file(s) in ${DIRS.join(', ')} — ${files.length - [...files].filter((f) => SUPPORT.has(f.base)).length} probe(s), ${[...files].filter((f) => SUPPORT.has(f.base)).length} support file(s)\n`);

if (otherHits.length) {
  console.log(`WARNINGS — ${otherHits.length} vacuity tell(s) outside the gated set:`);
  for (const h of otherHits) console.log(`  · ${h.file}:${h.line}  ${h.tell} — ${h.detail}`);
  console.log('');
}

let bad = 0;
if (gateHits.length) {
  console.log(`FAILED — ${gateHits.length} tell(s) in probes that MUST be able to fail:`);
  for (const h of gateHits) console.log(`  ✗ ${h.file}:${h.line}  ${h.tell} — ${h.detail}`);
  bad += gateHits.length;
} else {
  console.log(`  ✓ all ${GATE.length} gated probes still carry a real failure path`);
}

const missing = GATE.filter((g) => !files.some((f) => f.base === g));
if (missing.length) {
  console.log(`  ✗ gated probe(s) missing from the tree: ${missing.join(', ')} — a deleted guard is not a passing guard`);
  bad += missing.length;
}

if (noSignal.length > NO_FAIL_SIGNAL_BUDGET) {
  console.log(`  ✗ ${noSignal.length} probe(s) cannot signal failure, above the recorded baseline of ${NO_FAIL_SIGNAL_BUDGET} — a new probe was written that cannot fail`);
  bad += 1;
} else {
  console.log(`  ✓ ${noSignal.length} probe(s) cannot signal failure — at or below the ${NO_FAIL_SIGNAL_BUDGET} recorded on 2026-09-03`);
}

if (bad) { console.log(`\nprobe-integrity FAILED — ${bad} problem(s).`); process.exit(1); }
console.log('\nprobe-integrity OK — every gated probe can still fail, and no new probe was added that cannot.');
process.exit(0);
