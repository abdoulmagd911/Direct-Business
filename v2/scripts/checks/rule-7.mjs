// @ts-check
// Rule 7 (CLAUDE.md; DP4) — this repository is public: no real company, client, person, contact, amount, invoice
// number, identifier or file is ever committed, and no secret. This scanner reads every file under v2/ (tracked, and new
// files not ignored) plus the v2 workflow, and refuses:
//   · e-mail addresses, unless at a reserved domain (example.com/.net/.org, *.example, *.test, *.invalid, localhost)
//     or with a made-up local part (test…, fake…, dummy…, sample…, madeup…) — e.g. test.am1@directksa.com;
//   · Saudi phone numbers (+966 / 00966 / 0…) and other international numbers, unless made up (V101);
//   · Saudi VAT numbers (15 digits, 3…3), CR numbers (city prefixes) and unified numbers (70…), unless made up;
//   · Saudi IBANs, always; ZATCA tax-invoice numbers (DPIN-/TTIN- with digits), unless written DPIN-T-… / TTIN-T-…;
//   · secrets: Supabase keys, JWTs, private keys, GitHub/AWS/Resend/Stripe tokens, database URLs with a password;
//   · terms on the hashed deny-list (scripts/checks/rule7-denylist.txt);
//   · binary files (office files, PDFs, images, archives …) not on scripts/checks/rule7-binaries.txt with a reason.
// The made-up forms are documented in docs/v2/DECISIONS.md V101. Planted values in its own tests are built at run
// time, so this file and its tests never hold a matching literal.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineCheck, globToRegExp, lineOf } from './lib.mjs';

const CHECK = 'rule-7';
const DENYLIST = 'scripts/checks/rule7-denylist.txt';
const BINARIES = 'scripts/checks/rule7-binaries.txt';

const BINARY_EXT =
  /\.(?:pdf|xlsx|xlsm|xlsb|xls|ods|docx|doc|odt|pptx|ppt|odp|zip|gz|tgz|bz2|xz|7z|rar|tar|png|jpe?g|gif|webp|avif|bmp|tiff?|ico|heic|mp4|mov|webm|mp3|wav|m4a|woff2?|ttf|otf|eot|sqlite3?|db|dump|parquet|bin|exe|dll|so|dylib|jar|class)$/i;

// ---------------------------------------------------------------- normalisation

/** Arabic-Indic and extended Arabic-Indic digits to 0–9 (one UTF-16 unit each, so offsets are kept). */
/** @param {string} s */
export function latinDigits(s) {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Folding used by the deny-list: NFKC, lower case, Arabic letter forms, no harakat or tatweel. */
/** @param {string} s */
export function foldTerm(s) {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىئی]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ک/g, 'ك')
    .trim()
    .replace(/\s+/g, ' ');
}

/** The deny-list entry for a term: sha256 of "rule7:" + the folded term. */
/** @param {string} term */
export function termHash(term) {
  return crypto
    .createHash('sha256')
    .update('rule7:' + foldTerm(term))
    .digest('hex');
}

// ---------------------------------------------------------------- patterns

