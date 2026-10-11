-- v2 finance, part 4 (V622 (3)): every imported row can be edited, added to and removed in the app — invoices, their
-- lines and their expenses — by a person with Full on Finance, each change one logged request that Undo takes back.
-- Editing a field makes it the person's: a later import never overwrites it and lists the difference for them instead
-- (finance.merge_fields, D21, V50). Removing archives the row (V97) and a later import never brings it back. A row added
-- by hand beside the imported ones is the person's too. The screens come with P4-4/P4-5. Forward-only (V103).

-- ================================================================ which fields a person may set (V622 (2): no hard-coded words)
-- The keys a door takes, turned into column values: a status word goes through finance.status_map (or
-- finance.expense_status_word) and a product through finance.product — an unknown word is refused, never guessed.
create function finance.row_values(p_table text, p_fields jsonb, p_adding boolean) returns jsonb
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

-- A Finance list's live entry by key (a word on no entry is refused).
create function finance.entry_id(p_table text, p_key text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  rid uuid;
begin
  if p_key is null then
    return null;
  end if;
  execute pg_catalog.format('select t.id from %s t where t.active and t.deleted_at is null and t.key = $1',
                            pg_catalog.to_regclass(p_table))
    into rid using p_key;
  if rid is null then
    raise exception using errcode = 'P0002', message = 'finance.unknown_entry', detail = p_key;
  end if;
  return rid;
end
$$;

-- ================================================================ edit (V622 (3))
-- One row's fields, by a person with Full on Finance, with the version they read (A14). Each field set becomes the
-- person's (src 'person'), so a later import leaves it and lists the difference.
create function finance.row_edit(p_table text, p_id uuid, p_fields jsonb, p_version int, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  t text := 'finance.' || p_table;
  vals jsonb := finance.row_values(p_table, p_fields, false);
  cols text;
  marks jsonb;
  req uuid;
  ref text;
begin
  execute pg_catalog.format('select true from %s x where x.id = $1 and x.deleted_at is null for update', pg_catalog.to_regclass(t))
    into ref using p_id;
  if ref is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform core.check_version(t, p_id, p_version, array(select pg_catalog.jsonb_object_keys(vals)));
  select pg_catalog.string_agg(pg_catalog.quote_ident(k), ', ' order by k),
         pg_catalog.jsonb_object_agg(k, 'person')
  into cols, marks
  from pg_catalog.jsonb_object_keys(vals) k;
  req := audit.begin('ui', 'finance.row_edited', pg_catalog.jsonb_build_object('table', p_table), p_reason);
  execute pg_catalog.format(
    'update %1$s x set (%2$s) = (select %2$s from pg_catalog.jsonb_populate_record(x, $1)), '
    'src = coalesce(x.src, ''{}''::jsonb) || $2, updated_at = pg_catalog.now(), updated_by = $3, version = x.version + 1 '
    'where x.id = $4', pg_catalog.to_regclass(t), cols)
    using vals, marks, me, p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- ================================================================ add by hand (V622 (3))
-- An invoice (source manual — no import ever touches it), a line on an invoice or an expense on a transaction or
-- standalone invoice, beside the imported ones; the row is the person's (src _row 'person').
create function finance.row_add(p_table text, p_fields jsonb, p_reason text) returns jsonb
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
  if p_table in ('invoice_line', 'expense_line')
     and not exists (select 1 from finance.invoice i where i.id = (vals ->> 'invoice_id')::uuid and i.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'invoice_id';
  end if;
  if p_table = 'invoice_line' and not (vals ? 'line_no') then
    vals := vals || pg_catalog.jsonb_build_object('line_no',
              (select coalesce(max(l.line_no), 0) + 1 from finance.invoice_line l where l.invoice_id = (vals ->> 'invoice_id')::uuid));
  end if;
  vals := vals || pg_catalog.jsonb_build_object('created_by', me, 'src', pg_catalog.jsonb_build_object('_row', 'person'))
               || case when p_table in ('invoice', 'expense_line') then '{"source": "manual"}'::jsonb else '{}'::jsonb end;
  select pg_catalog.string_agg(pg_catalog.quote_ident(k), ', ' order by k) into cols from pg_catalog.jsonb_object_keys(vals) k;
  req := audit.begin('ui', 'finance.row_added', pg_catalog.jsonb_build_object('table', p_table), p_reason);
  execute pg_catalog.format('insert into %1$s (%2$s) select %2$s from pg_catalog.jsonb_populate_record(null::%1$s, $1) returning id',
                            pg_catalog.to_regclass(t), cols)
    into rid using vals;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'request_id', req);
end
$$;

-- ================================================================ remove (V622 (3), V97)
-- Archives rows with a reason, one request; a later import never brings them back (finance.import_*).
create function finance.rows_remove(p_table text, p_ids uuid[], p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  n int;
  req uuid;
begin
  if p_table not in ('invoice', 'invoice_line', 'expense_line') then
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

-- ================================================================ the doors the Data API reaches (V124)
create function api.finance_row_edit(p_table text, p_id uuid, p_fields jsonb, p_version int, p_reason text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select finance.row_edit(p_table, p_id, p_fields, p_version, p_reason) $$;
create function api.finance_row_add(p_table text, p_fields jsonb, p_reason text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select finance.row_add(p_table, p_fields, p_reason) $$;
create function api.finance_rows_remove(p_table text, p_ids uuid[], p_reason text)
returns jsonb language sql security invoker set search_path = ''
as $$ select finance.rows_remove(p_table, p_ids, p_reason) $$;

revoke all on function finance.row_edit(text, uuid, jsonb, int, text) from public;
revoke all on function finance.row_add(text, jsonb, text) from public;
revoke all on function finance.rows_remove(text, uuid[], text) from public;
grant execute on function finance.row_edit(text, uuid, jsonb, int, text) to authenticated;
grant execute on function finance.row_add(text, jsonb, text) to authenticated;
grant execute on function finance.rows_remove(text, uuid[], text) to authenticated;
grant execute on function api.finance_row_edit(text, uuid, jsonb, int, text) to authenticated;
grant execute on function api.finance_row_add(text, jsonb, text) to authenticated;
grant execute on function api.finance_rows_remove(text, uuid[], text) to authenticated;
