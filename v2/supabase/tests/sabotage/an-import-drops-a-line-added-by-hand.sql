-- Sabotage: an-import-drops-a-line-added-by-hand
-- Breaks: sql:ROW-01
-- Expect: the removed line stays removed; the line added by hand stays
-- A newer import removes a line a person added by hand because the file does not have it (V622).
create or replace function finance.import_invoice(p_batch uuid, p_no int, p_row jsonb, p_time timestamptz, p_imp uuid) returns text
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  ref text := finance.row_text(p_row, 'ref');
  cur finance.invoice;
  removed boolean;
  st finance.status_map;
  kind text;
  created date; generated date; paid date; due date; status_at timestamptz;
  total numeric;
  vals jsonb;
  m record;
  inv uuid;
  l jsonb;
  lines_newer boolean;
  touched boolean := false;
  dp text := finance.row_text(p_row, 'dpin');
  held boolean := false;
begin
  if ref is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, null, 'no_ref', p_row);
    return 'held';
  end if;
  -- the values, read or held
  begin
    created := finance.row_date(p_row, 'created_on');
    generated := finance.row_date(p_row, 'generated_on');
    paid := finance.row_date(p_row, 'paid_on');
    due := finance.row_date(p_row, 'due_on');
    status_at := finance.row_text(p_row, 'status_at')::timestamptz;
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_date', sqlerrm, p_row);
    return 'held';
  end;
  begin
    total := finance.row_text(p_row, 'total_sar')::numeric(14, 2);
    -- every line readable, with its total (an unreadable amount is held, never 0 — §3.11.2)
    perform finance.row_text(x, 'line_no')::int, finance.row_text(x, 'qty')::numeric,
            finance.row_text(x, 'unit_price')::numeric, finance.row_text(x, 'discount_sar')::numeric,
            (x ->> 'taxable')::boolean, finance.row_text(x, 'total_sar')::numeric(14, 2)
    from pg_catalog.jsonb_array_elements(coalesce(p_row -> 'lines', '[]'::jsonb)) x;
    if exists (select 1 from pg_catalog.jsonb_array_elements(coalesce(p_row -> 'lines', '[]'::jsonb)) x
               where finance.row_text(x, 'total_sar') is null) then
      raise exception 'a line has no total';
    end if;
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount', finance.row_text(p_row, 'total_sar'), p_row);
    return 'held';
  end;
  if created is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'no_created_date', p_row);
    return 'held';
  end if;
  if greatest(created, generated, paid) > core.riyadh_today() then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'date_in_future', greatest(created, generated, paid)::text, p_row);
    return 'held';
  end if;
  st := finance.status_of(finance.row_text(p_row, 'status'));
  if st.id is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'status_unknown', coalesce(finance.row_text(p_row, 'status'), '(blank)'), p_row);
    return 'held';
  end if;

  -- a hand-typed row is never touched (D21); a removed one is never revived (OA12)
  select * into cur from finance.invoice i where i.ref = finance.row_text(p_row, 'ref') and i.deleted_at is null;
  removed := cur.id is null and exists (select 1 from finance.invoice i where i.ref = finance.row_text(p_row, 'ref'));
  if removed then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'removed_row', p_row);
    return 'held';
  end if;
  if cur.source = 'manual' then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'manual_row', 'typed by a person; the import never changes it', p_row);
    return 'held';
  end if;

  -- the kind as Payments shapes it (§3.6): a credit note; a billing invoice (is_consolidated); a transaction (it names
  -- the billing invoice it was consolidated into, or says it was); else standalone. Every line a wallet line: a top-up.
  kind := case when pg_catalog.lower(finance.row_text(p_row, 'type')) in ('credit_note', 'credit note') then 'credit_note'
               when coalesce(pg_catalog.lower(finance.row_text(p_row, 'is_consolidated')) in ('true', 'yes', '1'), false)
                 then 'billing'
               when finance.row_text(p_row, 'consolidated_ref') is not null
                    or pg_catalog.lower(finance.row_text(p_row, 'consolidation_status')) like 'consolidation%' then 'transaction'
               else 'standalone' end;
  if kind in ('transaction', 'standalone')
     and pg_catalog.jsonb_array_length(coalesce(p_row -> 'lines', '[]'::jsonb)) > 0
     and not exists (select 1 from pg_catalog.jsonb_array_elements(p_row -> 'lines') x
                     where not finance.is_wallet_line(finance.product_of(finance.row_text(x, 'product')),
                                                      finance.row_text(x, 'name'))) then
    kind := 'wallet_topup';
  end if;

  vals := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'kind', kind,
    'customer_name', finance.row_text(p_row, 'customer_name'),
    'customer_email', pg_catalog.lower(finance.row_text(p_row, 'customer_email')),
    'customer_phone', finance.row_text(p_row, 'customer_phone'),
    'client_id_raw', finance.row_text(p_row, 'client_id'),
    'tax_no_raw', finance.row_text(p_row, 'tax_no'),
    'discount_code_raw', finance.row_text(p_row, 'discount_code'),
    'status_raw', finance.row_text(p_row, 'status'),
    'status_id', st.id,
    'status_at', status_at,
    'consolidation_status_raw', finance.row_text(p_row, 'consolidation_status'),
    'created_on', created, 'generated_on', generated, 'paid_on', paid, 'due_on', due,
    'total_sar', total,
    'product_raw', finance.row_text(p_row, 'product'),
    'product_id', finance.product_of(finance.row_text(p_row, 'product')),
    'branch', finance.row_text(p_row, 'branch'),
    'salesman_raw', finance.row_text(p_row, 'salesman')));

  if cur.id is null then
    insert into finance.invoice (ref, kind, customer_name, customer_email, customer_phone, client_id_raw, tax_no_raw,
                                 discount_code_raw, status_raw, status_id, status_at, consolidation_status_raw,
                                 created_on, generated_on, paid_on, due_on, total_sar, product_raw, product_id, branch,
                                 salesman_raw, source, src, first_batch_id, last_batch_id, payments_as_of, created_by)
    select ref, kind, x.customer_name, x.customer_email, x.customer_phone, x.client_id_raw, x.tax_no_raw,
           x.discount_code_raw, x.status_raw, x.status_id, x.status_at, x.consolidation_status_raw,
           x.created_on, x.generated_on, x.paid_on, x.due_on, x.total_sar, x.product_raw, x.product_id, x.branch,
           x.salesman_raw, 'import',
           (select pg_catalog.jsonb_object_agg(k, p_time) from pg_catalog.jsonb_object_keys(vals || '{"lines": 0}') k),
           p_batch, p_batch, (p_time at time zone 'Asia/Riyadh')::date, p_imp
    from pg_catalog.jsonb_populate_record(null::finance.invoice, vals) x
    returning id into inv;
    lines_newer := true;
    touched := true;
  else
    inv := cur.id;
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(cur), vals, cur.src, p_time);
    lines_newer := p_time > coalesce((cur.src ->> 'lines')::timestamptz, '-infinity'::timestamptz);
    if m.fields <> '{}'::jsonb then
      update finance.invoice i
      set (kind, customer_name, customer_email, customer_phone, client_id_raw, tax_no_raw, discount_code_raw, status_raw,
           status_id, status_at, consolidation_status_raw, created_on, generated_on, paid_on, due_on, total_sar,
           product_raw, product_id, branch, salesman_raw)
          = (select x.kind, x.customer_name, x.customer_email, x.customer_phone, x.client_id_raw, x.tax_no_raw,
                    x.discount_code_raw, x.status_raw, x.status_id, x.status_at, x.consolidation_status_raw, x.created_on,
                    x.generated_on, x.paid_on, x.due_on, x.total_sar, x.product_raw, x.product_id, x.branch, x.salesman_raw
             from pg_catalog.jsonb_populate_record(i, m.fields) x),
          src = m.src, last_batch_id = p_batch,
          payments_as_of = greatest(i.payments_as_of, (p_time at time zone 'Asia/Riyadh')::date),
          updated_at = pg_catalog.now(), updated_by = p_imp, version = i.version + 1
      where i.id = inv;
      touched := true;
    end if;
    -- a field a person edited stays theirs; the difference is listed for them (V622, D21)
    if m.kept <> '{}'::jsonb then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, p_no, ref, 'person_edited',
              (select pg_catalog.string_agg(k, ', ' order by k) from pg_catalog.jsonb_object_keys(m.kept) k), true, p_row);
    end if;
  end if;

  -- the lines: written whole from a newer file; an older one only adds a line the invoice lacks
  for l in select x from pg_catalog.jsonb_array_elements(coalesce(p_row -> 'lines', '[]'::jsonb)) x loop
    declare
      no int := coalesce(finance.row_text(l, 'line_no')::int, 0);
      old finance.invoice_line;
      lv jsonb;
    begin
      select * into old from finance.invoice_line x where x.invoice_id = inv and x.line_no = no and x.deleted_at is null;
      lv := pg_catalog.jsonb_build_object(
        'product_raw', finance.row_text(l, 'product'), 'product_id', finance.product_of(finance.row_text(l, 'product')),
        'name', coalesce(finance.row_text(l, 'name'), finance.row_text(l, 'product'), '—'),
        'qty', coalesce(finance.row_text(l, 'qty')::numeric, 1), 'unit_price', finance.row_text(l, 'unit_price')::numeric,
        'discount_sar', coalesce(finance.row_text(l, 'discount_sar')::numeric, 0),
        'taxable', coalesce((l ->> 'taxable')::boolean, true), 'total_sar', finance.row_text(l, 'total_sar')::numeric,
        'service_id', (select p.service_id from finance.product p where p.id = finance.product_of(finance.row_text(l, 'product'))));
      if old.id is null and exists (select 1 from finance.invoice_line x where x.invoice_id = inv and x.line_no = no
                                    and x.deleted_at is not null and x.deleted_by <> p_imp) then
        -- a line a person removed is never brought back (V622, OA12)
        insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
        values (p_batch, p_no, ref, 'removed_row', 'line ' || no, true, p_row);
      elsif old.id is not null and finance.by_person(old.src) then
        -- a line a person edited or added stays as they left it; a difference is listed for them (V622)
        if (pg_catalog.to_jsonb(old) - array['id', 'invoice_id', 'line_no', 'src', 'created_at', 'created_by', 'updated_at',
                                             'updated_by', 'version', 'deleted_at', 'deleted_by', 'delete_reason']) <> lv then
          insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
          values (p_batch, p_no, ref, 'person_edited', 'line ' || no, true, p_row);
        end if;
      elsif old.id is null then
        insert into finance.invoice_line (invoice_id, line_no, product_raw, product_id, name, qty, unit_price, discount_sar,
                                          taxable, total_sar, service_id, created_by)
        select inv, no, x.product_raw, x.product_id, x.name, x.qty, x.unit_price, x.discount_sar, x.taxable, x.total_sar,
               x.service_id, p_imp
        from pg_catalog.jsonb_populate_record(null::finance.invoice_line, lv) x;
        touched := true;
      elsif lines_newer and (pg_catalog.to_jsonb(old) - array['id', 'invoice_id', 'line_no', 'src', 'created_at', 'created_by',
                              'updated_at', 'updated_by', 'version', 'deleted_at', 'deleted_by', 'delete_reason']) <> lv then
        update finance.invoice_line x
        set (product_raw, product_id, name, qty, unit_price, discount_sar, taxable, total_sar, service_id)
            = (select y.product_raw, y.product_id, y.name, y.qty, y.unit_price, y.discount_sar, y.taxable, y.total_sar,
                      y.service_id from pg_catalog.jsonb_populate_record(null::finance.invoice_line, lv) y),
            updated_at = pg_catalog.now(), updated_by = p_imp, version = x.version + 1
        where x.id = old.id;
        touched := true;
      end if;
    end;
  end loop;
  if lines_newer and pg_catalog.jsonb_array_length(coalesce(p_row -> 'lines', '[]'::jsonb)) > 0 then
    update finance.invoice_line x
    set deleted_at = pg_catalog.now(), deleted_by = p_imp, delete_reason = 'not in the newer Payments export'
    where x.invoice_id = inv and x.deleted_at is null
      and x.line_no not in (select coalesce(finance.row_text(e, 'line_no')::int, 0)
                            from pg_catalog.jsonb_array_elements(p_row -> 'lines') e);
    if found then
      touched := true;
    end if;
    update finance.invoice i set src = coalesce(i.src, '{}'::jsonb) || pg_catalog.jsonb_build_object('lines', p_time)
    where i.id = inv and (i.src ->> 'lines') is distinct from pg_catalog.to_jsonb(p_time) #>> '{}';
  end if;

  -- the DPIN (V617: its own field): on a billing or standalone invoice; a transaction's is held
  if dp is not null then
    if not finance.kind_allows(kind, 'dpin') then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, p_no, ref, 'dpin_on_' || kind, dp, true, p_row);
      held := true;
    elsif not exists (select 1 from finance.tax_invoice t where t.parent_invoice_id = inv and t.deleted_at is null) then
      if exists (select 1 from finance.tax_invoice t where t.dpin = dp and t.deleted_at is null) then
        insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
        values (p_batch, p_no, ref, 'dpin_repeats', dp, true, p_row);
        held := true;
      else
        insert into finance.tax_invoice (dpin, parent_invoice_id, total_sar, issued_on, source, created_by)
        values (dp, inv, finance.row_text(p_row, 'dpin_total')::numeric, generated, 'import', p_imp);
        touched := true;
      end if;
    end if;
  end if;

  -- the organisation (§3.5): an unknown client ID or a conflict waits for a person (V420)
  select * into m from finance.partner_match(inv);
  if m.state in ('unknown_client_id', 'conflict') then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
    values (p_batch, p_no, ref, m.state, m.level, true, p_row);
  end if;

  return case when cur.id is null then 'new' when touched then 'changed' else 'unchanged' end;
end
$$;
