// @ts-check
// Shared helpers for the v2 checks (TECH-SPEC §9.1). A check is `defineCheck({ name, rule, run })`; `run(ctx)`
// returns findings. `scripts/checks/run.mjs` runs them; each has a planted violation under tests/sabotage/ that must
// turn it red (V100).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * @typedef {{ check: string, file: string, line: number, message: string }} Finding
 * @typedef {{
 *   root: string,
 *   repoRoot: string | null,
 *   files: () => string[],
 *   read: (rel: string) => string,
 *   exists: (rel: string) => boolean,
 *   git: (args: string[]) => string,
 *   env: Record<string, string | undefined>,
 * }} Ctx
 * @typedef {{ name: string, rule: string, run: (ctx: Ctx) => Finding[] | Promise<Finding[]> }} Check
 */

/** @param {Check} def */
export function defineCheck(def) {
  return def;
}

const WALK_SKIP = new Set(['node_modules', '.next', 'out', 'coverage', 'test-results', 'playwright-report', '.git']);

/** @param {string} dir @param {string} base @param {string[]} acc */
function walk(dir, base, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (WALK_SKIP.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, base, acc);
    else if (entry.isFile()) acc.push(path.relative(base, abs).split(path.sep).join('/'));
  }
}

/**
 * The context a check runs in. `root` is the v2 folder (or a test fixture folder). Files are listed through git when
 * `root` is inside a repository (tracked files plus new files that are not ignored), else by walking the folder.
 * @param {string} root
 * @param {Record<string, string | undefined>} [env]
 * @returns {Ctx}
 */
export function makeCtx(root, env = process.env) {
  const absRoot = path.resolve(root);
  /** @type {string | null} */
  let repoRoot = null;
  try {
    repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: absRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    repoRoot = null;
  }
  /** @type {string[] | null} */
  let cache = null;
  const git = (/** @type {string[]} */ args) =>
    execFileSync('git', args, {
      cwd: absRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    }).toString();
  return {
    root: absRoot,
    repoRoot,
    env,
    git,
    exists: (rel) => fs.existsSync(path.join(absRoot, rel)),
    read: (rel) => fs.readFileSync(path.join(absRoot, rel), 'utf8'),
    files: () => {
      if (cache) return cache;
      /** @type {string[]} */
      let list = [];
      if (repoRoot) {
        list = git(['ls-files', '-co', '--exclude-standard', '-z', '--', '.'])
          .split('\0')
          .filter(Boolean)
          .filter((f) => fs.existsSync(path.join(absRoot, f)));
      } else {
        walk(absRoot, absRoot, list);
      }
      cache = [...new Set(list)].sort();
      return cache;
    },
  };
}

/** Display path of a file for a finding: relative to the repository root when there is one. */
/** @param {Ctx} ctx @param {string} rel */
export function shown(ctx, rel) {
  if (!ctx.repoRoot) return rel;
  return path.relative(ctx.repoRoot, path.join(ctx.root, rel)).split(path.sep).join('/');
}

/**
 * Glob-lite matcher: `**` any depth, `*` within one segment, `{a,b}` alternatives.
 * @param {string} glob
 */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      re +=
        '(?:' +
        glob
          .slice(i + 1, end)
          .split(',')
          .map(escapeRe)
          .join('|') +
        ')';
      i = end;
    } else re += escapeRe(/** @type {string} */ (c));
  }
  return new RegExp('^' + re + '$');
}

/** @param {string} s */
export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Files of the context matching any of `include` and none of `exclude`.
 * @param {Ctx} ctx @param {string[]} include @param {string[]} [exclude]
 */
export function select(ctx, include, exclude = []) {
  const inc = include.map(globToRegExp);
  const exc = exclude.map(globToRegExp);
  return ctx.files().filter((f) => inc.some((r) => r.test(f)) && !exc.some((r) => r.test(f)));
}

/** 1-based line number of a character offset. @param {string} text @param {number} offset */
export function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

const ALLOW_RE = /check-allow:\s*([a-z0-9-]+)\s*(?:—|--|-|:)\s*(.{10,})/;

