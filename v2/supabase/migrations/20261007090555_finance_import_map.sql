-- The import's column mapping as a setting (V622 (2)): which export column becomes which field of the import door, kept
-- in Settings → Finance by admins (V97), so a renamed export column needs no code. Headers are compared after removing
-- a BOM, spaces and `_ - . : ( ) /` and ignoring case (§3.11 step 1). Several headers may feed one field (Qty, Quantity,
-- Item Quantity); one header feeds one field. A required header must be in the file for it to be read as that export.
-- Seeded with the maps ported from the old app (§3.11; REBUILD-HANDOVER-2 §1): the all-invoices export and the
-- Transaction Expense Export. These are Payments' column names, not data.

-- The fields each export's rows carry into api.finance_import: an invoice's own, its lines' (line.*), an expense line's.
create function finance.import_fields(p_source text) returns text[]
language sql immutable set search_path = ''
as $$
  select case p_source
    when 'invoices' then array['type', 'ref', 'dpin', 'dpin_total', 'customer_name', 'customer_email', 'customer_phone',
                               'client_id', 'tax_no', 'discount_code', 'created_on', 'generated_on', 'paid_on', 'due_on',
                               'status', 'status_at', 'consolidation_status', 'consolidated_ref', 'is_consolidated',
                               'total_sar', 'branch', 'salesman', 'product',
                               'line.line_no', 'line.product', 'line.name', 'line.qty', 'line.unit_price', 'line.discount_sar',
                               'line.total_sar', 'line.taxable']
    when 'expenses' then array['ref', 'expense_type', 'status', 'transaction_expense_status', 'amount_sar', 'created_at',
                               'submitted_at', 'decided_at', 'merchant', 'id_reference', 'submitter', 'approver']
  end
$$;

-- A header as it is compared: no BOM, spaces or `_ - . : ( ) /`, lower case.
create function finance.header_key(p_header text) returns text
language sql immutable set search_path = ''
as $$
  select pg_catalog.lower(pg_catalog.regexp_replace(coalesce(p_header, ''), '[\s_.:()/\uFEFF-]', '', 'g'))
$$;

create table finance.import_map (
  id uuid primary key default gen_random_uuid(),
  key text not null unique default ('map_' || pg_catalog.replace(gen_random_uuid()::text, '-', ''))
    check (key ~ '^[a-z][a-z0-9_]*$'),
  source text not null check (source in ('invoices', 'expenses')),
  header text not null check (pg_catalog.btrim(header) <> '' and pg_catalog.length(header) <= 120),
  header_key text generated always as (finance.header_key(header)) stored,
  name_en text not null check (pg_catalog.btrim(name_en) <> '' and pg_catalog.length(name_en) <= 120),
  name_ar text not null check (pg_catalog.btrim(name_ar) <> '' and pg_catalog.length(name_ar) <= 120),
  field text not null,
  required boolean not null default false,
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint import_map_field_known check (field = any (finance.import_fields(source))),
  constraint import_map_header_readable check (finance.header_key(header) <> '')
);
create unique index import_map_one_header on finance.import_map (source, header_key) where deleted_at is null;
comment on table finance.import_map is 'V622 (2): an export column → a field of the import door, per export (invoices, expenses). Admins keep it in Settings → Finance; headers compare without spaces, _ - . : ( ) / and case.';
alter table finance.import_map enable row level security;
select audit.track('finance.import_map'::regclass);
select core.index_foreign_keys('finance');

-- Recognise a file from its header row (§3.11 step 1): each header with the field it feeds (null when the map does
-- not know it), the required headers missing, and whether the file can be read as this export.
create function finance.import_recognise(p_source text, p_headers text[]) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_source is null or finance.import_fields(p_source) is null then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'source';
  end if;
  return (
    with h as (
      select x.header, x.n, finance.header_key(x.header) as hk
      from pg_catalog.unnest(coalesce(p_headers, '{}'::text[])) with ordinality x(header, n)),
    m as (
      select * from finance.import_map
      where source = p_source and active and deleted_at is null)
    select pg_catalog.jsonb_build_object(
      'source', p_source,
      'columns', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('header', h.header, 'field', m.field)
                                                       order by h.n)
                           from h left join m on m.header_key = h.hk), '[]'::jsonb),
      'missing', coalesce((select pg_catalog.jsonb_agg(m.header order by m.sort, m.header)
                           from m where m.required and not exists (select 1 from h where h.hk = m.header_key)), '[]'::jsonb),
      'recognised', not exists (select 1 from m where m.required and not exists (select 1 from h where h.hk = m.header_key))
                    and exists (select 1 from m where m.required)));