const RESERVED_DOMAIN = /(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/i;
const MADE_UP_LOCAL = /^(?:test|fake|dummy|sample|made-?up)(?:[._+-]|\d|$)/i;
const FILE_TLD =
  /\.(?:png|jpe?g|gif|svg|webp|avif|ico|js|mjs|cjs|ts|tsx|jsx|css|scss|json|md|html?|txt|map|woff2?|sql)$/i;
const TOOL_EMAILS = new Set(['noreply@anthropic.com']);
const TOOL_DOMAIN = /(?:^|\.)users\.noreply\.github\.com$/i;

/** @param {string} local @param {string} domain */
function emailIsMadeUp(local, domain) {
  if (FILE_TLD.test(domain)) return true; // an asset name like icon@2x.png, not an address
  if (RESERVED_DOMAIN.test(domain) || domain.toLowerCase() === 'localhost') return true;
  if (TOOL_EMAILS.has(`${local}@${domain}`.toLowerCase()) || TOOL_DOMAIN.test(domain)) return true;
  return MADE_UP_LOCAL.test(local);
}

/** National significant number (digits after the country code, no leading 0). Made up when digits 3–6 are zero. */
/** @param {string} nsn */
function phoneIsMadeUp(nsn) {
  return /^\d{2}0000\d+$/.test(nsn);
}

const digitsOnly = (/** @type {string} */ s) => s.replace(/\D/g, '');

/**
 * @typedef {{ name: string, re: RegExp, madeUp: (m: RegExpExecArray) => boolean, what: string }} Pattern
 * @type {Pattern[]}
 */
const PATTERNS = [
  {
    name: 'email',
    what: 'an e-mail address',
    re: /(?<![A-Za-z0-9._%+-])([A-Za-z0-9][A-Za-z0-9._%+-]*)@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})(?![A-Za-z0-9-])/g,
    madeUp: (m) => emailIsMadeUp(/** @type {string} */ (m[1]), /** @type {string} */ (m[2])),
  },
  {
    name: 'phone-sa',
    what: 'a Saudi phone number',
    re: /(?<![\d+])(?:\+|00)?966[\s-]?(?:\(0\)[\s-]?|0[\s-]?)?([1-9](?:[\s-]?\d){7,8})(?![\d])/g,
    madeUp: (m) => phoneIsMadeUp(digitsOnly(/** @type {string} */ (m[1]))),
  },
  {
    name: 'phone-sa-local',
    what: 'a Saudi phone number',
    re: /(?<![\d+])0((?:5\d|1[1-7])(?:[\s-]?\d){7})(?![\d])/g,
    madeUp: (m) => phoneIsMadeUp(digitsOnly(/** @type {string} */ (m[1]))),
  },
  {
    name: 'phone-intl',
    what: 'an international phone number',
    re: /(?<![\w+])\+(?!966)([1-9]\d{0,2})[\s-]?(\d(?:[\s().-]{0,2}\d){6,12})(?![\d])/g,
    madeUp: (m) => /0{5,}/.test(digitsOnly(/** @type {string} */ (m[2]))),
  },
  {
    name: 'vat-sa',
    what: 'a Saudi VAT number',
    re: /(?<!\d)3\d{13}3(?!\d)/g,
    madeUp: (m) => /^30{10}\d{3}3$/.test(m[0]),
  },
  {
    name: 'cr-sa',
    what: 'a Saudi commercial registration number',
    re: /(?<!\d)(?:1010|1131|2050|2051|2055|2250|3350|3550|4030|4031|4032|4650|4700|5850|5855|5900|5950)\d{6}(?!\d)/g,
    madeUp: (m) => /^\d{4}0000\d{2}$/.test(m[0]),
  },
  {
    name: 'unified-sa',
    what: 'a Saudi unified (700) number',
    re: /(?<!\d)70\d{8}(?!\d)/g,
    madeUp: (m) => /^700000\d{4}$/.test(m[0]),
  },
  {
    name: 'iban-sa',
    what: 'a Saudi IBAN',
    re: /(?<![A-Za-z0-9])SA\d{2}(?:[ ]?[0-9A-Z]{4}){5}(?![A-Za-z0-9])/g,
    madeUp: () => false,
  },
  {
    name: 'tax-invoice',
    what: 'a ZATCA tax-invoice number',
    re: /(?<![A-Za-z0-9])(?:DPIN|TTIN)[-_ ]?(T[-_])?\d{3,}(?!\d)/gi,
    madeUp: (m) => !!m[1],
  },
  {
    name: 'supabase-key',
    what: 'a Supabase key',
    re: /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g,
    madeUp: () => false,
  },
  {
    name: 'jwt',
    what: 'a JSON web token',
    re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    madeUp: () => false,
  },
  {
    name: 'private-key',
    what: 'a private key',
    re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g,
    madeUp: () => false,
  },
  {
    name: 'token',
    what: 'an access token',
    re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]{16,}|re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}|xox[abprs]-[A-Za-z0-9-]{10,})\b/g,
    madeUp: () => false,
  },
  {
    name: 'db-url',
    what: 'a database URL with a password',
    re: /\bpostgres(?:ql)?:\/\/([^:\s/@]+):([^@\s/]+)@([^/\s:]+)/g,
    madeUp: (m) => {
      const host = /** @type {string} */ (m[3]).toLowerCase();
      const pw = /** @type {string} */ (m[2]);
      return ['localhost', '127.0.0.1', 'postgres', 'db', 'host.docker.internal'].includes(host) || pw === 'postgres';
    },
  },
];