/**
 * A finding on `line` is waived when that line, or the line just above it, carries
 * `check-allow: <check> — <a reason of at least ten characters>` (V100).
 * @param {string} text @param {number} line @param {string} check
 */
export function allowed(text, line, check) {
  const lines = text.split('\n');
  for (const n of [line, line - 1]) {
    const l = lines[n - 1];
    if (!l) continue;
    const m = ALLOW_RE.exec(l);
    if (m && m[1] === check) return true;
  }
  return false;
}

/**
 * Runs one check: findings carry paths relative to `ctx.root` while running; this drops the ones waived by an allow
 * comment in their own file and returns them with display paths.
 * @param {Check} check @param {Ctx} ctx
 * @returns {Promise<Finding[]>}
 */
export async function runCheck(check, ctx) {
  const raw = await check.run(ctx);
  /** @type {Map<string, string>} */
  const texts = new Map();
  const text = (/** @type {string} */ rel) => {
    if (!texts.has(rel)) texts.set(rel, ctx.exists(rel) ? safeRead(ctx, rel) : '');
    return /** @type {string} */ (texts.get(rel));
  };
  return raw
    .filter((f) => !(f.line > 0 && allowed(text(f.file), f.line, f.check)))
    .map((f) => ({ ...f, file: shown(ctx, f.file) }));
}

/** @param {Ctx} ctx @param {string} rel */
function safeRead(ctx, rel) {
  try {
    return ctx.read(rel);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------- TypeScript / JavaScript sources

/** @param {string} file */
function scriptKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.ts') || file.endsWith('.mts') || file.endsWith('.cts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

/** @param {string} file @param {string} text */
export function parseSource(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
}

/** Depth-first visit of every node. @param {ts.Node} node @param {(n: ts.Node) => void} visit */
export function walkAst(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walkAst(child, visit));
}

/**
 * Every piece of literal text in a source file — string literals, template pieces, regular expression literals and JSX
 * text — with its line.
 * @param {ts.SourceFile} sf
 * @returns {{ text: string, line: number, kind: 'string' | 'template' | 'regex' | 'jsx' }[]}
 */
export function literals(sf) {
  /** @type {{ text: string, line: number, kind: 'string' | 'template' | 'regex' | 'jsx' }[]} */
  const out = [];
  walkAst(sf, (n) => {
    const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      // an import path is not content
      if (
        ts.isImportDeclaration(n.parent) ||
        ts.isExportDeclaration(n.parent) ||
        ts.isExternalModuleReference(n.parent)
      )
        return;
      out.push({ text: n.text, line, kind: 'string' });
    } else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      out.push({ text: n.text, line, kind: 'template' });
    } else if (ts.isRegularExpressionLiteral(n)) {
      out.push({ text: n.text, line, kind: 'regex' });
    } else if (ts.isJsxText(n)) {
      out.push({ text: n.text, line, kind: 'jsx' });
    }
  });
  return out;
}

/** @param {ts.SourceFile} sf @param {ts.Node} n */
export function lineOfNode(sf, n) {
  return sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
}

/**
 * Tailwind-style class tokens of a literal: whitespace-separated, variants (`md:`, `hover:`, `rtl:`) and the
 * important mark removed, opacity suffix kept.
 * @param {string} text
 */
export function classTokens(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const bare = t.includes(':') && !t.includes('[') ? t.slice(t.lastIndexOf(':') + 1) : t;
      return bare.replace(/^!/, '').replace(/!$/, '');
    });
}

// ---------------------------------------------------------------- CSS sources

/**
 * CSS text with comments and quoted strings blanked out (offsets and lines kept). Custom properties (`--x`) are code.
 * @param {string} css
 */
export function cssCode(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => m[0] + m.slice(1, -1).replace(/[^\n]/g, ' ') + m[0]);
}

// ---------------------------------------------------------------- SQL sources

/**
 * SQL text with comments and single-quoted string literals blanked out (replaced by spaces, so offsets and line
 * numbers are kept). Dollar-quoted bodies are kept: code inside a function counts.
 * @param {string} sql
 */
