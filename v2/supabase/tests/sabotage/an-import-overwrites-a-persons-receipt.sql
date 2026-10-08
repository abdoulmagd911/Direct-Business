-- Sabotage: an-import-overwrites-a-persons-receipt
-- Breaks: sql:ROW-04
-- Expect: a later file names the receipt a person edited
-- A receipts file overwrites a receipt amount a person set in the app, instead of keeping it and listing the difference (V622 (3), D21).
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
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(cur), vals, null, p_time);
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
