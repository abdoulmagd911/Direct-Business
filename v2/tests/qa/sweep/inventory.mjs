// QA 1, V641 (the owner: "was every button truly USED, not just clicked?"): the inventory of every control.
//
//   node tests/qa/sweep/inventory.mjs <matrix.jsonl> <out dir> [followed-by.csv] [commit]
//
// Reads the every-control crawl's matrix (QA_MATRIX, one JSON line per cell; the English cells only: the labels of the
// other language are the same controls) and writes, to the out dir:
//   inventory.csv  one row per role, width, page and control
//   inventory.md   the same as tables for the job summary (headline, a table per role and width, the register's problems,
//                  then the rows, within the summary's size limit)
//
// The column `followed to its result by` names the test that clicks the control and then reads where its result shows,
// or says "not yet followed". A control counts as VERIFIED only when the register (followed-by.csv, filled in by QA 2)
// names such a test, the test is found in the repo, and the register says where the result shows. The crawl's own press
// ("pressed by the crawl") is a generic look at whether something happened; it never makes a control verified.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const V2 = resolve(HERE, '..', '..', '..');

/** The cell kinds that are controls (the others, such as the size counts, are measurements). */
const KINDS = new Set(['menu entry', 'link', 'button', 'tab', 'filter', 'toggle', 'menu', 'section']);
/** The result texts of a control the crawl listed but did not press. */
const NOT_PRESSED = /^(not pressed|listed, not pressed|disabled when|already on or selected|cannot be pressed)/;
/** What the job summary may hold: GitHub refuses a step summary over 1 MiB. */
const BUDGET = 900_000;

/** A small CSV reader (quotes, doubled quotes, commas and line breaks inside quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}
const csvField = (s) => (/[",\n\r]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const mdCell = (s) =>
  String(s)
    .replace(/\|/g, '/')
    .replace(/[\r\n]+/g, ' ');

/** The register: page, control, role (* or a list), width (* or 375 / 1440), test, reads (where the result shows). */
export function readRegister(file) {
  if (!file || !existsSync(file)) return [];
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const head = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (name) => head.indexOf(name);
  for (const need of ['page', 'control', 'role', 'width', 'test', 'reads'])
    if (col(need) < 0) throw new Error(`followed-by.csv has no "${need}" column (it has: ${head.join(', ')})`);
  return rows
    .filter((r) => !String(r[0] ?? '').startsWith('#'))
    .map((r, i) => ({
      line: i + 2,
      page: (r[col('page')] ?? '').trim(),
      control: (r[col('control')] ?? '').trim(),
      roles: (r[col('role')] ?? '*').trim() || '*',
      width: (r[col('width')] ?? '*').trim() || '*',
      test: (r[col('test')] ?? '').trim(),
      reads: (r[col('reads')] ?? '').trim(),
      used: false,
    }));
}

/** A named test exists when its file is in the repo and its title is written in that file: "tests/e2e/x.spec.ts › the title". */
export function findTest(ref, v2 = V2) {
  const m = ref.match(/^(.+?\.(?:spec|test)\.[tj]sx?)\s*(?:›|>>|::)\s*(.+)$/);
  if (!m) return { ok: false, why: 'write it as "tests/e2e/file.spec.ts › the test title"' };
  const file = resolve(v2, m[1].trim());
  if (!file.startsWith(v2) || !existsSync(file)) return { ok: false, why: `no file ${m[1].trim()}` };
  const title = m[2].trim();
  return readFileSync(file, 'utf8').includes(title)
    ? { ok: true }
    : { ok: false, why: `the title is not written in ${m[1].trim()}` };
}

export function buildInventory(cells, register, v2 = V2) {
  const rows = new Map();
  for (const c of cells) {
    if (c.lang !== 'en' || !KINDS.has(c.kind)) continue;
    const key = [c.role, c.width, c.route, c.kind, c.control].join('\u0001');
    const pressed = !NOT_PRESSED.test(c.result);
    const prev = rows.get(key);
    // the same control seen twice (a page reached by two links): keep the one with a problem, else the first
    if (prev && (prev.ok || c.ok)) continue;
    rows.set(key, {
      role: c.role,
      width: c.width,
      page: c.route,
      kind: c.kind,
      control: c.control,
      pressed,
      crawl: c.result,
      ok: c.ok,
    });
  }
  const out = [];
  for (const r of rows.values()) {
    const hit = register.find(
      (e) =>
        e.page === r.page &&
        e.control.toLowerCase() === r.control.toLowerCase() &&
        (e.roles === '*' || e.roles.split(/[ ;]+/).includes(r.role)) &&
        (e.width === '*' || String(e.width) === String(r.width)),
    );
    let followed = 'not yet followed';
    let reads = '';
    let verified = false;
    if (hit) {
      hit.used = true;
      const t = findTest(hit.test, v2);
      if (!t.ok) followed = `not yet followed (register names a test that is not found: ${t.why})`;
      else if (!hit.reads) followed = `not yet followed (register names ${hit.test} but not where the result shows)`;
      else {
        followed = hit.test;
        reads = hit.reads;
        verified = true;
      }
    }
    out.push({ ...r, followed, reads, verified });
  }
  const roleOrder = ['admin', 'manager', 'member', 'viewer', 'signed_out'];
  out.sort(
    (a, b) =>
      roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) ||
      b.width - a.width ||
      a.page.localeCompare(b.page) ||
      a.kind.localeCompare(b.kind) ||
      a.control.localeCompare(b.control),
  );
  return out;
}