export function sqlCode(sql) {
  let out = '';
  let i = 0;
  const n = sql.length;
  const blank = (/** @type {string} */ s) => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === '-' && d === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += blank(sql.slice(i, stop));
      i = stop;
    } else if (c === '/' && d === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += blank(sql.slice(i, stop));
      i = stop;
    } else if (c === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j++;
      }
      out += "'" + blank(sql.slice(i + 1, j)) + (j < n ? "'" : '');
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * The top-level comma-separated parts of the parenthesised list that starts at `open` (the index of "(").
 * @param {string} text @param {number} open
 * @returns {{ parts: { text: string, offset: number }[], end: number }}
 */
export function parenParts(text, open) {
  /** @type {{ text: string, offset: number }[]} */
  const parts = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        parts.push({ text: text.slice(start, i), offset: start });
        return { parts, end: i };
      }
    } else if (c === ',' && depth === 1) {
      parts.push({ text: text.slice(start, i), offset: start });
      start = i + 1;
    }
  }
  return { parts, end: text.length };
}

const CONSTRAINT_WORDS = new Set(['constraint', 'primary', 'unique', 'check', 'foreign', 'exclude', 'like']);

/**
 * Column definitions found in `create table` and `alter table … add column` statements.
 * @param {string} sql raw SQL
 * @returns {{ table: string, column: string, type: string, offset: number }[]}
 */
export function sqlColumns(sql) {
  const code = sqlCode(sql);
  /** @type {{ table: string, column: string, type: string, offset: number }[]} */
  const cols = [];
  const ident = '(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)';
  const tableName = `(${ident}(?:\\s*\\.\\s*${ident})?)`;
  const unq = (/** @type {string} */ s) => s.replace(/"/g, '').replace(/\s+/g, '').toLowerCase();
  const createRe = new RegExp(
    `create\\s+(?:(?:global\\s+|local\\s+)?(?:temporary|temp|unlogged)\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?${tableName}\\s*\\(`,
    'gi',
  );
  for (let m; (m = createRe.exec(code));) {
    const table = unq(/** @type {string} */ (m[1]));
    const open = m.index + m[0].length - 1;
    const { parts } = parenParts(code, open);
    for (const p of parts) {
      const t = p.text.trim();
      if (!t) continue;
      const words = t.split(/\s+/);
      const first = /** @type {string} */ (words[0]).toLowerCase();
      if (CONSTRAINT_WORDS.has(first)) continue;
      const lead = p.text.length - p.text.trimStart().length;
      cols.push({
        table,
        column: unq(/** @type {string} */ (words[0])),
        type: words.slice(1).join(' ').toLowerCase(),
        offset: p.offset + lead,
      });
    }
  }
  const alterRe = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${tableName}([\\s\\S]*?);`, 'gi');
  for (let m; (m = alterRe.exec(code));) {
    const table = unq(/** @type {string} */ (m[1]));
    const body = /** @type {string} */ (m[2]);
    const bodyStart = m.index + m[0].length - body.length - 1;
    const addRe = new RegExp(`add\\s+(?:column\\s+)?(?:if\\s+not\\s+exists\\s+)?(${ident})\\s+([^,;]+)`, 'gi');
    for (let a; (a = addRe.exec(body));) {
      const column = unq(/** @type {string} */ (a[1]));
      if (CONSTRAINT_WORDS.has(column)) continue;
      cols.push({
        table,
        column,
        type: /** @type {string} */ (a[2]).trim().toLowerCase(),
        offset: bodyStart + a.index,
      });
    }
  }
  return cols;
}

/**
 * Every identifier in SQL code (comments and string literals removed), with its offset.
 * @param {string} sql
 */
export function sqlIdentifiers(sql) {
  const code = sqlCode(sql);
  /** @type {{ name: string, offset: number }[]} */
  const out = [];
  const re = /"([^"]+)"|\b([A-Za-z_][A-Za-z0-9_$]*)\b/g;
  for (let m; (m = re.exec(code));) out.push({ name: (m[1] ?? m[2] ?? '').toLowerCase(), offset: m.index });
  return out;
}
