-- v2 finance, part 5 (V622, the Finance screens brief I.2): the differences list. Where a Payments file differs from a
-- field a person set in the app, the import leaves the person's value (finance.merge_fields) and records the difference
-- here, one row per field: the screens list them per invoice with both values and count them for the chip "Differs from
-- import". Keep mine leaves the person's value and settles the difference; Use import writes the file's value and gives
-- the field back to the imports. Each is one request with one Undo, by a person with Full on Finance. Forward-only (V103).

create table finance.import_difference (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references finance.invoice (id),
  row_table text not null check (row_table in ('invoice', 'invoice_line', 'expense_line')),
  row_id uuid not null,
  field text not null check (field ~ '^[a-z_]+$'),
  import_value jsonb not null check (pg_catalog.jsonb_typeof(import_value) = 'object'),  -- column → the file's value
  import_time timestamptz not null,
  batch_id uuid not null references finance.import_batch (id),
  state text not null default 'open' check (state in ('open', 'kept_mine', 'used_import')),
  decided_at timestamptz, decided_by uuid references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check ((state = 'open') = (decided_at is null))
);
create unique index import_difference_open on finance.import_difference (row_table, row_id, field)
  where state = 'open' and deleted_at is null;
comment on table finance.import_difference is 'V622: a field where a Payments file differs from the value a person set; Keep mine or Use import settles it.';

alter table finance.import_difference enable row level security;
select audit.track('finance.import_difference'::regclass);
select core.index_foreign_keys('finance');

create function finance.import_difference_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select finance.invoice_owner_of('finance.import_difference', p_id) $$;

