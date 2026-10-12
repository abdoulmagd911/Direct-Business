-- QA-539 (D21, V622): an expense's and a receipt's key neither collapses two rows into one nor splits one into two.
--  * Where a file repeats a key — two expenses of one type with no created time, two receipts of one method on one day
--    with no reference at the method — the second is numbered (…|#2), the third …|#3, in the file's order, so each is
--    its own row and the next cumulative file finds each again. The first keeps the key it always had.
--  * An expense that comes back in a newer file with another created time is the stored line of that type the file
--    no longer carries: that line takes the new time, never a second cost beside it. An older file that would undo it
--    is held as older_file.
--  * A receipt's key no longer carries its amount, so a corrected amount changes the receipt, never adds a second;
--    the stored receipts take the new key. A key's times are written in UTC whatever the session's zone.
-- Forward-only.

-- An expense row's key: the transaction, the expense type, the created time.
create function finance.expense_key(p_row jsonb) returns text
language plpgsql stable set search_path = ''
as $$
declare
  t timestamptz := finance.row_time(p_row, 'created_at');
begin
  return pg_catalog.concat_ws('|', finance.row_text(p_row, 'ref'),
                              norm.fold(coalesce(finance.row_text(p_row, 'expense_type'), '—')),
                              (t at time zone 'UTC')::text || '+00');
end
$$;

-- A receipt row's key: the transaction, then the reference at the payment method, else the method and the day.
create function finance.receipt_key(p_row jsonb) returns text
language plpgsql stable set search_path = ''
as $$
begin
  return pg_catalog.concat_ws('|', finance.row_text(p_row, 'ref'),
           coalesce(norm.fold(finance.row_text(p_row, 'ref_at_method')),
                    pg_catalog.concat_ws('|', norm.fold(coalesce(finance.row_text(p_row, 'method'), '—')),
                                         pg_catalog.to_char(finance.row_date(p_row, 'paid_on'), 'YYYY-MM-DD'))));
end
$$;

-- The file's rows with their keys: each expense or receipt row gets _line_key (numbered where the file repeats it) and
-- _group_keys (the keys of the file's rows for the same transaction and expense type). A row whose key cannot be read
-- is left as it is; its own import holds it.
-- A row's key and its group for keyed_rows, or null where the row cannot be read (its own import holds it).
create function finance.row_key_of(p_file text, p_row jsonb, p_group boolean) returns text
language plpgsql stable set search_path = ''
as $$
begin
  if pg_catalog.jsonb_typeof(p_row) is distinct from 'object' or finance.row_text(p_row, 'ref') is null then
    return null;
  end if;
  if p_file = 'expenses' then
    return case when p_group then pg_catalog.concat_ws('|', finance.row_text(p_row, 'ref'),
                                                       norm.fold(coalesce(finance.row_text(p_row, 'expense_type'), '—')))
                else finance.expense_key(p_row) end;
  end if;
  return case when p_group then finance.row_text(p_row, 'ref') else finance.receipt_key(p_row) end;
exception when others then
  return null;
end
$$;

create function finance.keyed_rows(p_file text, p_rows jsonb) returns jsonb
language sql stable set search_path = ''
as $$
  with k as (
    select e.ordinality as ord, e.value as x, finance.row_key_of(p_file, e.value, false) as base,
           finance.row_key_of(p_file, e.value, true) as grp,
           -- only a row with nothing of its own to tell it apart is numbered: a repeated created time or reference at
           -- the payment method is the same row twice
           pg_catalog.jsonb_typeof(e.value) = 'object'
             and finance.row_text(e.value, case p_file when 'expenses' then 'created_at' else 'ref_at_method' end)
                 is null as bare
    from pg_catalog.jsonb_array_elements(p_rows) with ordinality e
  ), n as (
    select k.ord, k.x, k.grp,
           case when k.base is null then null
                when not k.bare or pg_catalog.row_number() over w = 1 then k.base
                else k.base || '|#' || pg_catalog.row_number() over w end as key
    from k window w as (partition by k.base order by k.ord)
  )
  select case when p_file not in ('expenses', 'receipts') then p_rows
              else coalesce(pg_catalog.jsonb_agg(
                     case when n.key is null then n.x
                          else n.x || pg_catalog.jsonb_build_object(
                                 '_line_key', n.key,
                                 '_group_keys', (select pg_catalog.jsonb_agg(m.key) from n m
                                                 where m.grp = n.grp and m.key is not null))
                     end order by n.ord), '[]'::jsonb) end
  from n
$$;

-- The stored receipts take the key without the amount (numbered where two now share one, oldest first).
with k as (
  select c.id, c.created_at,
         pg_catalog.concat_ws('|', i.ref, coalesce(norm.fold(c.ref_at_method),
           pg_catalog.concat_ws('|', norm.fold(coalesce(c.method, '—')), pg_catalog.to_char(c.paid_on, 'YYYY-MM-DD')))) as base
  from finance.receipt c join finance.invoice i on i.id = c.invoice_id
), n as (
  select k.id, case when pg_catalog.row_number() over w = 1 then k.base
                    else k.base || '|#' || pg_catalog.row_number() over w end as key
  from k window w as (partition by k.base order by k.created_at, k.id)
)
update finance.receipt c set receipt_key = n.key from n where n.id = c.id and c.receipt_key is distinct from n.key;

create or replace function finance.import_run(p_file text, p_rows jsonb, p_export_time timestamptz, p_file_name text,
                                   p_sha256 text, p_dry_run boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_capability('finance.import');
  imp uuid := core.import_person_id();
  b uuid;
  prior finance.import_batch;
  req uuid;
  r jsonb;
  n int := 0;
  c_new int := 0; c_changed int := 0; c_unchanged int := 0; c_held int := 0;
  answer jsonb;
begin
  if p_file not in ('invoices', 'expenses', 'receipts') then
    raise exception using errcode = 'P0001', message = 'finance.import_unknown_file', detail = p_file;
  end if;
  if pg_catalog.jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'rows';
  end if;
  if p_export_time is null or p_export_time > pg_catalog.now() + interval '1 hour' then
    raise exception using errcode = 'P0001', message = 'finance.import_export_time', detail = coalesce(p_export_time::text, '');
  end if;
  -- The same file twice changes nothing (§3.11.6).
  select * into prior from finance.import_batch x where x.file_sha256 = p_sha256;
  if prior.id is not null then
    return pg_catalog.jsonb_build_object('already_imported', true, 'batch_id', prior.id, 'on', prior.created_at,
                                         'by', prior.started_by, 'counts', prior.counts);
  end if;

  req := audit.begin('import', 'finance.imported',
                     pg_catalog.jsonb_build_object('file', p_file, 'rows', pg_catalog.jsonb_array_length(p_rows)));
  insert into finance.import_batch (file, file_name, file_sha256, export_time, started_by, request_id)
  values (p_file, p_file_name, p_sha256, p_export_time, me, req)
  returning id into b;

  -- each expense and receipt row carries its key, numbered where the file repeats one (QA-539)
  for r in select x from pg_catalog.jsonb_array_elements(finance.keyed_rows(p_file, p_rows)) x loop
    n := n + 1;
    -- one row at a time: a row the database refuses (too long, out of range, a wrong kind, not a list …) is rolled
    -- back alone and held with the reason, and the rest of the file imports (QA-532, D21)
    declare
      res text;
      why text;
      what text;
    begin
      begin
        res := case p_file when 'invoices' then finance.import_invoice(b, n, r, p_export_time, imp)
                           when 'receipts' then finance.import_receipt(b, n, r, p_export_time, imp)
                           else finance.import_expense(b, n, r, p_export_time, imp) end;
      exception when others then
        get stacked diagnostics why = message_text, what = constraint_name;
        insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
        values (b, n, case when pg_catalog.jsonb_typeof(r) = 'object' then pg_catalog.left(finance.row_text(r, 'ref'), 200) end,
                'unreadable_row', coalesce(nullif(what, ''), why),
                case when pg_catalog.jsonb_typeof(r) = 'object' then r - '_line_key' - '_group_keys'
                     else pg_catalog.jsonb_build_object('value', r) end);
        res := 'held';
      end;
    case res
      when 'new' then c_new := c_new + 1;
      when 'changed' then c_changed := c_changed + 1;
      when 'unchanged' then c_unchanged := c_unchanged + 1;
      else c_held := c_held + 1;
    end case;
    end;
  end loop;
  if p_file = 'invoices' then
    perform finance.import_links(b, p_rows, imp);
  end if;

  update finance.import_batch x
  set counts = pg_catalog.jsonb_build_object('read', n, 'new', c_new, 'changed', c_changed, 'unchanged', c_unchanged,
                                            'held', c_held)
  where x.id = b;
  select pg_catalog.jsonb_build_object(
           'batch_id', b, 'counts', x.counts,
           'held', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('row', h.row_no, 'ref', h.ref,
                                                                                      'reason', h.reason_key, 'detail', h.detail,
                                                                                      'written', h.written)
                                                         order by h.row_no, h.reason_key)
                             from finance.import_held h where h.batch_id = b), '[]'::jsonb))
  into answer from finance.import_batch x where x.id = b;
  perform audit.end();
  if p_dry_run then
    raise exception using errcode = 'P0001', message = 'finance.import_dry_run', detail = answer::text;
  end if;
  return answer;