export function toCsv(rows) {
  const head = [
    'role',
    'width',
    'page',
    'kind',
    'control',
    'pressed by the crawl',
    'what the crawl saw',
    'followed to its result by',
    'where the result shows',
    'verified',
  ];
  const lines = rows.map((r) =>
    [
      r.role,
      r.width,
      r.page,
      r.kind,
      r.control,
      r.pressed ? 'yes' : 'no',
      r.crawl,
      r.followed,
      r.reads,
      r.verified ? 'yes' : 'no',
    ]
      .map(csvField)
      .join(','),
  );
  return `${[head.map(csvField).join(','), ...lines].join('\n')}\n`;
}

export function toMarkdown(rows, register, commit = '') {
  const total = rows.length;
  const done = rows.filter((r) => r.verified).length;
  const pressed = rows.filter((r) => r.pressed).length;
  const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '0%');
  const md = [];
  md.push(`## Inventory of every control${commit ? ` on ${commit}` : ''} (V641)`, '');
  md.push(
    `**${total} controls** (role, width, page and control; English labels), **${done} verified**, **${total - done} not verified**.`,
    '',
    'A control counts as *verified* only when a named test clicks it and then reads where its result shows (the register ' +
      '`v2/tests/qa/sweep/followed-by.csv`, filled in by QA 2). The crawl pressing a control and seeing something change ' +
      `is not that: it pressed ${pressed} of the ${total} (${pct(pressed, total)}), and the rest it listed without pressing. ` +
      'The same table is in the CSV `inventory.csv` (the workflow artifact "control-inventory").',
    '',
  );
  // per role and width
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.role} · ${r.width} px`;
    const g = groups.get(k) ?? { n: 0, pressed: 0, done: 0, pages: new Set() };
    g.n++;
    if (r.pressed) g.pressed++;
    if (r.verified) g.done++;
    g.pages.add(r.page);
    groups.set(k, g);
  }
  md.push(
    '### By role and width',
    '',
    '| Role · width | Pages | Controls | Pressed by the crawl | Verified | Not verified |',
    '|---|---|---|---|---|---|',
  );
  for (const [k, g] of groups)
    md.push(`| ${k} | ${g.pages.size} | ${g.n} | ${g.pressed} | ${g.done} | ${g.n - g.done} |`);
  md.push('');
  // per page (all roles and widths): distinct controls
  const pages = new Map();
  for (const r of rows) {
    const g = pages.get(r.page) ?? { ids: new Set(), done: new Set(), roles: new Set() };
    const id = `${r.kind}\u0001${r.control}`;
    g.ids.add(id);
    g.roles.add(r.role);
    if (r.verified) g.done.add(id);
    pages.set(r.page, g);
  }
  md.push(
    '### By page (distinct controls over all roles and widths)',
    '',
    '| Page | Roles | Distinct controls | Verified |',
    '|---|---|---|---|',
  );
  for (const [p, g] of [...pages].sort((a, b) => a[0].localeCompare(b[0])))
    md.push(`| \`${mdCell(p)}\` | ${[...g.roles].join(', ')} | ${g.ids.size} | ${g.done.size} |`);
  md.push('');
  // the register's problems
  const unused = register.filter((e) => !e.used);
  const broken = rows.filter((r) => /register names/.test(r.followed)).length;
  if (unused.length || broken) {
    md.push('### The register has problems', '');
    if (unused.length)
      md.push(
        `${unused.length} register line(s) match no control in this run (a typo in the page, the control, the role or the width?): ` +
          unused
            .slice(0, 20)
            .map((e) => `line ${e.line} \`${mdCell(e.page)}\` / \`${mdCell(e.control)}\``)
            .join('; ') +
          (unused.length > 20 ? ' …' : ''),
        '',
      );
    if (broken)
      md.push(
        `${broken} control(s) are named in the register with a test that is not found or without where the result shows; they count as not verified.`,
        '',
      );
  }
  // the rows, per role and width, within the summary's size limit
  md.push('### Every control', '');
  let used = md.join('\n').length;
  let cut = 0;
  const byGroup = new Map();
  for (const r of rows) {
    const k = `${r.role} · ${r.width} px`;
    byGroup.set(k, [...(byGroup.get(k) ?? []), r]);
  }
  for (const [k, list] of byGroup) {
    const lines = [];
    for (const r of list) {
      const line = `| \`${mdCell(r.page)}\` | ${r.kind} | ${mdCell(r.control)} | ${r.pressed ? 'yes' : 'no'} | ${mdCell(r.crawl).slice(0, 90)} | ${mdCell(r.followed)} |`;
      if (used + line.length + 1 > BUDGET) {
        cut++;
        continue;
      }
      used += line.length + 1;
      lines.push(line);
    }
    md.push(
      `<details><summary>${k}: ${list.length} controls, ${list.filter((r) => r.verified).length} verified</summary>`,
      '',
      '| Page | Kind | Control | Pressed | What the crawl saw | Followed to its result by |',
      '|---|---|---|---|---|---|',
      ...lines,
      '',
      '</details>',
      '',
    );
  }
  if (cut) md.push(`*${cut} more row(s) are only in the CSV (the summary is limited to 1 MiB).*`, '');
  return md.join('\n');
}

// run as a script
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , matrixFile, outDir, registerFile = join(HERE, 'followed-by.csv'), commit = ''] = process.argv;
  if (!matrixFile || !outDir) {
    console.error('usage: node inventory.mjs <matrix.jsonl> <out dir> [followed-by.csv] [commit]');
    process.exit(2);
  }
  const cells = existsSync(matrixFile)
    ? readFileSync(matrixFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
  const register = readRegister(registerFile);
  const rows = buildInventory(cells, register);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'inventory.csv'), toCsv(rows));
  writeFileSync(join(outDir, 'inventory.md'), toMarkdown(rows, register, commit));
  console.log(
    `${rows.length} controls, ${rows.filter((r) => r.verified).length} verified, ${register.length} register line(s), ${register.filter((e) => !e.used).length} unmatched`,
  );
}