-- ================================================================ one field as a person sees it
-- The door's field a column belongs to: a word and the list entry it maps to are one field (status, product), a
-- service is the line's service, a *_raw column is its door key; anything else is itself.
create function finance.field_of(p_column text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when p_column in ('status_raw', 'status_id') then 'status'
    when p_column in ('product_raw', 'product_id') then 'product'
    when p_column = 'service_id' then 'service'
    when p_column like '%\_raw' then pg_catalog.left(p_column, -4)
    else p_column
  end
$$;

-- What a person reads for a field's columns: the word as typed where there is one, else the value itself.
create function finance.field_text(p_values jsonb) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce((select e.value #>> '{}' from pg_catalog.jsonb_each(p_values) e where e.key like '%\_raw'),
                  (select e.value #>> '{}' from pg_catalog.jsonb_each(p_values) e order by e.key limit 1))
$$;

-- ================================================================ the import records them
-- Called by finance.import_invoice and finance.import_expense with the fields merge_fields kept for the person: one
-- open difference per field, refreshed by a newer file; a value the person already kept theirs against is not listed
-- again. Returns how many differences were opened.
create function finance.note_differences(p_table text, p_row uuid, p_invoice uuid, p_kept jsonb, p_time timestamptz,
                                         p_batch uuid, p_imp uuid) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  f text;
  v jsonb;
  d finance.import_difference;
  n int := 0;
begin
  for f, v in
    select finance.field_of(e.key), pg_catalog.jsonb_object_agg(e.key, e.value)
    from pg_catalog.jsonb_each(coalesce(p_kept, '{}'::jsonb)) e
    group by 1
  loop
    select * into d from finance.import_difference x
    where x.row_table = p_table and x.row_id = p_row and x.field = f and x.deleted_at is null
    order by (x.state = 'open') desc, x.import_time desc
    limit 1;
    if d.id is not null and d.state = 'open' then
      if p_time > d.import_time and d.import_value is distinct from v then
        update finance.import_difference x
        set import_value = v, import_time = p_time, batch_id = p_batch,
            updated_at = pg_catalog.now(), updated_by = p_imp, version = x.version + 1
        where x.id = d.id;
      end if;
    elsif d.id is not null and d.state = 'kept_mine' and d.import_value = v then
      continue;
    else
      insert into finance.import_difference (invoice_id, row_table, row_id, field, import_value, import_time, batch_id,
                                             created_by)
      values (p_invoice, p_table, p_row, f, v, p_time, p_batch, p_imp);
      n := n + 1;
    end if;
  end loop;
  return n;
end
$$;

-- ================================================================ the list (I.2)
-- The open differences, one invoice's or every invoice's: both values as a person reads them, and the version a
-- decision is made with. A difference whose row is removed, or whose value the person has since set to the file's,
-- is not listed. Needs View on Finance.
create function finance.differences(p_invoice uuid) returns table (
  id uuid, invoice_id uuid, invoice_ref text, row_table text, row_id uuid, line_no int, field text,
  mine text, from_import text, import_time timestamptz, version int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return query
  with cur as (
    select d.*, r.row_json, r.line_no as row_line
    from finance.import_difference d
    cross join lateral (
      select pg_catalog.to_jsonb(i) as row_json, null::int as line_no from finance.invoice i
      where d.row_table = 'invoice' and i.id = d.row_id and i.deleted_at is null
      union all
      select pg_catalog.to_jsonb(l), l.line_no from finance.invoice_line l
      where d.row_table = 'invoice_line' and l.id = d.row_id and l.deleted_at is null
      union all
      select pg_catalog.to_jsonb(e), null from finance.expense_line e
      where d.row_table = 'expense_line' and e.id = d.row_id and e.deleted_at is null
    ) r
    where d.state = 'open' and d.deleted_at is null and (p_invoice is null or d.invoice_id = p_invoice)
  ), mine as (
    select c.*, (select pg_catalog.jsonb_object_agg(k, c.row_json -> k) from pg_catalog.jsonb_object_keys(c.import_value) k)
                as mine_json
    from cur c
  )
  select m.id, m.invoice_id, i.ref, m.row_table, m.row_id, m.row_line, m.field,
         finance.field_text(m.mine_json), finance.field_text(m.import_value), m.import_time, m.version
  from mine m
  join finance.invoice i on i.id = m.invoice_id
  where m.mine_json is distinct from m.import_value
  order by i.ref, m.row_table, m.row_line nulls first, m.field;
end
$$;

-- How many open differences each invoice has (the chip "Differs from import").
create function finance.difference_counts() returns table (invoice_id uuid, differences int)
language sql stable security definer set search_path = ''
as $$
  select d.invoice_id, pg_catalog.count(*)::int from finance.differences(null) d group by d.invoice_id
$$;

-- ================================================================ Keep mine / Use import
-- One open difference settled with the version the person read (A14), one request with one Undo. Use import writes the
-- file's value into the row and gives those columns back to the imports (their src becomes the file's time); Keep mine
-- leaves the row as the person set it. A Final invoice's change needs a reason (the invoice guard, V611).
create function finance.difference_decide(p_id uuid, p_choice text, p_version int, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  d finance.import_difference;
  cols text;
  times jsonb;
  req uuid;
begin
  if p_choice not in ('keep_mine', 'use_import') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'choice';
  end if;
  select * into d from finance.import_difference x where x.id = p_id and x.deleted_at is null for update;
  if d.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if d.state <> 'open' then
    raise exception using errcode = 'P0001', message = 'finance.difference_decided', detail = d.state;
  end if;
  perform core.check_version('finance.import_difference', p_id, p_version, array['state']);
  req := audit.begin('ui', 'finance.difference_decided',
                     pg_catalog.jsonb_build_object('choice', p_choice, 'field', d.field, 'table', d.row_table), p_reason);
  if p_choice = 'use_import' then
    select pg_catalog.string_agg(pg_catalog.quote_ident(k), ', ' order by k),
           pg_catalog.jsonb_object_agg(k, d.import_time)
    into cols, times
    from pg_catalog.jsonb_object_keys(d.import_value) k;
    execute pg_catalog.format(
      'update %1$s x set (%2$s) = (select %2$s from pg_catalog.jsonb_populate_record(x, $1)), '
      'src = coalesce(x.src, ''{}''::jsonb) || $2, updated_at = pg_catalog.now(), updated_by = $3, version = x.version + 1 '
      'where x.id = $4 and x.deleted_at is null', pg_catalog.to_regclass('finance.' || d.row_table), cols)
      using d.import_value, times, me, d.row_id;
  end if;
  update finance.import_difference x
  set state = case p_choice when 'keep_mine' then 'kept_mine' else 'used_import' end,
      decided_at = pg_catalog.now(), decided_by = me,
      updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- ================================================================ the doors the Data API reaches (V124)
create function api.finance_differences(p_invoice uuid default null) returns table (
  id uuid, invoice_id uuid, invoice_ref text, row_table text, row_id uuid, line_no int, field text,
  mine text, from_import text, import_time timestamptz, version int)
language sql stable security invoker set search_path = ''
as $$ select * from finance.differences(p_invoice) $$;
create function api.finance_difference_counts() returns table (invoice_id uuid, differences int)
language sql stable security invoker set search_path = ''
as $$ select * from finance.difference_counts() $$;
create function api.finance_difference_decide(p_id uuid, p_choice text, p_version int, p_reason text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select finance.difference_decide(p_id, p_choice, p_version, p_reason) $$;

revoke all on function finance.note_differences(text, uuid, uuid, jsonb, timestamptz, uuid, uuid) from public;
revoke all on function finance.differences(uuid) from public;
revoke all on function finance.difference_counts() from public;
revoke all on function finance.difference_decide(uuid, text, int, text) from public;
grant execute on function finance.differences(uuid) to authenticated;
grant execute on function finance.difference_counts() to authenticated;
grant execute on function finance.difference_decide(uuid, text, int, text) to authenticated;
grant execute on function api.finance_differences(uuid) to authenticated;
grant execute on function api.finance_difference_counts() to authenticated;
grant execute on function api.finance_difference_decide(uuid, text, int, text) to authenticated;
