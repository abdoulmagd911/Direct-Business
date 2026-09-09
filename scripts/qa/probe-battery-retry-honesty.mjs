/* probe-battery-retry-honesty.mjs (2026-09-08, watch cycle 58) — the runner's own summary line,
   attacked. Attack area (ab). No port: this probe drives a shell script, not a browser.

   Cycle 57 ran the whole battery twice and got two different sets of reds. Five probes went red
   once each, none of them twice, and every one was green when re-run alone. Their own texts named
   the cause: one drove 1 sub-tab under load and 9 alone; two never received app_settings at all;
   one died on "execution context was destroyed". So `green: 90 / 92` was reporting a race, and a
   red could no longer be read at face value — which is precisely how a real defect hides among
   excuses. Nothing here is about the app. It is about whether the instrument that judges the app
   can tell "this is broken" from "the machine was busy".

   run-battery.sh now re-runs every non-zero result ONE AT A TIME before printing anything, and
   separates the two outcomes: reproduced alone (a finding) and did not (contention). This probe
   drives that with fakes — a probe that always passes, one that always fails, and one that fails
   the first time it is ever run and passes afterwards, which is what contention looks like from
   the outside. The fakes live in a temp folder, not in the tree (cycle 56: an undeclared probe in
   scripts/qa is caught by check-probe-integrity, and rightly), reached through the -l and -d
   options added for exactly this.

   Under test:
     1. A red that does not reproduce alone is NOT reported as a red — and is not silently
        swallowed either: it is named in its own section, so the summary states a fact.
     2. A red that DOES reproduce alone is still red, and the runner still exits 1. A retry that
        forgave everything would be worse than no retry.
     3. Greens are never re-run. The retry must cost what was already failing, not double the run.
     4. A clean list does no retrying at all and says so in the old words.
     5. The first, crowded attempt is still on disk next to the quiet one — the evidence that let
        cycle 57 diagnose this at all must not be overwritten by the retry.

   Run:  node scripts/qa/probe-battery-retry-honesty.mjs
   Sabotage: delete the serial re-run block from run-battery.sh — checks 1, 3 and 5 go red.
   Assert the sabotage APPLIED with a marker unique to it; confirm the restore by marker count
   and git status.  */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, 'run-battery.sh');
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'battery-retry-'));
const probes = path.join(tmp, 'fakes'); fs.mkdirSync(probes);
const counter = path.join(tmp, 'runs.txt'); fs.writeFileSync(counter, '');

/* Every fake records that it ran, so "was this re-run?" is a count, not an inference. */
const record = `import fs from 'node:fs'; fs.appendFileSync(process.env.BR_COUNT, NAME + '\\n');
const ranBefore = fs.readFileSync(process.env.BR_COUNT, 'utf8').split('\\n').filter((l) => l === NAME).length;`;
const write = (name, body) => fs.writeFileSync(path.join(probes, name + '.mjs'), `const NAME = ${JSON.stringify(name)};\n${record}\n${body}\n`);

write('fake-green', `console.log('  ✓ nothing wrong here');\nprocess.exit(0);`);
write('fake-red', `console.log('  ✗ a defect that is really there');\nconsole.log('FAILED — 1 check(s) did not pass.');\nprocess.exit(1);`);
/* Contention, imitated: red the first time it is ever run, green from then on. That is exactly
   the shape cycle 57 measured — starved under load, fine with the machine to itself. */
write('fake-flaky', `if (ranBefore <= 1) { console.log('  ✗ starved by the machine, not by the app'); process.exit(1); }
console.log('  ✓ fine with the machine to itself');\nprocess.exit(0);`);

