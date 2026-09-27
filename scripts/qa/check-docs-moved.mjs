/* check-docs-moved.mjs — proves the 2026-09-27 docs restructure moved words and deleted none (the oversight's order:
   "Nothing deleted, only moved; add a script proving every line of the old files exists in the new set").

   The long working files (docs/BACKLOG.md 1.5 MB, docs/DECISIONS.md 328k, CLAUDE.md 47k) were rewritten short, and the
   two long references (the Playbook, the Master Brief) split. Each old file, exactly as it stood at the commit named in
   docs/history/moved.json, was cut into pieces by scripts/docs/archive-docs.mjs. This check proves, on every run:

     1. JOIN      each archive's pieces, joined in order, are the old file byte for byte (SHA-256 and length);
                  and where this clone has the pinned commit, that the recorded hash IS that commit's file
     2. LINES     every line of every old file is present in the new set (docs/**.md + CLAUDE.md)
     3. SIZE      every piece and index under 40,000 characters; docs/BACKLOG.md at most 150 lines;
                  docs/DECISIONS.md under 40,000 characters; CLAUDE.md at most 22,000
     4. IDS       every rule ID of the old DECISIONS.md (P…, M…, D…) still opens an entry in the new one, and every
                  entry carries a status (ACTIVE / SUSPENDED / OPEN — CONTESTED / SUPERSEDED-BY …)
     5. QUOTES    every passage in double quotes (15+ characters) in the three short working files that was carried
                  over from the archived originals is there word for word — the owner's words are quoted, never
                  reworded (whitespace and line wrapping aside); a quote given after the cut is only counted
     6. KB NAMES  no pointer to the old knowledge-base part names ("KB Part 35", "Drive part 08" …) outside the
                  word-for-word archives; the new names are the Drive files 04, 05, 06

   Then it SABOTAGES a scratch copy seven ways (a changed byte in a piece, a deleted line, a reworded quote, a dropped
   rule, a 151-line backlog, an oversized DECISIONS.md, an old KB name) and demands that each one is caught, on top of
   an untouched copy that must pass — a check that has never failed is not evidence.

   Run: node scripts/qa/check-docs-moved.mjs                                                                          */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const LIMIT_PIECE = 40000, LIMIT_DECISIONS = 40000, LIMIT_CLAUDE = 22000, LIMIT_BACKLOG_LINES = 150;
const cp = (s) => [...s].length;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const OLD_KB = /\b(?:KB|Drive|[Kk]nowledge[- ][Bb]ase)\s+[Pp]art\s+\d+[a-z]?\b|\bPart 3\d\b/;

function walk(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, pred, out); else if (pred(f)) out.push(f);
  }
  return out;
}

/* passages in double quotes, straight or curly, paired within one paragraph; a " inside a `code` span is not a quote
   mark (it is parked as \u0001 while pairing and put back, so the passage stays the text as written) */
