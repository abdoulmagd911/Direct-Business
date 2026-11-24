-- Landing 47 — Finance Part B, items A3 + A4: the cost side is keyed right before anything reconciles it.
--
-- A3. An expense is keyed to its TRANSACTION number. It is registered and approved before a tax invoice can exist,
--     so a cost is never matched to a tax-invoice number: an expense row whose reference is a tax invoice number
--     (DPIN… / TTIN…, or the tax number an imported row of that organisation already carries) is held for a
--     person, with the reason, and is written nowhere. Profit stays what it was: the transaction's revenue less its
--     approved expenses, on the transaction's own row.
-- A4. The cost source is the flat Transaction Expense Export, Approved lines only (the preview holds the rest).
--     One expense is told from another by FOUR things: the transaction number, the amount, the approval time and
--     the expense type. Two lines equal on all four are one expense, counted once — inside one file and across
--     files — and two lines that differ on any of them are two expenses, both counted (never deduplicated on a
--     name and an amount). So a file that carries only some of a transaction's expenses adds them to what is
--     stored; it no longer replaces the stored cost with its own sum.
--     A credit on an expense is a line of its own with a negative amount: it lowers the cost on the row and
--     rewrites nothing else on a Fully Paid record (A10).
--
-- How, forward-only (V103): no pushed migration is edited.
--   - work.import_record.expense_keys: the keys of the expense lines already inside cost_sar ("amount|approval
--     time|type"); the row's own transaction number is the fourth part. Empty on rows written before this landing:
--     such a row's cost is replaced by the next expense file's own sum, exactly as before, and keyed from then on.
--   - work.import_apply keeps its name, arguments and grants. The statement of 20261109000009 is kept whole under
--     the name work.import_apply_core; the function under the old name now settles the expense rows first (the hold
--     of A3, the keys of A4) and hands the rest to it unchanged. A caller that sends no `lines` on an expense row
--     gets exactly the old behaviour.
--   - work.import_expense_preview: the same settlement as a read, for the import preview, so the screen shows the
--     cost that Confirm will store and how many lines are repeats.
-- Regression tests: CKY-01, CKY-02 (supabase/tests/finance/).

alter table work.import_record add column expense_keys text[] not null default '{}';
comment on column work.import_record.expense_keys is
  'Landing 47 (A4): the approved expense lines inside cost_sar, one key each — amount|approval time|expense type; the transaction number is the row''s own. A line whose key is already here is the same expense and is not added again.';

-- One expense line's key. The amount to the halala, the approval time as the file wrote it (trimmed), the type
-- folded as every other word in the app is folded (norm.fold) — one copy of the rule, here.
create function work.expense_key(p_amount numeric, p_approved text, p_type text) returns text
language sql immutable set search_path = '' as $$
  select pg_catalog.to_char(pg_catalog.round(p_amount, 2), 'FM999999999999990.00') || '|'
      || pg_catalog.btrim(coalesce(p_approved, '')) || '|' || coalesce(norm.fold(p_type), '')
$$;
comment on function work.expense_key(numeric, text, text) is 'Landing 47 (A4): amount|approval time|expense type — with the transaction number, what makes one expense line itself.';

-- What an organisation's expense rows come to: per row — held (A3) or settled (A4). One place, read by the
-- preview and by the write, so the screen and the database cannot disagree.
--   p_rows: [{row_no, transaction_ref, lines: [{amount, approved_at, expense_type}]}]
--   answer: [{row_no, transaction_ref, held, cost, keys, added, repeated}]
create function work.expense_settle(p_partner uuid, p_rows jsonb) returns jsonb
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
    if txn ~* '^(DPIN|TTIN)'
       or exists (select 1 from work.import_record x where x.partner_id = p_partner and x.deleted_at is null
                  and x.tax_no is not null and pg_catalog.upper(pg_catalog.btrim(x.tax_no)) = pg_catalog.upper(txn)) then
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
comment on function work.expense_settle(uuid, jsonb) is 'Landing 47 (A3, A4): each expense row of a file, held (keyed to a tax invoice number) or settled (its cost and keys once the repeats are left out).';

-- The preview's read of the same settlement.
create function work.import_expense_preview(p_partner uuid, p_rows jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform authz.require('finance', 'full');
  if p_partner is null or not exists (select 1 from partner.partner where id = p_partner and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  return work.expense_settle(p_partner, p_rows);
end
$$;
comment on function work.import_expense_preview(uuid, jsonb) is 'Landing 47: what an expense file comes to for one organisation before Confirm — per transaction, held or its cost with the repeats left out.';
-- Importing needs the extra finance.import (Landing 40), and so does its preview.
create function api.import_expense_preview(p_partner uuid, p_rows jsonb) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  perform work.import_require();
  return work.import_expense_preview(p_partner, p_rows);
end
$$;

-- The write. The statement of 20261109000009 is kept whole under a new name; the old name settles the expense
-- rows and calls it.
alter function work.import_apply(uuid, jsonb, jsonb, jsonb) rename to import_apply_core;
revoke all on function work.import_apply_core(uuid, jsonb, jsonb, jsonb) from public, authenticated;
comment on function work.import_apply_core(uuid, jsonb, jsonb, jsonb) is 'The import write as it stood before Landing 47 (20261109000009), reached only through work.import_apply.';

create function work.import_apply(p_batch uuid, p_rows jsonb, p_held jsonb default '[]'::jsonb,
  p_decisions jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := authz.require('finance', 'full');
  batch work.import_batch;
  r jsonb;
  s jsonb;
  settled jsonb;
  out_rows jsonb := '[]'::jsonb;
  held jsonb := coalesce(p_held, '[]'::jsonb);
  answer jsonb;
  added int := 0;
  repeated int := 0;
  kept jsonb := '[]'::jsonb;
begin
  if p_batch is not null and p_rows is not null and pg_catalog.jsonb_typeof(p_rows) = 'array' then
    select * into batch from work.import_batch where id = p_batch and deleted_at is null;
  end if;
  -- anything the old statement refuses, it refuses in its own words
  if batch.id is null or batch.status <> 'draft' then
    return work.import_apply_core(p_batch, p_rows, p_held, p_decisions);
  end if;
  settled := work.expense_settle(batch.partner_id,
    coalesce((select pg_catalog.jsonb_agg(x) from pg_catalog.jsonb_array_elements(p_rows) x where x ->> 'kind' = 'expense'), '[]'::jsonb));
  for r in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    if r ->> 'kind' = 'expense' then
      select x into s from pg_catalog.jsonb_array_elements(settled) x
        where x -> 'row_no' = r -> 'row_no'
          and x ->> 'transaction_ref' = pg_catalog.btrim(coalesce(r ->> 'transaction_ref', ''))
        limit 1;
      if s is not null and (s ->> 'held')::boolean then
        held := held || pg_catalog.jsonb_build_object('row_no', (r ->> 'row_no')::int,
          'reason', 'An expense is keyed to a transaction number, never to a tax invoice number: held for a person');
        continue;
      end if;
      if s is not null and s ? 'keys' and (s ->> 'cost') is not null then
        r := pg_catalog.jsonb_set(r, '{cost}', s -> 'cost');
        kept := kept || s;
        added := added + (s ->> 'added')::int;
        repeated := repeated + (s ->> 'repeated')::int;
      end if;
    end if;
    out_rows := out_rows || r;
  end loop;
  answer := work.import_apply_core(p_batch, out_rows, held, p_decisions);
  if pg_catalog.jsonb_array_length(kept) > 0 then
    perform audit.begin('ui', 'import.expense_keys', pg_catalog.jsonb_build_object('count', added));
    update work.import_record x
      set expense_keys = array(select pg_catalog.jsonb_array_elements_text(k.s -> 'keys')),
          updated_at = now(), updated_by = me, version = x.version + 1
      from (select value as s from pg_catalog.jsonb_array_elements(kept)) k
      where x.partner_id = batch.partner_id and x.deleted_at is null and x.transaction_ref = k.s ->> 'transaction_ref'
        and x.expense_keys is distinct from array(select pg_catalog.jsonb_array_elements_text(k.s -> 'keys'));
    perform audit.end();
  end if;
  return answer || pg_catalog.jsonb_build_object('expense_lines',
    pg_catalog.jsonb_build_object('added', added, 'repeated', repeated));
end
$$;
comment on function work.import_apply(uuid, jsonb, jsonb, jsonb) is 'Confirm a draft import. Landing 47: an expense row is keyed to a transaction number (never a tax invoice number) and its lines are counted once each, by transaction + amount + approval time + type; everything else is the statement of 20261109000009.';

revoke all on function work.expense_key(numeric, text, text), work.expense_settle(uuid, jsonb),
  work.import_expense_preview(uuid, jsonb), api.import_expense_preview(uuid, jsonb),
  work.import_apply(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function work.import_apply(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function work.import_expense_preview(uuid, jsonb) to authenticated;
grant execute on function api.import_expense_preview(uuid, jsonb) to authenticated;
