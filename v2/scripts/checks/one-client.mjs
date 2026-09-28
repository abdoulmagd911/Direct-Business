// @ts-check
// A4 — one Supabase client. The old app had five clients fighting over refresh tokens and signing people out.
// A client is created only inside src/core/db/ (the browser singleton and the per-request server client); anything
// else imports it from there. Type-only imports of the Supabase packages are allowed anywhere.
import ts from 'typescript';
import { defineCheck, lineOfNode, parseSource, select, walkAst } from './lib.mjs';

const FACTORIES = new Set(['createClient', 'createBrowserClient', 'createServerClient']);
const PACKAGES = /^@supabase\/(supabase-js|ssr)(\/|$)/;

export default defineCheck({
  name: 'one-client',
  rule: 'A4: a Supabase client is created only inside src/core/db/',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const files = select(ctx, ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'], ['src/core/db/**']);
    for (const file of files) {
      const sf = parseSource(file, ctx.read(file));
      walkAst(sf, (n) => {
        if (
          ts.isImportDeclaration(n) &&
          ts.isStringLiteral(n.moduleSpecifier) &&
          PACKAGES.test(n.moduleSpecifier.text)
        ) {
          const clause = n.importClause;
          const typeOnly =
            !!clause &&
            (clause.isTypeOnly ||
              (!clause.name &&
                !!clause.namedBindings &&
                ts.isNamedImports(clause.namedBindings) &&
                clause.namedBindings.elements.every((e) => e.isTypeOnly)));
          if (!typeOnly)
            out.push({
              check: 'one-client',
              file,
              line: lineOfNode(sf, n),
              message: `imports ${n.moduleSpecifier.text} outside src/core/db/ — use the client from src/core/db`,
            });
        } else if (
          ts.isCallExpression(n) &&
          (n.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(n.expression) && n.expression.text === 'require')) &&
          n.arguments[0] &&
          ts.isStringLiteralLike(n.arguments[0]) &&
          PACKAGES.test(n.arguments[0].text)
        ) {
          out.push({
            check: 'one-client',
            file,
            line: lineOfNode(sf, n),
            message: `loads ${n.arguments[0].text} outside src/core/db/ — use the client from src/core/db`,
          });
        } else if (ts.isCallExpression(n)) {
          const callee = n.expression;
          const name = ts.isIdentifier(callee)
            ? callee.text
            : ts.isPropertyAccessExpression(callee)
              ? callee.name.text
              : '';
          if (FACTORIES.has(name))
            out.push({
              check: 'one-client',
              file,
              line: lineOfNode(sf, n),
              message: `${name}() outside src/core/db/ — there is one browser client and one server client per request`,
            });
        }
      });
    }
    return out;
  },
});
