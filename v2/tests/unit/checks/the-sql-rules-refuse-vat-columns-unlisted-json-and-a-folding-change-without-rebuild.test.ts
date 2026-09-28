import { describe, expect, it } from 'vitest';
import noBlobTables from '../../../scripts/checks/no-blob-tables.mjs';
import noVatColumns from '../../../scripts/checks/no-vat-columns.mjs';
import normRebuildCalled from '../../../scripts/checks/norm-rebuild-called.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "no-vat-columns", "no-blob-tables", "norm-rebuild-called" each turn this red.
describe('the SQL rules refuse VAT columns, unlisted JSON and a folding change without rebuild', () => {
  it('refuses a column or alias named for a VAT or tax amount, and allows tax numbers and the kind string', async () => {
    const root = fixture({
      'supabase/migrations/20261001000000_finance_bad.sql': [
        'create table finance.x (',
        '  id uuid primary key,',
        '  vat_amount numeric(14,2),',
        '  "VAT" numeric,',
        '  tax_amount numeric',
        ');',
        'alter table finance.x add column total_tax numeric;',
        'create view finance.v as select 1 as sar_vat;',
        '',
      ].join('\n'),
      'supabase/migrations/20261002000000_finance_good.sql': [
        "create table finance.y (id uuid, tax_no_raw text, tax_key text, kind text check (kind in ('vat','cr')));",
        'create table finance.tax_invoice (id uuid, total_sar numeric(14,2)); -- vat_amount in a comment is fine',
        'create function finance.private_activate() returns void language sql as $$ select 1 $$;',
        '',
      ].join('\n'),
    });
    const got = await findings(noVatColumns, root);
    expect(got.map((f) => `${f.file.slice(-12)}:${f.line}`)).toEqual([
      'ance_bad.sql:3',
      'ance_bad.sql:4',
      'ance_bad.sql:5',
      'ance_bad.sql:7',
      'ance_bad.sql:8',
    ]);
  });

  it('refuses a json/jsonb column that is not listed with a reason', async () => {
    const root = fixture({
      'scripts/checks/jsonb-columns.txt':
        'audit.change.before — the changed fields before the change\naudit.change.after — too short\n',
      'supabase/migrations/20261001000000_audit_log.sql': [
        'create table if not exists audit.change (',
        '  id bigserial primary key,',
        '  before jsonb,',
        '  after jsonb,',
        '  fields text[]',
        ');',
        'alter table audit.change add column extra json;',
        "create table core.state (id int, data jsonb not null default '{}');",
        '',
      ].join('\n'),
    });
    const got = await findings(noBlobTables, root);
    expect(got.map((f) => f.message.split(' ')[0])).toEqual([
      'audit.change.after',
      'core.state.data',
      'audit.change.extra',
    ]);
  });

  it('refuses a norm.* change without norm.rebuild() after it, and allows one with it', async () => {
    const root = fixture({
      'supabase/migrations/20261001000000_norm_fold.sql':
        'create or replace function norm.fold(t text) returns text language sql immutable as $$ select lower(t) $$;\n',
      'supabase/migrations/20261002000000_norm_fold_v2.sql': [
        'perform norm.rebuild();',
        'create or replace function norm.name_key(t text) returns text language sql immutable as $$ select t $$;',
        '',
      ].join('\n'),
      'supabase/migrations/20261003000000_norm_fold_v3.sql': [
        'create or replace function norm.fold(t text) returns text language sql immutable as $$ select upper(t) $$;',
        'select norm.rebuild();',
        '',
      ].join('\n'),
    });
    const got = await findings(normRebuildCalled, root);
    expect(got.map((f) => f.file.split('/').pop())).toEqual([
      '20261001000000_norm_fold.sql',
      '20261002000000_norm_fold_v2.sql',
    ]);
  });
});