end
$$;

-- The map itself, for the import screen and Settings.
create function finance.import_map_list(p_source text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', m.id, 'key', m.key, 'source', m.source, 'header', m.header, 'header_key', m.header_key, 'field', m.field,
      'required', m.required, 'sort', m.sort, 'active', m.active, 'version', m.version)
      order by m.source, m.sort, m.header)
    from finance.import_map m
    where m.deleted_at is null and (p_source is null or m.source = p_source)), '[]'::jsonb);
end
$$;

create function api.finance_import_recognise(p_source text, p_headers text[]) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.import_recognise(p_source, p_headers) $$;
create function api.finance_import_map(p_source text default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.import_map_list(p_source) $$;

revoke all on function finance.import_recognise(text, text[]) from public;
revoke all on function finance.import_map_list(text) from public;
grant execute on function finance.import_recognise(text, text[]) to authenticated;
grant execute on function finance.import_map_list(text) to authenticated;
grant execute on function api.finance_import_recognise(text, text[]) to authenticated;
grant execute on function api.finance_import_map(text) to authenticated;

-- The list door as 20260929091000 wrote it, but a taken value on a list whose key the row was not given (the import
-- map's default key) answers list.key_taken instead of failing on an empty detail.
create or replace function core.list_save(p_list text, p_id uuid, p_values jsonb, p_version int default null,
                                          p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  t regclass := pg_catalog.to_regclass(e.table_name);
  cols text[];
  k text;
  cur jsonb;
  rid uuid;
  req uuid;
  what text;
  bad text;
begin
  select pg_catalog.array_agg(a.attname::text) into cols from pg_catalog.pg_attribute a
  where a.attrelid = t and a.attnum > 0 and not a.attisdropped
    and a.attname::text not in ('id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'version', 'deleted_at',
                                'deleted_by', 'delete_reason', 'meaning');
  if p_values is null or pg_catalog.jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = 'P0001', message = 'list.nothing_to_change';
  end if;
  if p_values ? 'meaning' then
    raise exception using errcode = 'P0001', message = 'list.meaning_locked';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_values) loop
    if not (k = any (cols)) then
      raise exception using errcode = 'P0001', message = 'list.unknown_field', detail = k;
    end if;
  end loop;
  bad := (select core.banned_word(x.value) from pg_catalog.jsonb_each_text(p_values) x
          where core.banned_word(x.value) is not null limit 1);
  if bad is not null then
    raise exception using errcode = 'P0001', message = 'list.banned_word', detail = bad;
  end if;
  begin
    if p_id is null then
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      execute pg_catalog.format('insert into %s (%s) select %s from pg_catalog.jsonb_populate_record(null::%s, $1) x returning id',
        t, (select pg_catalog.string_agg(pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        (select pg_catalog.string_agg('x.' || pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        t)
        into rid using p_values;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1 and t.deleted_at is null', t)
        into cur using p_id;
      if cur is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      if p_values ? 'key' and (p_values -> 'key') is distinct from (cur -> 'key') then
        raise exception using errcode = 'P0001', message = 'list.key_fixed';
      end if;
      perform core.check_version(e.table_name, p_id, p_version,
        (select pg_catalog.array_agg(c) from pg_catalog.jsonb_object_keys(p_values) c where (cur -> c) is distinct from (p_values -> c)));
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      perform audit.write_fields(e.table_name, p_id, p_values);
      rid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'list.key_taken', detail = coalesce(p_values ->> 'key', '');
    when not_null_violation or check_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'list.invalid', detail = coalesce(nullif(what, ''), sqlerrm);
  end;
  perform audit.end();
  execute pg_catalog.format('select pg_catalog.jsonb_build_object(''id'', t.id, ''version'', t.version) from %s t where t.id = $1', t)
    into cur using rid;
  return cur || pg_catalog.jsonb_build_object('request_id', req);
end
$$;

-- ================================================================ the ported maps
select audit.begin('system', 'finance.import_map_seeded');
insert into finance.import_map (key, source, header, name_en, name_ar, field, required, sort, created_by)
select x.key, x.source, x.header, x.header, x.header, x.field, x.required, x.sort, core.system_person_id()
from (values
  ('inv_type', 'invoices', 'Type', 'type', true, 10),
  ('inv_ref', 'invoices', 'Invoice Reference #', 'ref', true, 20),
  ('inv_dpin', 'invoices', 'Invoice Number', 'dpin', false, 30),
  ('inv_customer_name', 'invoices', 'Customer Name', 'customer_name', true, 40),
  ('inv_customer_email', 'invoices', 'Customer Email', 'customer_email', false, 50),
  ('inv_email', 'invoices', 'Email', 'customer_email', false, 51),
  ('inv_created_on', 'invoices', 'Invoice Create Date', 'created_on', false, 60),
  ('inv_generated_on', 'invoices', 'Invoice Generate Date', 'generated_on', false, 70),
  ('inv_paid_on', 'invoices', 'Last Payment Date', 'paid_on', false, 80),
  ('inv_status', 'invoices', 'Invoice Status', 'status', false, 90),
  ('inv_status_at', 'invoices', 'Last Status At', 'status_at', false, 100),
  ('inv_total', 'invoices', 'Invoice Total', 'total_sar', false, 110),
  ('inv_branch', 'invoices', 'Sale Branch', 'branch', false, 120),
  ('inv_salesman', 'invoices', 'Salesman', 'salesman', false, 130),
  ('inv_line_product', 'invoices', 'Product', 'line.product', false, 200),
  ('inv_line_name', 'invoices', 'Name', 'line.name', false, 210),
  ('inv_line_qty', 'invoices', 'Qty', 'line.qty', false, 220),
  ('inv_line_quantity', 'invoices', 'Quantity', 'line.qty', false, 221),
  ('inv_line_item_quantity', 'invoices', 'Item Quantity', 'line.qty', false, 222),
  ('inv_line_unit_price', 'invoices', 'Unit Price', 'line.unit_price', false, 230),
  ('inv_line_item_unit_price', 'invoices', 'Item Unit Price', 'line.unit_price', false, 231),
  ('inv_line_item_price', 'invoices', 'Item Price', 'line.unit_price', false, 232),
  ('inv_line_discount', 'invoices', 'Item Discount', 'line.discount_sar', false, 240),
  ('inv_line_total', 'invoices', 'Item Total', 'line.total_sar', false, 250),
  ('inv_line_taxable', 'invoices', 'Item Is Taxable', 'line.taxable', true, 260),
  ('exp_ref', 'expenses', 'Invoice#', 'ref', true, 10),
  ('exp_amount', 'expenses', 'Amount (SAR)', 'amount_sar', true, 20),
  ('exp_type', 'expenses', 'Expense Type', 'expense_type', true, 30),
  ('exp_status', 'expenses', 'Status', 'status', true, 40),
  ('exp_created_at', 'expenses', 'Created At', 'created_at', false, 50),
  ('exp_submitted_at', 'expenses', 'Submission Date', 'submitted_at', false, 60),
  ('exp_decided_at', 'expenses', 'Approval/Rejection Date', 'decided_at', false, 70),
  ('exp_merchant', 'expenses', 'Merchant', 'merchant', false, 80),
  ('exp_id_reference', 'expenses', 'ID Reference', 'id_reference', false, 90),
  ('exp_submitter', 'expenses', 'Submitter', 'submitter', false, 100),
  ('exp_approver', 'expenses', 'Approver/Rejector', 'approver', false, 110)
) x(key, source, header, field, required, sort);
select audit.end();
