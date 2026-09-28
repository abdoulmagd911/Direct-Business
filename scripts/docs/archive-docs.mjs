/* archive-docs.mjs — moves the long working docs into word-for-word archives (2026-09-27, the oversight's docs
   restructure). Nothing is deleted: each old file, exactly as it stood at one commit, is cut into pieces under 40,000
   characters at heading boundaries; the pieces joined back together ARE the old file, byte for byte, and
   scripts/qa/check-docs-moved.mjs proves it on every battery run.

   Run:  node scripts/docs/archive-docs.mjs <commit>
   Writes: docs/history/backlog/, docs/history/decisions/, docs/history/claude-md/ (the old working files) and
           docs/reference/playbook/, docs/reference/master-brief/ (the two long references, split, still current
           reading when needed), each with a README.md index, plus docs/history/moved.json (the manifest the check reads).
   It never touches the new short working files (docs/BACKLOG.md, docs/DECISIONS.md, CLAUDE.md) — those are written by
   a person. Re-run it after a rebase if the old files changed underneath, with the new commit. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const COMMIT = process.argv[2];
if (!COMMIT) { console.error('usage: node scripts/docs/archive-docs.mjs <commit>'); process.exit(2); }
const SHA = execFileSync('git', ['rev-parse', COMMIT], { cwd: ROOT }).toString().trim();
const LIMIT = 38000;                       // characters per piece; the check allows up to 40,000

const JOBS = [
  { old: 'docs/BACKLOG.md', dir: 'docs/history/backlog', prefix: 'backlog', title: 'The old BACKLOG.md (work log)' },
  { old: 'docs/DECISIONS.md', dir: 'docs/history/decisions', prefix: 'decisions', title: 'The old DECISIONS.md (full text of every rule)' },
  { old: 'CLAUDE.md', dir: 'docs/history/claude-md', prefix: 'claude-md', title: 'The old CLAUDE.md' },
  { old: 'docs/DIRECT_SYSTEMS_PLAYBOOK.md', dir: 'docs/reference/playbook', prefix: 'playbook', title: 'Direct — Systems & Data Playbook' },
  { old: 'docs/DIRECT_MASTER_BRIEF.md', dir: 'docs/reference/master-brief', prefix: 'master-brief', title: 'Direct Master Brief — Full Reference (v2)' },
];

const cp = (s) => [...s].length;

/* Cut before line j, strongest first: "# " 4, "## " 3, "### " 2, a bold rule start after a blank line 1.5, any
   paragraph start 1; never inside a ``` fence; never a piece under 40% of the limit unless the file ends. */