end
$$;

create or replace function finance.import_expense(p_batch uuid, p_no int, p_row jsonb, p_time timestamptz, p_imp uuid) returns text
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  ref text := finance.row_text(p_row, 'ref');
  inv finance.invoice;
  st text;
  tst text;
  created_src timestamptz;
  amount numeric;
  key text;
  cur finance.expense_line;
  vals jsonb;
  m record;
  result text;
  group_keys text[] := array(select pg_catalog.jsonb_array_elements_text(coalesce(p_row -> '_group_keys', '[]'::jsonb)));
  given_key text := p_row ->> '_line_key';
  newest timestamptz;
begin
  p_row := p_row - '_line_key' - '_group_keys';
  if ref is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, null, 'no_ref', p_row);
    return 'held';
  end if;
  select * into inv from finance.invoice i where i.ref = finance.row_text(p_row, 'ref') and i.deleted_at is null;
  if inv.id is null then
    -- a cost line for a reference Finance lacks: held; the cumulative export brings it again (§3.11.7)
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'no_invoice', p_row);
    return 'held';
  end if;
  if inv.source = 'manual' then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'manual_row', 'typed by a person; the import never changes it', p_row);
    return 'held';
  end if;
  if not finance.kind_allows(inv.kind, 'expense') then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'expense_on_' || inv.kind, finance.row_text(p_row, 'expense_type'), p_row);
    return 'held';
  end if;
  -- a status word maps through the list; a blank one reads issued — done (V611)
  st := case when finance.row_text(p_row, 'status') is null then 'issued' else finance.expense_status_of(p_row ->> 'status') end;
  if st is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'expense_status_unknown', p_row ->> 'status', p_row);
    return 'held';
  end if;
  if p_row ? 'transaction_expense_status' then
    tst := case when finance.row_text(p_row, 'transaction_expense_status') is null then 'issued'
                else finance.expense_status_of(p_row ->> 'transaction_expense_status') end;
    if tst is null then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
      values (p_batch, p_no, ref, 'expense_status_unknown', p_row ->> 'transaction_expense_status', p_row);
      return 'held';
    end if;
  end if;
  begin
    created_src := finance.row_time(p_row, 'created_at');
    amount := finance.row_text(p_row, 'amount_sar')::numeric(14, 2);
    perform finance.row_time(p_row, 'submitted_at'), finance.row_time(p_row, 'decided_at');
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount_or_date', sqlerrm, p_row);
    return 'held';
  end;
  -- a day after today is a typing slip, held as invoices and receipts are (QA-539)
  if (created_src at time zone 'Asia/Riyadh')::date > core.riyadh_today() then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'date_in_future', (created_src at time zone 'Asia/Riyadh')::date::text, p_row);
    return 'held';
  end if;
  if st in ('approved', 'issued') and amount is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'approved_without_amount', p_row ->> 'expense_type', p_row);
    return 'held';
  end if;
  key := coalesce(given_key, finance.expense_key(p_row));
  vals := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'expense_type', coalesce(finance.row_text(p_row, 'expense_type'), '—'), 'status', st,
    'status_raw', finance.row_text(p_row, 'status'), 'amount_sar', amount, 'merchant', finance.row_text(p_row, 'merchant'),
    'id_reference', finance.row_text(p_row, 'id_reference'), 'created_at_src', created_src,
    'submitted_at', finance.row_time(p_row, 'submitted_at'),
    'decided_at', finance.row_time(p_row, 'decided_at'),
    'submitter', finance.row_text(p_row, 'submitter'), 'approver', finance.row_text(p_row, 'approver')));
  select * into cur from finance.expense_line e where e.line_key = key and e.deleted_at is null;
  if cur.id is null and exists (select 1 from finance.expense_line e where e.line_key = key and e.deleted_at is not null
                                and e.deleted_by <> p_imp) then
    -- an expense a person removed is never brought back (V622, OA12)
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'removed_row', p_row ->> 'expense_type', p_row);
    return 'held';
  end if;
  if cur.id is null then
    -- the same expense with another created time in a newer file: the stored line of that type this file no longer
    -- carries is that expense, so it is the one changed, never a second cost beside it (QA-539)
    select * into cur from finance.expense_line e
    where e.invoice_id = inv.id and e.deleted_at is null and e.source = 'import'
      and norm.fold(e.expense_type) = norm.fold(coalesce(finance.row_text(p_row, 'expense_type'), '—'))
      and e.line_key <> all (group_keys)
    order by e.created_at_src nulls last, e.line_key
    limit 1;
    if cur.id is not null then
      select pg_catalog.max(v.value::timestamptz) into newest
      from pg_catalog.jsonb_each_text(coalesce(cur.src, '{}'::jsonb)) v where v.value <> 'person';
      if p_time <= coalesce(newest, '-infinity'::timestamptz) then
        insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
        values (p_batch, p_no, ref, 'older_file', 'a newer file gave this expense another time', p_row);
        return 'held';
      end if;
      update finance.expense_line e
      set line_key = key, created_at_src = created_src,
          src = coalesce(e.src, '{}'::jsonb) || pg_catalog.jsonb_build_object('created_at_src', p_time),
          updated_at = pg_catalog.now(), updated_by = p_imp, version = e.version + 1
      where e.id = cur.id
      returning * into cur;
    end if;
  end if;
  if cur.id is null then
    insert into finance.expense_line (invoice_id, line_key, expense_type, status, status_raw, amount_sar, merchant,
                                      id_reference, created_at_src, submitted_at, decided_at, submitter, approver, source,
                                      src, created_by)
    select inv.id, key, x.expense_type, x.status, x.status_raw, x.amount_sar, x.merchant, x.id_reference, x.created_at_src,
           x.submitted_at, x.decided_at, x.submitter, x.approver, 'import',
           (select pg_catalog.jsonb_object_agg(k, p_time) from pg_catalog.jsonb_object_keys(vals) k), p_imp
    from pg_catalog.jsonb_populate_record(null::finance.expense_line, vals) x;
    result := 'new';
  else
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(cur), vals, cur.src, p_time);
    if m.fields <> '{}'::jsonb then
      update finance.expense_line e
      set (expense_type, status, status_raw, amount_sar, merchant, id_reference, submitted_at, decided_at, submitter, approver)
          = (select x.expense_type, x.status, x.status_raw, x.amount_sar, x.merchant, x.id_reference, x.submitted_at,
                    x.decided_at, x.submitter, x.approver from pg_catalog.jsonb_populate_record(e, m.fields) x),
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
      perform finance.note_differences('expense_line', cur.id, cur.invoice_id, m.kept, p_time, p_batch, p_imp);
    end if;
  end if;
  -- the transaction-level expense status, by the same merge rule
  if tst is not null then
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(inv),
                                              pg_catalog.jsonb_build_object('expense_status', tst,
                                                                            'expense_status_raw', finance.row_text(p_row, 'transaction_expense_status')),
                                              inv.src, p_time);
    if m.fields ? 'expense_status' then
      update finance.invoice i
      set expense_status = m.fields ->> 'expense_status', expense_status_raw = coalesce(m.fields ->> 'expense_status_raw', i.expense_status_raw),
          src = m.src, updated_at = pg_catalog.now(), updated_by = p_imp, version = i.version + 1
      where i.id = inv.id;
      if result = 'unchanged' then
        result := 'changed';
      end if;
    end if;
  end if;
  return result;
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
  given_key text := p_row ->> '_line_key';
begin
  p_row := p_row - '_line_key' - '_group_keys';
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
  key := coalesce(given_key, finance.receipt_key(p_row));
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