const runBattery = (names, out) => {
  const list = path.join(tmp, 'list-' + path.basename(out) + '.txt');
  fs.writeFileSync(list, names.join('\n') + '\n');
  try {
    const stdout = execFileSync('bash', [RUNNER, '-j', '3', '-t', '60', '-o', out, '-l', list, '-d', probes],
      { encoding: 'utf8', env: Object.assign({}, process.env, { BR_COUNT: counter }) });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
};
const ranTimes = (name) => fs.readFileSync(counter, 'utf8').split('\n').filter((l) => l === name).length;

/* ---- run one: a green, a genuine red, and a contention red, all together ---- */
const outA = path.join(tmp, 'runA');
const A = runBattery(['fake-green', 'fake-red', 'fake-flaky'], outA);

/* 1. the contention red must not be reported as a red, and must not vanish either */
const flakyNamedRed = /✗ fake-flaky \(exit/.test(A.out);
const flakyNamedApart = /DID NOT REPRODUCE ALONE[^\n]*fake-flaky/.test(A.out);
if (!flakyNamedRed && flakyNamedApart)
  ok('a red that does not reproduce alone is re-run, kept out of RED, and named in its own section — the summary states a fact rather than a race');
else if (!flakyNamedRed && !flakyNamedApart)
  fail(`the contention red disappeared from the summary entirely — it was neither reported red nor named as a non-reproducer. Swallowing it is the other half of the same defect: a probe that lands there run after run is a race, and nobody would ever see it.\n--- runner said ---\n${A.out}`);
else
  fail(`fake-flaky failed under load and passed alone, and the runner still reported it as RED. Cycle 57 got two different red sets from two runs of the same tree for exactly this reason: the summary is reporting the machine, not the app.\n--- runner said ---\n${A.out}`);

/* 2. the genuine red survives the retry, and the run still fails */
if (/✗ fake-red \(exit 1\)/.test(A.out) && A.code === 1)
  ok('a red that reproduces alone is still red and the run still exits 1 — the retry forgives contention, not defects');
else
  fail(`the genuine red did not survive the serial re-run (exit ${A.code}). A retry that turns every red green is worse than no retry at all.\n--- runner said ---\n${A.out}`);

/* 3. greens are not re-run */
const greenRuns = ranTimes('fake-green'), flakyRuns = ranTimes('fake-flaky'), redRuns = ranTimes('fake-red');
if (greenRuns === 1 && flakyRuns === 2 && redRuns === 2)
  ok('greens are never re-run: fake-green ran once, the two non-zero ones ran twice — the retry costs what was already failing, not the whole battery again');
else
  fail(`the retry did not run what it should: fake-green ran ${greenRuns}× (expected 1), fake-flaky ${flakyRuns}× (expected 2), fake-red ${redRuns}× (expected 2). Re-running the greens would double a 25-minute battery for nothing.`);

/* 5. both attempts survive on disk */
const crowded = path.join(outA, 'fake-flaky.log'), quiet = path.join(outA, 'fake-flaky.retry.log');
if (fs.existsSync(crowded) && fs.existsSync(quiet) && /starved by the machine/.test(fs.readFileSync(crowded, 'utf8')) && /machine to itself/.test(fs.readFileSync(quiet, 'utf8')))
  ok('the crowded attempt and the quiet one are both kept, in separate files — the evidence that diagnosed this in the first place is not overwritten by the fix');
else
  fail('the first, failing attempt was overwritten by the re-run. Cycle 36 wrote this runner because six cycles of moving reds had been diagnosed from a summary line with the real output already gone; a retry that clobbers the crowded log walks straight back into that.');

/* ---- run two: nothing red at all ---- */
const outB = path.join(tmp, 'runB');
const B = runBattery(['fake-green'], outB);
if (B.code === 0 && /battery OK/.test(B.out) && !/re-running/.test(B.out) && ranTimes('fake-green') === 2)
  ok('a clean list retries nothing and still says "battery OK" — the retry is reached only by a non-zero result');
else
  fail(`a clean run did not behave: exit ${B.code}, fake-green ran ${ranTimes('fake-green')}× in total (expected 2 — once per run).\n--- runner said ---\n${B.out}`);

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { }
if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
console.log('\nbattery-retry-honesty OK — the runner re-checks its own reds alone before it calls anything red');
process.exit(0);
