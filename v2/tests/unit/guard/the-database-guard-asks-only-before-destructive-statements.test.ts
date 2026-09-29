import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The repository's database guard (.claude/hooks/sql-guard.mjs — V402, the owner's rule of 29 Sep): on the v2 project it
// asks only before destructive statements; on the old app's project it asks before everything; elsewhere, as before.
// Sabotage: tests/sabotage/guard-lets-a-drop-through.mjs turns this red.
const GUARD = path.resolve(__dirname, '../../../../.claude/hooks/sql-guard.mjs');
const V2 = 'kimadjvaxgiqzjaukuqg';
const OLD = 'vkxoeeoauexyfpzqufqd';

function decide(tool: string, projectId: string, query: string): 'ask' | 'allow' {
  const input = JSON.stringify({ tool_name: tool, tool_input: { project_id: projectId, query } });
  const out = execFileSync('node', [GUARD], { input }).toString();
  return out.includes('"permissionDecision":"ask"') ? 'ask' : 'allow';
}
const migrate = (q: string) => decide('mcp__Supabase__apply_migration', V2, q);
const run = (q: string) => decide('mcp__Supabase__execute_sql', V2, q);

describe('the database guard asks only before destructive statements on the v2 project', () => {
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
  it('a DROP still asks', () => {
    expect(migrate('drop table core.x;')).toBe('ask');
    expect(migrate('alter table core.x drop column y;')).toBe('ask');
    expect(migrate('drop function core.f();')).toBe('ask');
    expect(run("select '--'; drop table core.x;")).toBe('ask');
  });
  it('so do TRUNCATE, DELETE or UPDATE without WHERE, and switching protection off', () => {
    expect(run('truncate core.x')).toBe('ask');
    expect(run('delete from core.x')).toBe('ask');
    expect(run('update core.x set a = 1')).toBe('ask');
    expect(run('do $$ begin delete from core.x; end $$')).toBe('ask');
    expect(migrate('alter table core.x disable row level security;')).toBe('ask');
    expect(migrate('alter table core.x disable trigger capture;')).toBe('ask');
    expect(run('delete from core.x where id = 1')).toBe('allow');
  });
  it('asks before anything on the old project, and keeps the old rules elsewhere', () => {
    expect(decide('mcp__Supabase__execute_sql', OLD, 'select 1')).toBe('ask');
    expect(decide('mcp__Supabase__apply_migration', OLD, 'create table x (id int)')).toBe('ask');
    expect(decide('mcp__Supabase__execute_sql', 'someotherproject', 'select 1')).toBe('allow');
    expect(decide('mcp__Supabase__execute_sql', 'someotherproject', 'insert into x values (1)')).toBe('ask');
  });
});
