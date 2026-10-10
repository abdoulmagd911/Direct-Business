-- Receipts by hand (V622 (3), D21): a receipt is edited, added and removed through the row door like every other
-- imported row. An edited field is the person's — a later receipts file keeps it and lists the difference for Keep
-- mine / Use import; a receipt typed by hand has a key of its own, so no file ever reads it as one of its rows, and
-- source manual; a removed receipt is archived with its reason and never brought back (finance.import_receipt).
-- Forward-only.

alter table finance.import_difference drop constraint import_difference_row_table_check;
alter table finance.import_difference add constraint import_difference_row_table_check
  check (row_table in ('invoice', 'invoice_line', 'expense_line', 'receipt'));

create or replace function finance.row_values(p_table text, p_fields jsonb, p_adding boolean) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  k text;
  v jsonb;
  out jsonb := '{}'::jsonb;
  st finance.status_map;
  given text;
  allowed text[] := case p_table
    when 'invoice' then array['customer_name', 'customer_name2', 'customer_email', 'customer_phone', 'client_id', 'tax_no',
                              'discount_code', 'status', 'created_on', 'generated_on', 'paid_on', 'due_on', 'total_sar',
                              'product', 'branch', 'salesman']
                        || case when p_adding then array['ref', 'kind'] else '{}'::text[] end
    when 'invoice_line' then array['name', 'qty', 'unit_price', 'discount_sar', 'taxable', 'total_sar', 'product', 'service']
                             || case when p_adding then array['invoice_id', 'line_no'] else '{}'::text[] end
    when 'expense_line' then array['expense_type', 'status', 'amount_sar', 'merchant', 'id_reference']
                             || case when p_adding then array['invoice_id'] else '{}'::text[] end
    when 'receipt' then array['method', 'amount_sar', 'paid_on', 'ref_at_method', 'paid_by', 'note']
                        || case when p_adding then array['invoice_id'] else '{}'::text[] end
  end;
