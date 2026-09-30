#!/usr/bin/env node
/* sql-guard.mjs — runs before every database call a Claude session makes (PreToolUse on mcp__Supabase__execute_sql and
   mcp__Supabase__apply_migration). The owner's standing permissions:
     · the v2 project (direct-commercial, kimadjvaxgiqzjaukuqg — owner, 29 Sep, V402): free, EXCEPT destructive
       statements, which are refused: any DROP (a table, a column through ALTER … DROP, a function, a policy …), TRUNCATE,
       DELETE or UPDATE without WHERE, turning row-level security off, disabling a trigger. DO blocks and function
       bodies are read too;
     · the old app's project (vkxoeeoauexyfpzqufqd — owner, 29 Sep): every call is refused;
     · any other project, as before (START HERE §8, 27 Sep): reading is free, and so is a rolled-back dry run
       (BEGIN … ROLLBACK, no COMMIT inside); execute_sql that WRITES live data or changes structure outside such a dry
       run is refused; apply_migration is free EXCEPT deleting a live table or rows, or changing who can sign in.
   Anything this guard cannot read is refused, never waved through. Nothing here ever prompts the owner (his rule of
   30 Sep): a refusal names its reason, and what needs his word goes to the oversight in chat. */
const V2_PROJECT = 'kimadjvaxgiqzjaukuqg';
const OLD_PROJECT = 'vkxoeeoauexyfpzqufqd';

/* The SQL as code only: comments and string literals removed (so a word inside them decides nothing, and a "--" inside
   a string hides nothing), dollar-quoted bodies kept as code (a DO block runs them; a function will). */
function codeOf(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const two = sql.slice(i, i + 2);
    if (two === '--') {
      const j = sql.indexOf('\n', i);
      i = j < 0 ? sql.length : j;
      out += ' ';
    } else if (two === '/*') {
      const j = sql.indexOf('*/', i + 2);
      i = j < 0 ? sql.length : j + 2;
      out += ' ';
    } else if (c === "'") {
      const escaped = /[eE]$/.test(out) && !/\w[eE]$/.test(out);
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) break;
        if (escaped && sql[j] === '\\') {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      i = j + 1;
      out += "''";
    } else if (c === '$') {
      const m = /^\$([A-Za-z_]\w*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const j = sql.indexOf(tag, i + tag.length);
        const body = sql.slice(i + tag.length, j < 0 ? sql.length : j);
        out += ' ; ' + codeOf(body) + ' ; ';
        i = j < 0 ? sql.length : j + tag.length;
      } else {
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/* Why a statement is destructive, or null. */
function destructive(sql) {
  const statements = codeOf(sql).toLowerCase().replace(/\s+/g, ' ').split(';');
  for (const st of statements) {
    if (/\bdrop\b/.test(st)) return 'a DROP';
    if (/\btruncate\b/.test(st)) return 'a TRUNCATE';
    if (/\bdisable\s+row\s+level\s+security\b|\bno\s+force\s+row\s+level\s+security\b/.test(st))
      return 'turning row-level security off';
    if (/\bdisable\s+trigger\b/.test(st)) return 'disabling a trigger';
    const del = /\bdelete\s+from\b/.exec(st);
    if (del && !/\bwhere\b/.test(st.slice(del.index))) return 'a DELETE without WHERE';
    const upd = /(?<!\bdo\s)\bupdate\s+(only\s+)?[\w."]+(\s+(as\s+)?\w+)?\s+set\b/.exec(st);
    if (upd && !/\bwhere\b/.test(st.slice(upd.index))) return 'an UPDATE without WHERE';
  }
  return null;
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const deny = (why) => {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: why } }));
    process.exit(0);
  };
  let ev;
  try {
    ev = JSON.parse(raw || '{}');
  } catch (_) {
    return deny('sql-guard: could not read the call — refused instead of guessing');
  }
  const tool = String(ev.tool_name || ''), inp = ev.tool_input || {};
  const sql = String(inp.query || inp.sql || '');
  const project = String(inp.project_id || '');
  if (!sql) return deny('sql-guard: no SQL text found in the call');
  if (project === OLD_PROJECT) return deny("sql-guard: this call is on the old app's project — refused; the owner's word comes through the oversight in chat");
  if (project === V2_PROJECT) {
    const why = destructive(sql);
    if (why) return deny(`sql-guard: ${why} on the v2 project — destructive, refused; ask the oversight in chat`);
    process.exit(0);
  }
  /* any other project: the rules of 27 Sep */
  const bare = sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, ' $body$ ')
    .replace(/'(?:[^']|'')*'/g, "''").toLowerCase().replace(/\s+/g, ' ').trim();
  const alwaysAsk = /\b(drop\s+table|drop\s+schema|truncate|delete\s+from|alter\s+role|create\s+role|drop\s+role)\b|\bauth\s*\./;
  if (tool.endsWith('apply_migration')) {
    if (alwaysAsk.test(bare)) return deny('sql-guard: this migration deletes a live table or rows, or touches sign-in (auth / roles) — refused; the oversight decides that on the day');
    process.exit(0);
  }
  const dryRun = /^begin\b/.test(bare) && /\brollback\s*;?\s*$/.test(bare) && !/\bcommit\b/.test(bare) && !/\bend\s*;/.test(bare.replace(/\$body\$/g, ''));
  if (dryRun) process.exit(0);
  const writes = /\b(insert|update|delete|merge|upsert|copy|truncate|drop|alter|create|grant|revoke|comment\s+on|refresh\s+materialized|vacuum|reindex|call|do)\b|\bauth\s*\./;
  if (writes.test(bare)) return deny('sql-guard: this query writes to the live database or changes its structure outside a BEGIN … ROLLBACK dry run — refused; a write lands by migration, or through the oversight in chat');
  process.exit(0);
});