function split(text) {
  const lines = text.split(/(?<=\n)/);
  let fence = false; const inFence = [];
  for (const l of lines) { inFence.push(fence); if (/^\s*```/.test(l)) fence = !fence; }
  const strength = lines.map((l, j) => {
    if (j === 0 || inFence[j]) return 0;
    if (/^# /.test(l)) return 4; if (/^## /.test(l)) return 3; if (/^### /.test(l)) return 2;
    if (/^\s*$/.test(lines[j - 1]) && /^\*\*/.test(l)) return 1.5;
    if (/^\s*$/.test(lines[j - 1])) return 1;
    return 0;
  });
  const cuts = []; let start = 0;
  while (start < lines.length) {
    let acc = 0, end = start; const cands = [];
    for (let i = start; i < lines.length; i++) {
      const L = cp(lines[i]);
      if (acc + L > LIMIT && i > start) break;
      acc += L; end = i + 1;
      if (end < lines.length && acc >= LIMIT * 0.4 && strength[end] > 0) cands.push([end, strength[end]]);
    }
    let cut = end;
    if (end < lines.length && cands.length) { const m = Math.max(...cands.map((c) => c[1])); cut = cands.filter((c) => c[1] === m).pop()[0]; }
    cuts.push([start, cut]); start = cut;
  }
  return { lines, inFence, cuts };
}

const manifest = { note: 'Written by scripts/docs/archive-docs.mjs; checked by scripts/qa/check-docs-moved.mjs. Each old file, as it stood at `commit`, is the pieces joined in order, byte for byte.', commit: SHA, files: [] };

for (const job of JOBS) {
  const text = execFileSync('git', ['show', `${SHA}:${job.old}`], { cwd: ROOT, maxBuffer: 64 << 20 }).toString('utf8');
  const { lines, inFence, cuts } = split(text);
  const dir = path.join(ROOT, job.dir);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const w = Math.max(2, String(cuts.length).length);
  const pieces = cuts.map(([a, b], k) => {
    const body = lines.slice(a, b).join('');
    const name = `${job.prefix}-${String(k + 1).padStart(w, '0')}.md`;
    fs.writeFileSync(path.join(dir, name), body);
    const heads = lines.slice(a, b).filter((l, i) => !inFence[a + i] && /^#{1,3} /.test(l)).map((l) => l.trim());
    const ids = job.prefix === 'decisions'
      ? [...new Set(lines.slice(a, b).map((l) => (l.match(/^\*\*((?:P|M|D)\d+[a-z]?)\b/) || [])[1]).filter(Boolean))] : [];
    const dates = (heads.join(' ').match(/\b20\d\d-\d\d-\d\d\b/g) || []).sort();   // dates in its headings
    const fires = (heads.join(' ').match(/(?:fire|Fire) #(\d+)/g) || []).map((f) => +f.replace(/\D/g, ''));
    return { name, fromLine: a + 1, toLine: b, chars: cp(body), heads, ids, dates, fires };
  });
  const joined = pieces.map((p) => fs.readFileSync(path.join(dir, p.name), 'utf8')).join('');
  if (joined !== text) { console.error(`JOIN MISMATCH for ${job.old} — nothing written is trustworthy`); process.exit(1); }
  const sha256 = crypto.createHash('sha256').update(text).digest('hex');
  manifest.files.push({ old: job.old, archive: job.dir, sha256, chars: cp(text), lines: lines.length, pieces: pieces.map((p) => p.name) });

  /* the index a person reads */
  const esc = (s) => s.replace(/\|/g, '\\|').replace(/^#+\s*/, '').slice(0, 110);
  let md = `# ${job.title} — index\n\n`;
  md += `\`${job.old}\` as it stood at commit \`${SHA.slice(0, 12)}\` (${cp(text).toLocaleString('en')} characters, ${lines.length.toLocaleString('en')} lines), `;
  md += `cut word for word into ${pieces.length} pieces under 40,000 characters. Joined in order they are the old file byte for byte `;
  md += `(SHA-256 \`${sha256}\`); \`scripts/qa/check-docs-moved.mjs\` proves it on every battery run. Nothing here is edited — `;
  md += job.dir.startsWith('docs/history') ? 'this is the archive; the working file is short now.\n\n' : 'this is still reference material; open the part you need. It is no longer required reading.\n\n';
  if (job.prefix === 'backlog' || job.prefix === 'claude-md' || job.prefix === 'decisions')
    md += 'Old knowledge-base part names inside are kept as written; the Drive file "09 Sources index" says where each old part now lives (finance: 04; the app: 05; how sessions run: 06).\n\n';
  if (job.prefix === 'decisions') {
    md += '| Piece | Old lines | Rules that start in it |\n|---|---|---|\n';
    for (const p of pieces) md += `| [${p.name}](${p.name}) | ${p.fromLine}–${p.toLine} | ${p.ids.join(', ') || esc(p.heads[0] || '')} |\n`;
  } else if (job.prefix === 'backlog') {
    md += '| Piece | Old lines | Dates in its headings | Fire numbers | First heading |\n|---|---|---|---|---|\n';
    for (const p of pieces) {
      const d = p.dates.length ? `${p.dates[0]} … ${p.dates[p.dates.length - 1]}` : '';
      const f = p.fires.length ? `#${Math.min(...p.fires)}–#${Math.max(...p.fires)}` : '';
      md += `| [${p.name}](${p.name}) | ${p.fromLine}–${p.toLine} | ${d} | ${f} | ${esc(p.heads[0] || '')} |\n`;
    }
  } else {
    md += '| Piece | Old lines | Headings |\n|---|---|---|\n';
    for (const p of pieces) md += `| [${p.name}](${p.name}) | ${p.fromLine}–${p.toLine} | ${p.heads.filter((h) => /^#{1,2} /.test(h)).map(esc).join(' · ')} |\n`;
  }
  fs.writeFileSync(path.join(dir, 'README.md'), md);
  console.log(`${job.old}: ${pieces.length} pieces, largest ${Math.max(...pieces.map((p) => p.chars))} characters, index ${cp(md)} characters`);
}
fs.writeFileSync(path.join(ROOT, 'docs/history/moved.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest: docs/history/moved.json');
