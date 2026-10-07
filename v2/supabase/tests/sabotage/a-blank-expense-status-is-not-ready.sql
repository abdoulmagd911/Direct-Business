-- Sabotage: a-blank-expense-status-is-not-ready
-- Breaks: sql:IMP-02
-- Expect: the words through the list; a blank expense status reads issued (V611)
-- A blank expense status in the export is read as pending — "not ready" — instead of issued (V611).
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
begin
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
  st := case when finance.row_text(p_row, 'status') is null then 'pending' else finance.expense_status_of(p_row ->> 'status') end;
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
    created_src := finance.row_text(p_row, 'created_at')::timestamptz;
    amount := finance.row_text(p_row, 'amount_sar')::numeric(14, 2);
    perform finance.row_text(p_row, 'submitted_at')::timestamptz, finance.row_text(p_row, 'decided_at')::timestamptz;
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount_or_date', sqlerrm, p_row);
    return 'held';
  end;
  if st in ('approved', 'issued') and amount is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'approved_without_amount', p_row ->> 'expense_type', p_row);
    return 'held';
  end if;
  key := pg_catalog.concat_ws('|', ref, norm.fold(coalesce(finance.row_text(p_row, 'expense_type'), '—')), created_src);
  vals := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'expense_type', coalesce(finance.row_text(p_row, 'expense_type'), '—'), 'status', st,
    'status_raw', finance.row_text(p_row, 'status'), 'amount_sar', amount, 'merchant', finance.row_text(p_row, 'merchant'),
    'id_reference', finance.row_text(p_row, 'id_reference'), 'created_at_src', created_src,
    'submitted_at', finance.row_text(p_row, 'submitted_at')::timestamptz,
    'decided_at', finance.row_text(p_row, 'decided_at')::timestamptz,
    'submitter', finance.row_text(p_row, 'submitter'), 'approver', finance.row_text(p_row, 'approver')));
  select * into cur from finance.expense_line e where e.line_key = key and e.deleted_at is null;
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