// ---------------------------------------------------------------- lists

/** @param {import('./lib.mjs').Ctx} ctx @param {string} rel */
function listLines(ctx, rel) {
  if (!ctx.exists(rel)) return [];
  return ctx
    .read(rel)
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);
}

/** @param {Buffer} buf */
function looksBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** Words and adjacent word pairs of a text, folded. @param {string} text */
function termsOf(text) {
  const words = [...foldTerm(text).matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: m[0], i: m.index ?? 0 }));
  /** @type {{ term: string, offset: number }[]} */
  const out = [];
  for (let k = 0; k < words.length; k++) {
    const a = /** @type {{w: string, i: number}} */ (words[k]);
    out.push({ term: a.w, offset: a.i });
    const b = words[k + 1];
    if (b) out.push({ term: `${a.w} ${b.w}`, offset: a.i });
  }
  return out;
}

export default defineCheck({
  name: CHECK,
  rule: 'Rule 7: no real data and no secrets in the repository (made-up values only — V101)',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const deny = new Set(listLines(ctx, DENYLIST).map((l) => l.split(/\s+/)[0]));
    const binaryAllowed = listLines(ctx, BINARIES).map((l) => {
      const [glob, ...reason] = l.split(/\s+—\s+|\s+--\s+/);
      return { re: globToRegExp(/** @type {string} */ (glob).trim()), reason: reason.join(' ').trim() };
    });
    const files = [...ctx.files()];
    // The v2 workflow lives outside v2/ but belongs to v2.
    /** @type {string[]} */
    const extra = [];
    if (ctx.repoRoot) {
      const wf = path.relative(ctx.root, path.join(ctx.repoRoot, '.github/workflows/v2.yml')).split(path.sep).join('/');
      if (ctx.exists(wf)) extra.push(wf);
    }
    for (const file of [...files, ...extra]) {
      const abs = path.join(ctx.root, file);
      const buf = fs.readFileSync(abs);
      // a file's own name is content too
      for (const { term } of termsOf(file))
        if (deny.has(termHash(term)))
          out.push({ check: CHECK, file, line: 0, message: 'the file name holds a term on the rule-7 deny-list' });
      if (BINARY_EXT.test(file) || looksBinary(buf)) {
        const ok = binaryAllowed.find((b) => b.re.test(file) && b.reason.length >= 10);
        if (!ok)
          out.push({
            check: CHECK,
            file,
            line: 0,
            message: `binary file not on ${BINARIES} (with a reason) — real files go to Drive, never here`,
          });
        continue;
      }
      const text = buf.toString('utf8');
      const scan = latinDigits(text);
      for (const p of PATTERNS) {
        p.re.lastIndex = 0;
        for (let m; (m = p.re.exec(scan));) {
          if (p.madeUp(m)) continue;
          out.push({
            check: CHECK,
            file,
            line: lineOf(scan, m.index),
            message: `${p.what} (${p.name}) — use a made-up value (V101)`,
          });
        }
      }
      if (deny.size)
        for (const { term, offset } of termsOf(text))
          if (deny.has(termHash(term)))
            out.push({
              check: CHECK,
              file,
              line: lineOfFolded(text, offset),
              message: 'a term on the rule-7 deny-list (a real name) — use a made-up one',
            });
    }
    return out;
  },
});

/**
 * foldTerm can change lengths (NFKC, removed harakat), so the offset of a folded word is mapped back by counting the
 * words before it in the original text instead.
 * @param {string} text @param {number} foldedOffset
 */
function lineOfFolded(text, foldedOffset) {
  const folded = foldTerm(text);
  const before = [...folded.slice(0, foldedOffset).matchAll(/[\p{L}\p{N}]+/gu)].length;
  const words = [...text.matchAll(/[\p{L}\p{N}\p{M}ـ]+/gu)];
  const w = words[before];
  return w ? lineOf(text, w.index ?? 0) : 1;
}
