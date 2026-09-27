#!/usr/bin/env node
/* sql-guard.mjs — runs before every database call a Claude session makes (PreToolUse on mcp__Supabase__execute_sql and
   mcp__Supabase__apply_migration). The owner's standing permissions (START HERE §8, 27 Sep; applied 28 Sep):
     · reading is free, and so is a rolled-back dry run (BEGIN … ROLLBACK, no COMMIT inside);
     · execute_sql that WRITES live data or changes structure outside such a dry run → ask the owner (INSERT, UPDATE,
       DELETE, MERGE, UPSERT, COPY, TRUNCATE, DROP, ALTER, CREATE, GRANT, REVOKE, and any call on the auth schema);
     · apply_migration is how a reviewed PR's database change is applied at merge — free, EXCEPT the always-ask list:
       deleting a live table (DROP TABLE / TRUNCATE / DELETE FROM) or changing who can sign in (the auth schema, roles).
   Anything this guard cannot read is asked, never waved through. */
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const ask = (why) => { process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: why } })); process.exit(0); };
  let ev; try { ev = JSON.parse(raw || '{}'); } catch (_) { return ask('sql-guard: could not read the call — asking instead of guessing'); }
  const tool = String(ev.tool_name || ''), inp = ev.tool_input || {};
  const sql = String(inp.query || inp.sql || '');
  if (!sql) return ask('sql-guard: no SQL text found in the call');
  /* strip comments and string literals so a word inside a quote or a comment decides nothing */
  const bare = sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, ' $body$ ')
    .replace(/'(?:[^']|'')*'/g, "''").toLowerCase().replace(/\s+/g, ' ').trim();
  const alwaysAsk = /\b(drop\s+table|drop\s+schema|truncate|delete\s+from|alter\s+role|create\s+role|drop\s+role)\b|\bauth\s*\./;
  if (tool.endsWith('apply_migration')) {
    if (alwaysAsk.test(bare)) return ask('sql-guard: this migration deletes a live table or rows, or touches sign-in (auth / roles) — the owner decides that on the day');
    process.exit(0);
  }
  const dryRun = /^begin\b/.test(bare) && /\brollback\s*;?\s*$/.test(bare) && !/\bcommit\b/.test(bare) && !/\bend\s*;/.test(bare.replace(/\$body\$/g, ''));
  if (dryRun) process.exit(0);
  const writes = /\b(insert|update|delete|merge|upsert|copy|truncate|drop|alter|create|grant|revoke|comment\s+on|refresh\s+materialized|vacuum|reindex|call|do)\b|\bauth\s*\./;
  if (writes.test(bare)) return ask('sql-guard: this query writes to the live database or changes its structure outside a BEGIN … ROLLBACK dry run');
  process.exit(0);
});
