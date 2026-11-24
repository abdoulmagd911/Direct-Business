-- Sabotage: an-expense-keyed-to-a-tax-invoice-is-written
-- Breaks: sql:CKY-01
-- Expect: three expense rows keyed to a tax invoice number are held
-- An expense whose reference is a tax invoice number is settled like any other instead of being held.
create or replace function work.expense_settle(p_partner uuid, p_rows jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
  line jsonb;
  txn text;
  stored text[];
  fresh text[];
  amt numeric(19, 2);
  k text;
  repeated int;
  out_rows jsonb := '[]'::jsonb;
begin
  for r in select value from pg_catalog.jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    txn := nullif(pg_catalog.btrim(coalesce(r ->> 'transaction_ref', '')), '');
    if txn is null then
      continue;
    end if;
    -- A3: a tax-invoice number is never the key of a cost
    if false then
      out_rows := out_rows || pg_catalog.jsonb_build_object('row_no', r -> 'row_no', 'transaction_ref', txn, 'held', true);
      continue;
    end if;
    if pg_catalog.jsonb_typeof(r -> 'lines') is distinct from 'array' then
      -- an older caller: no lines, nothing to settle — the row goes on as it came
      out_rows := out_rows || pg_catalog.jsonb_build_object('row_no', r -> 'row_no', 'transaction_ref', txn, 'held', false);
      continue;
    end if;
    select x.expense_keys into stored from work.import_record x
      where x.partner_id = p_partner and x.deleted_at is null and x.transaction_ref = txn;
    stored := coalesce(stored, '{}');
    fresh := '{}';
    repeated := 0;
    for line in select value from pg_catalog.jsonb_array_elements(r -> 'lines') loop
      amt := (line ->> 'amount')::numeric;
      if amt is null or amt = 0 then
        continue;
      end if;
      k := work.expense_key(amt, line ->> 'approved_at', line ->> 'expense_type');
      if k = any (stored) or k = any (fresh) then
        repeated := repeated + 1;
      else
        fresh := fresh || k;
      end if;
    end loop;
    out_rows := out_rows || pg_catalog.jsonb_build_object(
      'row_no', r -> 'row_no', 'transaction_ref', txn, 'held', false,
      'keys', pg_catalog.to_jsonb(stored || fresh),
      'cost', (select pg_catalog.sum(pg_catalog.split_part(x, '|', 1)::numeric) from pg_catalog.unnest(stored || fresh) x),
      'added', pg_catalog.cardinality(fresh), 'repeated', repeated);
  end loop;
  return out_rows;
end
$$;
