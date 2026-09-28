// @ts-check
// A6 — tables are not writable by signed-in users. Every write is one api.* function, called through command() in
// src/core/db/command.ts. A `.from(...)` chain that inserts, updates, upserts or deletes is refused anywhere in src/
// (a refused table write came back as 200 and 0 rows and the old screens said "Saved" — CP1, M13). Storage calls
// (`storage.from(bucket)`) are files, not tables, and are not matched.
import ts from 'typescript';
import { defineCheck, lineOfNode, parseSource, select, walkAst } from './lib.mjs';

const WRITES = new Set(['insert', 'update', 'upsert', 'delete']);

/**
 * Walks down a call chain (`a.from('t').select().eq()`) looking for a `.from(...)` call that is not `storage.from`.
 * @param {ts.Expression} expr
 */
function chainHasTableFrom(expr) {
  /** @type {ts.Expression} */
  let e = expr;
  for (let guard = 0; guard < 64; guard++) {
    if (ts.isCallExpression(e)) {
      const callee = e.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'from') {
        const recv = callee.expression;
        const isStorage =
          (ts.isPropertyAccessExpression(recv) && recv.name.text === 'storage') ||
          (ts.isIdentifier(recv) && recv.text === 'storage');
        if (!isStorage) return true;
      }
      e = callee;
    } else if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
      e = e.expression;
    } else if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAwaitExpression(e)) {
      e = e.expression;
    } else return false;
  }
  return false;
}

export default defineCheck({
  name: 'no-table-writes',
  rule: 'A6: no insert/update/upsert/delete on a table from app code — writes go through command() to one api.* function',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    for (const file of select(ctx, ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'])) {
      const sf = parseSource(file, ctx.read(file));
      walkAst(sf, (n) => {
        if (!ts.isCallExpression(n)) return;
        const callee = n.expression;
        /** @type {string} */
        let method = '';
        if (ts.isPropertyAccessExpression(callee)) method = callee.name.text;
        else if (ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression))
          method = callee.argumentExpression.text;
        else return;
        if (WRITES.has(method) && chainHasTableFrom(callee.expression))
          out.push({
            check: 'no-table-writes',
            file,
            line: lineOfNode(sf, n),
            message: `.${method}() on a table — write through command() and an api.* function instead`,
          });
      });
    }
    return out;
  },
});
