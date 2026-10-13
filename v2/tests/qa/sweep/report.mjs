#!/usr/bin/env node
// @ts-check
// The QA sweep's table: reads the run's result lines (one per check, written by the specs), writes
// tests/qa/sweep/results.json (git-ignored) and prints (1) a screen × person grid for the routes, (2) every FAIL and
// NOT BUILT line with its detail, (3) the totals per area. `--all` prints the PASS lines too.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { RESULTS_JSON, RESULTS_LINES } from './paths.mjs';

/** @typedef {{ area: string; screen?: string; user?: string; check: string; status: 'PASS' | 'FAIL' | 'NOT BUILT' | 'INFO'; detail?: string; shot?: string; at: string }} Line */

if (!existsSync(RESULTS_LINES)) {
  console.error(`no results at ${RESULTS_LINES} — did the sweep run?`);
  process.exit(1);
}
/** @type {Line[]} */
const lines = readFileSync(RESULTS_LINES, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const RANK = { FAIL: 3, 'NOT BUILT': 2, PASS: 1, INFO: 0 };
const SHORT = { FAIL: 'FAIL', 'NOT BUILT': 'n/b', PASS: 'ok', INFO: 'i' };

/** @type {Record<string, Record<string, number>>} */
const totals = {};
for (const l of lines) {
  const t = (totals[l.area] ??= { PASS: 0, FAIL: 0, 'NOT BUILT': 0, INFO: 0 });
  t[l.status] = (t[l.status] ?? 0) + 1;
}
writeFileSync(
  RESULTS_JSON,
  JSON.stringify({ generated: new Date().toISOString(), totals, results: lines }, null, 2) + '\n',
);

const pad = (/** @type {string} */ s, /** @type {number} */ n) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n);

// (1) the grid: every screen of the routes sweep × every person, worst status per cell
const routeLines = lines.filter((l) => l.area === 'routes' && l.user && l.screen);
const people = [...new Set(routeLines.map((l) => l.user ?? ''))];
const screens = [...new Set(routeLines.map((l) => l.screen ?? ''))];
if (routeLines.length) {
  console.log('\nScreens × people (ok = as the levels say · n/b = not built · FAIL = defect)\n');
  console.log(`${pad('screen', 44)} ${people.map((p) => pad(p, 12)).join(' ')}`);
  for (const s of screens) {
    const cells = people.map((p) => {
      const mine = routeLines.filter((l) => l.user === p && l.screen === s);
      if (!mine.length) return pad('-', 12);
      const worst = mine.reduce((a, b) => (RANK[b.status] > RANK[a.status] ? b : a));
      return pad(SHORT[worst.status], 12);
    });
    console.log(`${pad(s, 44)} ${cells.join(' ')}`);
  }
}

// (2) every FAIL and NOT BUILT, then (with --all) every PASS
const show = process.argv.includes('--all') ? ['FAIL', 'NOT BUILT', 'PASS', 'INFO'] : ['FAIL', 'NOT BUILT', 'INFO'];
for (const status of show) {
  const of = lines.filter((l) => l.status === status);
  if (!of.length) continue;
  console.log(`\n${status} (${of.length})\n`);
  for (const l of of)
    console.log(
      `- [${l.area}] ${l.user ? `${l.user} · ` : ''}${l.screen ? `${l.screen} · ` : ''}${l.check}${l.detail ? ` — ${l.detail}` : ''}${l.shot ? ` (screenshot: ${l.shot})` : ''}`,
    );
}

// (3) the totals
console.log('\nTotals per area\n');
console.log(`${pad('area', 12)} ${pad('PASS', 6)} ${pad('FAIL', 6)} ${pad('NOT BUILT', 10)} INFO`);
for (const [area, t] of Object.entries(totals))
  console.log(
    `${pad(area, 12)} ${pad(String(t.PASS), 6)} ${pad(String(t.FAIL), 6)} ${pad(String(t['NOT BUILT']), 10)} ${t.INFO}`,
  );
console.log(`\nresults: ${RESULTS_JSON}`);
