// @ts-check
// M1 — VAT never enters cost, profit or revenue, and no VAT figure is stored or shown (D21). No column, view column or
// identifier named for a VAT amount may exist in a migration: an identifier with a part "vat" (vat_amount, sar_vat,
// "VAT") or a tax amount (tax_amount, tax_sar, amount_tax, total_tax …). Tax NUMBERS and the tax invoice (DPIN) are
// not amounts: tax_no_raw, tax_key and tax_invoice are allowed. A string 'vat' (an identifier kind) is not a name.
import { defineCheck, lineOf, sqlIdentifiers } from './lib.mjs';

const CHECK = 'no-vat-columns';

/** @param {string} name */
export function isVatName(name) {
  const parts = name
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean);
  if (parts.some((p) => /^vats?\d*$/.test(p))) return true;
  const amountish = new Set(['amount', 'amt', 'sar', 'value', 'total', 'sum', 'due', 'paid']);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== 'tax') continue;
    if (amountish.has(parts[i + 1] ?? '') || amountish.has(parts[i - 1] ?? '')) return true;
  }
  return false;
}

export default defineCheck({
  name: CHECK,
  rule: 'M1: no column or identifier named for a VAT (or tax) amount in any migration',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    for (const file of ctx.files().filter((f) => /^supabase\/.*\.sql$/.test(f))) {
      const sql = ctx.read(file);
      const seen = new Set();
      for (const { name, offset } of sqlIdentifiers(sql)) {
        if (!isVatName(name)) continue;
        const line = lineOf(sql, offset);
        if (seen.has(`${line}:${name}`)) continue;
        seen.add(`${line}:${name}`);
        out.push({
          check: CHECK,
          file,
          line,
          message: `"${name}" is named for a VAT/tax amount — no VAT figure is stored (M1)`,
        });
      }
    }
    return out;
  },
});