function quotes(text) {
  const out = [];
  for (const para of text.split(/\n\s*\n/)) {
    const t = para.replace(/`[^`\n]*`/g, (m) => m.replace(/"/g, '\u0001'));
    /* pair every mark in order, short quotes included ("A"), and only then keep the long ones — skipping a short pair
       would shift every pair after it by one mark */
    for (const m of t.matchAll(/"([^"]*)"/g)) if (m[1].length >= 15 && m[1].length <= 1500) out.push(m[1].replace(/\u0001/g, '"'));
    for (const m of t.matchAll(/“([^”]*)”/g)) if (m[1].length >= 15 && m[1].length <= 1500) out.push(m[1].replace(/\u0001/g, '"'));
  }
  return out;
}

const GIT = new Map();
function gitShow(commit, file) {
  const k = commit + ':' + file;
  if (!GIT.has(k)) { let t = null; try { t = execFileSync('git', ['show', k], { cwd: REPO, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8'); } catch (_) { } GIT.set(k, t); }
  return GIT.get(k);
}

/* root: a checkout (the repo, or a scratch copy). */
function check(root, { quiet = false } = {}) {
  const fails = [];
  const say = (ok, tag, msg) => { if (!ok) fails.push(`${tag} · ${msg}`); if (!quiet) console.log(`  ${ok ? '✓' : '✗'} ${tag} · ${msg}`); };
  const rd = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const mfPath = path.join(root, 'docs/history/moved.json');
  if (!fs.existsSync(mfPath)) { say(false, 'JOIN', 'docs/history/moved.json is missing — no manifest, nothing proven'); return fails; }
  const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  say(mf.files && mf.files.length >= 5, 'JOIN', `the manifest names ${mf.files ? mf.files.length : 0} moved file(s) (5 expected)`);

  const old = {};
  for (const f of mf.files) {
    let joined = '', missing = [];
    for (const p of f.pieces) {
      const rel = path.join(f.archive, p);
      if (!fs.existsSync(path.join(root, rel))) { missing.push(rel); continue; }
      joined += rd(rel);
    }
    const sha = crypto.createHash('sha256').update(joined).digest('hex');
    say(!missing.length && sha === f.sha256 && cp(joined) === f.chars, 'JOIN',
      `${f.old}: ${f.pieces.length} pieces in ${f.archive}/ join to the old file byte for byte` +
      (missing.length ? ` — MISSING ${missing.join(', ')}` : sha === f.sha256 ? '' : ` — hash differs (${sha.slice(0, 12)} ≠ ${f.sha256.slice(0, 12)})`));
    old[f.old] = joined;
    /* the old file from git itself, where this clone has the commit — independent of the copy being checked, so LINES
       below is measured against the real old file, not against the pieces it is meant to test */
    const fromGit = gitShow(mf.commit, f.old);
    if (fromGit === null) { if (!quiet) console.log(`  · JOIN · ${f.old}: commit ${mf.commit.slice(0, 12)} is not in this clone — the hash check above stands alone`); }
    else {
      say(crypto.createHash('sha256').update(fromGit).digest('hex') === f.sha256, 'JOIN', `${f.old}: the recorded hash is that file at commit ${mf.commit.slice(0, 12)}`);
      old[f.old] = fromGit;
    }
    for (const p of [...f.pieces, 'README.md']) {
      const rel = path.join(f.archive, p);
      if (fs.existsSync(path.join(root, rel))) { const n = rd(rel).length; if (n >= LIMIT_PIECE) say(false, 'SIZE', `${rel} is ${n} characters (limit ${LIMIT_PIECE})`); }
    }
  }

  /* 2 · every line of every old file is somewhere in the new set */
  const newSet = new Set();
  for (const f of [...walk(path.join(root, 'docs'), (x) => x.endsWith('.md')), path.join(root, 'CLAUDE.md')])
    if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) newSet.add(l);
  for (const [name, text] of Object.entries(old)) {
    const lines = text.split('\n'); const lost = lines.filter((l) => l.trim() && !newSet.has(l));
    say(lost.length === 0, 'LINES', `${name}: ${lines.length.toLocaleString('en')} lines, ${lost.length ? lost.length + ' NOT found in the new set, first: ' + JSON.stringify(lost[0].slice(0, 80)) : 'every one found in the new set'}`);
  }

  /* 3 · sizes of the short working files */
  const backlog = rd('docs/BACKLOG.md'), decisions = rd('docs/DECISIONS.md'), claude = rd('CLAUDE.md');
  const bl = backlog.replace(/\n$/, '').split('\n').length;
  say(bl <= LIMIT_BACKLOG_LINES, 'SIZE', `docs/BACKLOG.md is ${bl} lines (limit ${LIMIT_BACKLOG_LINES})`);
  say(decisions.length < LIMIT_DECISIONS, 'SIZE', `docs/DECISIONS.md is ${decisions.length.toLocaleString('en')} characters (limit ${LIMIT_DECISIONS.toLocaleString('en')})`);
  say(claude.length <= LIMIT_CLAUDE, 'SIZE', `CLAUDE.md is ${claude.length.toLocaleString('en')} characters (limit ${LIMIT_CLAUDE.toLocaleString('en')})`);

  /* 4 · rule IDs and statuses */
  const oldDec = old['docs/DECISIONS.md'] || '';
  const oldIds = [...new Set([...oldDec.matchAll(/^\*\*((?:P|M|D)\d+[a-z]?)\b/gm)].map((m) => m[1]))];
  const entries = decisions.split(/\n\s*\n/).filter((b) => /^\*\*[A-Z]+\d+[a-z]? —/.test(b.trim()));
  const newIds = new Set(entries.map((b) => b.trim().match(/^\*\*([A-Z]+\d+[a-z]?) —/)[1]));
  const dropped = oldIds.filter((id) => !newIds.has(id));
  say(oldIds.length > 100 && dropped.length === 0, 'IDS', `${oldIds.length} rule IDs in the old DECISIONS.md, ${dropped.length ? 'MISSING from the new one: ' + dropped.join(', ') : 'every one opens an entry in the new one'} (${entries.length} entries)`);
  const STATUS = /\*\*\s*(ACTIVE|SUSPENDED|OPEN — CONTESTED|SUPERSEDED-BY [^·]+?)\s*·\s*\d{4}-\d\d-\d\d/;
  const noStatus = entries.filter((b) => !STATUS.test(b)).map((b) => b.trim().match(/^\*\*([A-Z]+\d+[a-z]?)/)[1]);
  say(entries.length > 0 && noStatus.length === 0, 'IDS', `every entry says its status and date${noStatus.length ? ' — NOT: ' + noStatus.join(', ') : ''}`);

  /* 5 · quoted words: a passage whose start or end is in the archived originals must be there WHOLE — that is a
     quote carried over from the old text, and a difference means it was reworded. A passage that shares neither its
     first nor its last words with the originals is new (a quote given after the cut) and is only counted. */
  const haystack = norm(Object.values(old).join('\n'));
  for (const [name, text] of [['docs/DECISIONS.md', decisions], ['docs/BACKLOG.md', backlog], ['CLAUDE.md', claude]]) {
    const qs = quotes(text); let fresh = 0; const bad = [];
    for (const q of qs) {
      const n = norm(q); if (haystack.includes(n)) continue;
      const w = n.split(' '); const k = Math.min(5, Math.max(2, Math.floor(w.length / 2)));
      if (w.length >= 4 && (haystack.includes(w.slice(0, k).join(' ')) || haystack.includes(w.slice(-k).join(' ')))) bad.push(q); else fresh++;
    }
    say(bad.length === 0, 'QUOTES', `${name}: ${qs.length} quoted passage(s), ${bad.length ? bad.length + ' REWORDED from the originals, first: ' + JSON.stringify(bad[0].slice(0, 90)) : 'every carried-over one word for word'}${fresh ? ` (${fresh} new, not in the originals)` : ''}`);
  }

  /* 6 · no old knowledge-base names outside the word-for-word archives */
  const self = path.join(root, 'scripts/qa/check-docs-moved.mjs');
  const scan = [path.join(root, 'CLAUDE.md'), path.join(root, 'index.html'),
    ...walk(path.join(root, 'docs'), (x) => x.endsWith('.md') && !x.includes(`${path.sep}history${path.sep}`) && !x.includes(`${path.sep}reference${path.sep}`)),
    ...['js', 'scripts', 'supabase', 'brand'].flatMap((d) => walk(path.join(root, d), (x) => /\.(m?js|ts|sql|sh|md|html|css)$/.test(x) && x !== self))];
  const hits = [];
  for (const f of scan) { if (!fs.existsSync(f)) continue; fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (OLD_KB.test(l)) hits.push(`${path.relative(root, f)}:${i + 1}`); }); }
  say(hits.length === 0, 'KB NAMES', `${scan.length} files outside the archives name no old knowledge-base part${hits.length ? ' — FOUND at ' + hits.slice(0, 5).join(', ') : ''}`);
  return fails;
}

/* ── the real check ── */
console.log('check-docs-moved — the old long docs, moved word for word:');
const real = check(REPO);

/* ── sabotage: a scratch copy that must pass untouched, and must fail each way it is broken ── */
console.log('\nsabotage — a scratch copy, broken seven ways; each must be caught:');
const mf = JSON.parse(fs.readFileSync(path.join(REPO, 'docs/history/moved.json'), 'utf8'));
function scratch() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-moved-'));
  fs.cpSync(path.join(REPO, 'docs'), path.join(d, 'docs'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'CLAUDE.md'), path.join(d, 'CLAUDE.md'));
  return d;
}
const bl = mf.files.find((f) => f.old === 'docs/BACKLOG.md');
const mid = path.join(bl.archive, bl.pieces[Math.floor(bl.pieces.length / 2)]);
const CASES = [
  ['untouched copy passes', null, null],
  ['one character changed in an archive piece', 'JOIN', (d) => { const f = path.join(d, mid); const t = fs.readFileSync(f, 'utf8'); const i = t.indexOf('e', 2000); fs.writeFileSync(f, t.slice(0, i) + 'a' + t.slice(i + 1)); }],
  ['one line deleted from an archive piece', gitShow(mf.commit, 'docs/BACKLOG.md') === null ? 'JOIN' : 'LINES', (d) => { const f = path.join(d, mid); const L = fs.readFileSync(f, 'utf8').split('\n'); const i = L.findIndex((l, k) => k > 40 && l.trim().length > 40); L.splice(i, 1); fs.writeFileSync(f, L.join('\n')); }],
  ['an owner quote reworded in DECISIONS.md', 'QUOTES', (d) => { const f = path.join(d, 'docs/DECISIONS.md'); const t = fs.readFileSync(f, 'utf8'); const q = quotes(t)[0]; if (!q) throw new Error('no quote to reword'); fs.writeFileSync(f, t.replace('"' + q + '"', '"' + q.replace(/[a-z]/, (c) => (c === 'x' ? 'y' : 'x')) + '"')); }],
  ['a rule dropped from DECISIONS.md', 'IDS', (d) => { const f = path.join(d, 'docs/DECISIONS.md'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\n\*\*M26 —[^\n]*(\n(?!\n)[^\n]*)*/, '')); }],
  ['a 151-line BACKLOG.md', 'SIZE', (d) => { const f = path.join(d, 'docs/BACKLOG.md'); const n = fs.readFileSync(f, 'utf8').replace(/\n$/, '').split('\n').length; fs.appendFileSync(f, '\n'.repeat(Math.max(1, 152 - n)) + 'one line too many\n'); }],
  ['DECISIONS.md over 40,000 characters', 'SIZE', (d) => { fs.appendFileSync(path.join(d, 'docs/DECISIONS.md'), '\n' + 'x'.repeat(LIMIT_DECISIONS) + '\n'); }],
  ['an old knowledge-base name in CLAUDE.md', 'KB NAMES', (d) => { fs.appendFileSync(path.join(d, 'CLAUDE.md'), '\nSee KB Part 35 for the finance rules.\n'); }],
];
let sabotageBad = 0;
for (const [name, tag, mutate] of CASES) {
  const d = scratch();
  try {
    if (mutate) mutate(d);
    const f = check(d, { quiet: true });
    const ok = mutate ? f.some((x) => x.startsWith(tag + ' ·')) : f.length === 0;
    if (!ok) sabotageBad++;
    console.log(`  ${ok ? '✓' : '✗'} ${name} — ${mutate ? (ok ? 'caught by ' + tag : 'NOT CAUGHT' + (f.length ? ' (only: ' + f[0].slice(0, 80) + ')' : '')) : (ok ? 'passes' : 'FAILS: ' + f[0])}`);
  } catch (e) { sabotageBad++; console.log(`  ✗ ${name} — the sabotage itself broke: ${e.message}`); }
  finally { fs.rmSync(d, { recursive: true, force: true }); }
}

if (real.length || sabotageBad) {
  console.log(`\nFAILED — ${real.length} check(s) on the repo, ${sabotageBad} sabotage case(s) not caught.`);
  process.exit(1);
}
console.log('\ndocs-moved OK — every old line is in the new set, every size limit holds, every rule and quote survives, and all seven sabotages were caught.');
process.exit(0);
