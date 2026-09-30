import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The repository's database guard (.claude/hooks/sql-guard.mjs — V402, the owner's rule of 29 Sep): on the v2 project it
// refuses only destructive statements; on the old app's project it refuses everything; elsewhere, as before. Nothing
// asks: the owner's rule of 30 Sep — a refusal names its reason, and what needs his word goes to the oversight in chat.
// Sabotage: tests/sabotage/guard-lets-a-drop-through.mjs turns this red.
const GUARD = path.resolve(__dirname, '../../../../.claude/hooks/sql-guard.mjs');
const V2 = 'kimadjvaxgiqzjaukuqg';
const OLD = 'vkxoeeoauexyfpzqufqd';

function decide(tool: string, projectId: string, query: string): 'deny' | 'allow' {
  const input = JSON.stringify({ tool_name: tool, tool_input: { project_id: projectId, query } });
  const out = execFileSync('node', [GUARD], { input }).toString();
  expect(out, 'the guard never asks').not.toContain('"permissionDecision":"ask"');
  return out.includes('"permissionDecision":"deny"') ? 'deny' : 'allow';
}
const migrate = (q: string) => decide('mcp__Supabase__apply_migration', V2, q);
const run = (q: string) => decide('mcp__Supabase__execute_sql', V2, q);

describe('the database guard refuses only destructive statements on the v2 project', () => {
  it('lets ordinary migrations and writes through', () => {
    expect(migrate('create table core.x (id uuid primary key); alter table core.x enable row level security;')).toBe(
      'allow',
    );
    expect(
      migrate(
        'create function core.f() returns void language plpgsql as $$ begin update core.x set a = 1 where id = $1; end $$;',
      ),
    ).toBe('allow');
    expect(
      migrate("insert into core.page (key) values ('k') on conflict (key) do update set route = excluded.route;"),
    ).toBe('allow');
    expect(
      run("update supabase_migrations.schema_migrations set version = '1' where name = 'n' returning version"),
    ).toBe('allow');
    expect(run("select 'drop table core.x; truncate core.y' as words")).toBe('allow');
    expect(run('select 1 -- drop table core.x')).toBe('allow');
  });
  it('a DROP is refused', () => {
    expect(migrate('drop table core.x;')).toBe('deny');
    expect(migrate('alter table core.x drop column y;')).toBe('deny');
    expect(migrate('drop function core.f();')).toBe('deny');
    expect(run("select '--'; drop table core.x;")).toBe('deny');
  });
  it('so do TRUNCATE, DELETE or UPDATE without WHERE, and switching protection off', () => {
    expect(run('truncate core.x')).toBe('deny');
    expect(run('delete from core.x')).toBe('deny');
    expect(run('update core.x set a = 1')).toBe('deny');
    expect(run('do $$ begin delete from core.x; end $$')).toBe('deny');
    expect(migrate('alter table core.x disable row level security;')).toBe('deny');
    expect(migrate('alter table core.x disable trigger capture;')).toBe('deny');
    expect(run('delete from core.x where id = 1')).toBe('allow');
  });
  it('refuses anything on the old project, and keeps the old rules elsewhere', () => {
    expect(decide('mcp__Supabase__execute_sql', OLD, 'select 1')).toBe('deny');
    expect(decide('mcp__Supabase__apply_migration', OLD, 'create table x (id int)')).toBe('deny');
    expect(decide('mcp__Supabase__execute_sql', 'someotherproject', 'select 1')).toBe('allow');
    expect(decide('mcp__Supabase__execute_sql', 'someotherproject', 'insert into x values (1)')).toBe('deny');
  });
});