begin
  if allowed is null then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'table';
  end if;
  if pg_catalog.jsonb_typeof(p_fields) is distinct from 'object' or p_fields = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'fields';
  end if;
  for k, v in select e.key, e.value from pg_catalog.jsonb_each(p_fields) e loop
    if not (k = any (allowed)) then
      raise exception using errcode = 'P0001', message = 'common.invalid', detail = k;
    end if;
    given := nullif(pg_catalog.btrim(v #>> '{}'), '');
    case
      when k = 'status' and p_table = 'invoice' then
        st := finance.status_of(given);
        if st.id is null then
          raise exception using errcode = 'P0001', message = 'finance.status_unknown', detail = coalesce(given, '');
        end if;
        out := out || pg_catalog.jsonb_build_object('status_raw', given, 'status_id', st.id);
      when k = 'status' then
        if finance.expense_status_of(given) is null then
          raise exception using errcode = 'P0001', message = 'finance.expense_status_unknown', detail = coalesce(given, '');
        end if;
        out := out || pg_catalog.jsonb_build_object('status_raw', given, 'status', finance.expense_status_of(given));
      when k = 'product' then
        if given is not null and finance.product_of(given) is null then
          raise exception using errcode = 'P0001', message = 'finance.product_unknown', detail = given;
        end if;
        out := out || pg_catalog.jsonb_build_object('product_raw', given, 'product_id', finance.product_of(given));
        if p_table = 'invoice_line' and not (p_fields ? 'service') then
          out := out || pg_catalog.jsonb_build_object('service_id',
                   (select p.service_id from finance.product p where p.id = finance.product_of(given)));
        end if;
      when k = 'service' then
        out := out || pg_catalog.jsonb_build_object('service_id', finance.entry_id('finance.service', given));
      when k in ('client_id', 'tax_no', 'discount_code', 'salesman') then
        out := out || pg_catalog.jsonb_build_object(k || '_raw', v);
      else
        out := out || pg_catalog.jsonb_build_object(k, v);
    end case;
  end loop;
  return out;
end
$$;

create or replace function finance.row_add(p_table text, p_fields jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  t text := 'finance.' || p_table;
  vals jsonb := finance.row_values(p_table, p_fields, true);
  cols text;
  rid uuid;
  req uuid;
begin
  if p_table in ('invoice_line', 'expense_line', 'receipt')
     and not exists (select 1 from finance.invoice i where i.id = (vals ->> 'invoice_id')::uuid and i.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'invoice_id';
  end if;
  if p_table = 'invoice_line' and not (vals ? 'line_no') then
    vals := vals || pg_catalog.jsonb_build_object('line_no',
              (select coalesce(max(l.line_no), 0) + 1 from finance.invoice_line l where l.invoice_id = (vals ->> 'invoice_id')::uuid));
  end if;
  if p_table = 'receipt' then
    -- a receipt typed by hand has a key of its own, so no file ever finds it as one of its rows
    vals := vals || pg_catalog.jsonb_build_object('receipt_key', 'person|' || gen_random_uuid()::text);
  end if;
  vals := vals || pg_catalog.jsonb_build_object('created_by', me, 'src', pg_catalog.jsonb_build_object('_row', 'person'))
               || case when p_table in ('invoice', 'expense_line', 'receipt') then '{"source": "manual"}'::jsonb
                       else '{}'::jsonb end;
  select pg_catalog.string_agg(pg_catalog.quote_ident(k), ', ' order by k) into cols from pg_catalog.jsonb_object_keys(vals) k;
  req := audit.begin('ui', 'finance.row_added', pg_catalog.jsonb_build_object('table', p_table), p_reason);
  execute pg_catalog.format('insert into %1$s (%2$s) select %2$s from pg_catalog.jsonb_populate_record(null::%1$s, $1) returning id',
                            pg_catalog.to_regclass(t), cols)
    into rid using vals;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'request_id', req);
end
$$;

create or replace function finance.rows_remove(p_table text, p_ids uuid[], p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  n int;
  req uuid;
begin
  if p_table not in ('invoice', 'invoice_line', 'expense_line', 'receipt') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'table';
  end if;
  if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  req := audit.begin('ui', 'finance.rows_removed', pg_catalog.jsonb_build_object('table', p_table,
                                                                              'count', pg_catalog.cardinality(p_ids)), p_reason);
  execute pg_catalog.format('update %s x set deleted_at = pg_catalog.now(), deleted_by = $1, delete_reason = $2 '
                            'where x.id = any ($3) and x.deleted_at is null', pg_catalog.to_regclass('finance.' || p_table))
    using me, p_reason, p_ids;
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('removed', n, 'request_id', req);
end
$$;

create or replace function finance.import_receipt(p_batch uuid, p_no int, p_row jsonb, p_time timestamptz, p_imp uuid) returns text
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  ref text := finance.row_text(p_row, 'ref');
  inv finance.invoice;
  amount numeric;
  paid date;
  key text;
  cur finance.receipt;
  vals jsonb;
  m record;
  result text;
begin
  if ref is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, null, 'no_ref', p_row);
    return 'held';
  end if;
  select * into inv from finance.invoice i where i.ref = ref and i.deleted_at is null;
  if inv.id is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'no_invoice', p_row);
    return 'held';
  end if;
  if inv.source = 'manual' then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'manual_row', 'typed by a person; the import never changes it', p_row);
    return 'held';
  end if;
  begin
    amount := finance.row_text(p_row, 'amount_sar')::numeric(14, 2);
    paid := finance.row_date(p_row, 'paid_on');
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount_or_date', sqlerrm, p_row);
    return 'held';
  end;
  if amount is null or amount = 0 or paid is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount_or_date', 'a receipt needs its amount and day', p_row);
    return 'held';
  end if;
  if paid > core.riyadh_today() then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'date_in_future', paid::text, p_row);
    return 'held';
  end if;
  key := pg_catalog.concat_ws('|', ref,
           coalesce(norm.fold(finance.row_text(p_row, 'ref_at_method')),
                    pg_catalog.concat_ws('|', norm.fold(coalesce(finance.row_text(p_row, 'method'), '—')), paid, amount)));
  vals := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'method', finance.row_text(p_row, 'method'), 'amount_sar', amount, 'paid_on', paid,
    'ref_at_method', finance.row_text(p_row, 'ref_at_method'), 'paid_by', finance.row_text(p_row, 'paid_by'),
    'note', finance.row_text(p_row, 'note')));
  select * into cur from finance.receipt x where x.receipt_key = key and x.deleted_at is null;
  if cur.id is null and exists (select 1 from finance.receipt x where x.receipt_key = key and x.deleted_at is not null
                                and x.deleted_by <> p_imp) then
    -- a receipt a person removed is never brought back (V622, OA12)
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'removed_row', p_row);
    return 'held';
  end if;
  if cur.id is null then
    insert into finance.receipt (invoice_id, receipt_key, method, amount_sar, paid_on, ref_at_method, paid_by, note, source,
                                 src, created_by)
    select inv.id, key, x.method, x.amount_sar, x.paid_on, x.ref_at_method, x.paid_by, x.note, 'import',
           (select pg_catalog.jsonb_object_agg(k, p_time) from pg_catalog.jsonb_object_keys(vals) k), p_imp
    from pg_catalog.jsonb_populate_record(null::finance.receipt, vals) x;
    result := 'new';
  else
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(cur), vals, cur.src, p_time);
    if m.fields <> '{}'::jsonb then
      update finance.receipt e
      set (method, amount_sar, paid_on, ref_at_method, paid_by, note)
          = (select x.method, x.amount_sar, x.paid_on, x.ref_at_method, x.paid_by, x.note
             from pg_catalog.jsonb_populate_record(e, m.fields) x),
          src = m.src, updated_at = pg_catalog.now(), updated_by = p_imp, version = e.version + 1
      where e.id = cur.id;
      result := 'changed';
    else
      result := 'unchanged';
    end if;
    if m.kept <> '{}'::jsonb then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, p_no, ref, 'person_edited',
              (select pg_catalog.string_agg(k, ', ' order by k) from pg_catalog.jsonb_object_keys(m.kept) k), true, p_row);
      perform finance.note_differences('receipt', cur.id, cur.invoice_id, m.kept, p_time, p_batch, p_imp);
    end if;
  end if;
  return result;
end
$$;

create or replace function finance.differences(p_invoice uuid) returns table (
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
      union all
      select pg_catalog.to_jsonb(c), null from finance.receipt c
      where d.row_table = 'receipt' and c.id = d.row_id and c.deleted_at is null
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

