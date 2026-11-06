-- Fix22 (6 Nov 2026): every import Confirm failed live with Postgres 42702
-- 'column reference "kind" is ambiguous' (x10) and '"problems" is ambiguous'
-- (x2) during the pilot re-run, so no import could be confirmed at all.
-- work.import_apply declares two plpgsql variables that collide with columns:
-- `kind` (the kind of the current JSON row) collides with
-- work.import_record.kind, and `problems` (the accumulated problems) collides
-- with work.import_batch.problems. The variable `kind` is renamed to
-- `row_kind`, the variable `problems` to `apply_problems`, and the four
-- `kind <> 'promo'` column references are qualified as
-- work.import_record.kind. Nothing else changes: the signature is unchanged,
-- so the grants and the generated types are untouched. Forward-only: the
-- original 20261104130000 migration is applied, never edited.
-- Verified by parsing this migration and diffing the function body against
-- the original (renames and qualifications only, no behaviour change).

create or replace function work.import_apply(p_batch uuid, p_rows jsonb, p_held jsonb default '[]'::jsonb,
  p_decisions jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := authz.require('finance', 'full');
  batch work.import_batch;
  r jsonb;
  held_row jsonb;
  row_no int;
  row_kind text;
  txn text;
  inv text;
  old work.import_record;
  group_row work.import_record;
  group_count int;
  changed boolean;
  outcome text;
  counts_new int := 0;
  counts_updated int := 0;
  counts_unchanged int := 0;
  counts_excluded int := 0;
  counts_needs int := 0;
  apply_problems jsonb := '[]'::jsonb;
  merged_amount numeric(19, 2);
  merged_wallet numeric(19, 2);
  merged_cost numeric(19, 2);
  merged_tax text;
  merged_date date;
  merged_status text;
  merged_fully boolean;
  merged_prov boolean;
  merged_txn text;
  merged_inv text;
  merged_promo text;
  merged_product text;
  merged_gate text;
  merged_url text;
  merged_ref text;
  merged_kind text;
  merged_revenue numeric(19, 2);
  merged_profit numeric(19, 2);
  any_changed boolean;
begin
  if p_batch is null or p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  select * into batch from work.import_batch where id = p_batch and deleted_at is null;
  if batch.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if batch.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'batch_confirmed';
  end if;
  if batch.signature = 'promo_code_invoice_export' and batch.source_promo is null then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'source_promo_required';
  end if;

  for r in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    row_no := nullif((r ->> 'row_no'), '')::int;
    row_kind := r ->> 'kind';
    txn := nullif(pg_catalog.btrim(coalesce(r ->> 'transaction_ref', '')), '');
    inv := nullif(pg_catalog.btrim(coalesce(r ->> 'invoice_ref', '')), '');

    -- The normaliser holds key-less rows; one arriving here is a caller bug, not a row.
    if ((row_kind = 'invoice' or row_kind = 'promo') and inv is null)
      or ((row_kind = 'transaction' or row_kind = 'expense') and txn is null) then
      raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'missing_key';
    end if;

    -- A duplicate inside the file is skipped unless the person chose to keep it.
    if coalesce((r ->> 'duplicate')::boolean, false)
      and coalesce(p_decisions ->> coalesce(row_no::text, ''), 'skip') <> 'keep' then
      counts_unchanged := counts_unchanged + 1;
      continue;
    end if;

    if row_kind = 'invoice' then
      -- Its own invoice-only row first.
      select * into old from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and work.import_record.kind <> 'promo'
          and transaction_ref is null and invoice_ref = inv;
      if old.id is not null then
        merged_amount := coalesce((r ->> 'amount')::numeric, old.amount_sar);
        merged_wallet := coalesce((r ->> 'wallet_topup')::numeric, old.wallet_topup_sar);
        merged_tax := coalesce(nullif(r ->> 'tax_no', ''), old.tax_no);
        merged_date := coalesce((r ->> 'record_date')::date, old.record_date);
        merged_status := coalesce(nullif(r ->> 'status_text', ''), old.status_text);
        merged_fully := coalesce((r ->> 'fully_paid')::boolean, old.fully_paid);
        merged_prov := coalesce((r ->> 'provisional')::boolean, old.provisional);
        merged_revenue := case when merged_amount is null then null else merged_amount - merged_wallet end;
        merged_profit := case when merged_revenue is null or old.cost_sar is null then null
          else merged_revenue - old.cost_sar end;
        changed := old.amount_sar is distinct from merged_amount or old.wallet_topup_sar is distinct from merged_wallet
          or old.tax_no is distinct from merged_tax or old.record_date is distinct from merged_date
          or old.status_text is distinct from merged_status or old.fully_paid is distinct from merged_fully
          or old.provisional is distinct from merged_prov;
        update work.import_record set amount_sar = merged_amount, wallet_topup_sar = merged_wallet,
          tax_no = merged_tax, record_date = merged_date, status_text = merged_status, fully_paid = merged_fully,
          provisional = merged_prov, revenue_sar = merged_revenue, profit_sar = merged_profit,
          missing_transaction = true, missing_invoice = false, cost_pending = old.cost_sar is null,
          needs_linking = true, updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
        if not changed then counts_unchanged := counts_unchanged + 1;
        else counts_needs := counts_needs + 1; end if;
        continue;
      end if;
      -- Else transaction rows already carrying this invoice number (the group case):
      -- fill tax number and status, never overwrite their amounts.
      select pg_catalog.count(*) into group_count from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and transaction_ref is not null and invoice_ref = inv;
      if group_count > 0 then
        any_changed := false;
        for group_row in select * from work.import_record
          where partner_id = batch.partner_id and deleted_at is null and transaction_ref is not null and invoice_ref = inv loop
          merged_tax := coalesce(nullif(r ->> 'tax_no', ''), group_row.tax_no);
          merged_date := coalesce(group_row.record_date, (r ->> 'record_date')::date);
          merged_status := coalesce(nullif(r ->> 'status_text', ''), group_row.status_text);
          merged_fully := coalesce((r ->> 'fully_paid')::boolean, group_row.fully_paid);
          merged_prov := coalesce((r ->> 'provisional')::boolean, group_row.provisional);
          merged_amount := coalesce(group_row.amount_sar, (r ->> 'amount')::numeric);
          merged_wallet := case when group_count = 1 and group_row.wallet_topup_sar = 0
            then coalesce((r ->> 'wallet_topup')::numeric, 0) else group_row.wallet_topup_sar end;
          if group_row.amount_sar is not null and (r ->> 'amount')::numeric is not null
            and group_row.amount_sar <> (r ->> 'amount')::numeric then
            apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', row_no,
              'reason', 'Invoice total differs from the stored transaction amount: transaction amount kept, held for a person');
          end if;
          changed := group_row.tax_no is distinct from merged_tax or group_row.record_date is distinct from merged_date
            or group_row.status_text is distinct from merged_status or group_row.fully_paid is distinct from merged_fully
            or group_row.provisional is distinct from merged_prov or group_row.amount_sar is distinct from merged_amount
            or group_row.wallet_topup_sar is distinct from merged_wallet;
          if changed then any_changed := true; end if;
          merged_revenue := case when merged_amount is null then null else merged_amount - merged_wallet end;
          merged_profit := case when merged_revenue is null or group_row.cost_sar is null then null
            else merged_revenue - group_row.cost_sar end;
          update work.import_record set tax_no = merged_tax, record_date = merged_date, status_text = merged_status,
            fully_paid = merged_fully, provisional = merged_prov, amount_sar = merged_amount,
            wallet_topup_sar = merged_wallet, revenue_sar = merged_revenue, profit_sar = merged_profit,
            missing_transaction = false, missing_invoice = false, cost_pending = group_row.cost_sar is null,
            needs_linking = false, updated_at = now(), updated_by = me, version = version + 1 where id = group_row.id;
        end loop;
        if any_changed then counts_updated := counts_updated + 1; else counts_unchanged := counts_unchanged + 1; end if;
        continue;
      end if;
      -- Else a brand-new invoice-only row, flagged until its transaction arrives.
      merged_amount := (r ->> 'amount')::numeric;
      merged_wallet := coalesce((r ->> 'wallet_topup')::numeric, 0);
      merged_revenue := case when merged_amount is null then null else merged_amount - merged_wallet end;
      insert into work.import_record (partner_id, batch_id, kind, invoice_ref, tax_no, record_date, amount_sar,
        wallet_topup_sar, status_text, fully_paid, audit_required, provisional, direct_url, direct_ref,
        revenue_sar, profit_sar, missing_transaction, missing_invoice, cost_pending, needs_linking, created_by)
        values (batch.partner_id, batch.id, 'invoice', inv, nullif(r ->> 'tax_no', ''),
          (r ->> 'record_date')::date, merged_amount, merged_wallet, nullif(r ->> 'status_text', ''),
          coalesce((r ->> 'fully_paid')::boolean, false), coalesce((r ->> 'audit_required')::boolean, false),
          coalesce((r ->> 'provisional')::boolean, false), nullif(r ->> 'direct_url', ''),
          nullif(r ->> 'direct_ref', ''), merged_revenue, null, true, false, true, true, me);
      counts_needs := counts_needs + 1;
      continue;
    end if;

    if row_kind = 'transaction' then
      select * into old from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and transaction_ref = txn;
      if old.id is null and inv is not null then
        -- Progressive fill: an invoice-only row waiting for this transaction.
        select * into old from work.import_record
          where partner_id = batch.partner_id and deleted_at is null and work.import_record.kind <> 'promo'
            and transaction_ref is null and invoice_ref = inv;
        if old.id is not null then
          merged_amount := coalesce((r ->> 'amount')::numeric, old.amount_sar);
          merged_wallet := old.wallet_topup_sar;
          merged_date := coalesce((r ->> 'record_date')::date, old.record_date);
          merged_product := coalesce(nullif(r ->> 'product', ''), old.product);
          merged_gate := coalesce(nullif(r ->> 'expense_gate', ''), old.expense_gate);
          merged_revenue := case when merged_amount is null then null else merged_amount - merged_wallet end;
          merged_profit := case when merged_revenue is null or old.cost_sar is null then null
            else merged_revenue - old.cost_sar end;
          update work.import_record set kind = 'transaction', transaction_ref = txn, amount_sar = merged_amount,
            record_date = merged_date, product = merged_product, expense_gate = merged_gate,
            direct_url = coalesce(nullif(r ->> 'direct_url', ''), old.direct_url),
            direct_ref = coalesce(nullif(r ->> 'direct_ref', ''), old.direct_ref),
            revenue_sar = merged_revenue, profit_sar = merged_profit, missing_transaction = false,
            missing_invoice = false, cost_pending = old.cost_sar is null, needs_linking = false,
            updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
          counts_updated := counts_updated + 1;
          continue;
        end if;
      end if;
      if old.id is not null then
        merged_amount := coalesce((r ->> 'amount')::numeric, old.amount_sar);
        merged_inv := coalesce(inv, old.invoice_ref);
        merged_date := coalesce((r ->> 'record_date')::date, old.record_date);
        merged_product := coalesce(nullif(r ->> 'product', ''), old.product);
        merged_gate := coalesce(nullif(r ->> 'expense_gate', ''), old.expense_gate);
        merged_revenue := case when merged_amount is null then null else merged_amount - old.wallet_topup_sar end;
        merged_profit := case when merged_revenue is null or old.cost_sar is null then null
          else merged_revenue - old.cost_sar end;
        changed := old.amount_sar is distinct from merged_amount or old.invoice_ref is distinct from merged_inv
          or old.record_date is distinct from merged_date or old.product is distinct from merged_product
          or old.expense_gate is distinct from merged_gate;
        -- Filling an invoice number that an invoice-only row already holds is a clash:
        -- both rows stay, flagged, and nobody merges by guess.
        if old.invoice_ref is null and merged_inv is not null and exists (select 1 from work.import_record
          where partner_id = batch.partner_id and deleted_at is null and work.import_record.kind <> 'promo' and id <> old.id
            and transaction_ref is null and invoice_ref = merged_inv) then
          apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', row_no,
            'reason', 'Invoice number is already on another row: held for a person, nothing merged by guess');
        end if;
        update work.import_record set kind = 'transaction', amount_sar = merged_amount, invoice_ref = merged_inv,
          record_date = merged_date, product = merged_product, expense_gate = merged_gate,
          revenue_sar = merged_revenue, profit_sar = merged_profit, missing_transaction = false,
          missing_invoice = merged_inv is null, cost_pending = old.cost_sar is null,
          needs_linking = merged_inv is null, updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
        if not changed then counts_unchanged := counts_unchanged + 1;
        elsif merged_inv is null then counts_needs := counts_needs + 1;
        else counts_updated := counts_updated + 1; end if;
        continue;
      end if;
      merged_amount := (r ->> 'amount')::numeric;
      merged_revenue := merged_amount; -- wallet part is 0 on a list row
      insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date,
        amount_sar, wallet_topup_sar, product, expense_gate, direct_url, direct_ref, revenue_sar, profit_sar,
        missing_transaction, missing_invoice, cost_pending, needs_linking, created_by)
        values (batch.partner_id, batch.id, 'transaction', txn, inv, (r ->> 'record_date')::date,
          merged_amount, 0, nullif(r ->> 'product', ''), nullif(r ->> 'expense_gate', ''),
          nullif(r ->> 'direct_url', ''), nullif(r ->> 'direct_ref', ''), merged_revenue, null,
          false, inv is null, true, inv is null, me);
      if inv is null then counts_needs := counts_needs + 1; else counts_new := counts_new + 1; end if;
      continue;
    end if;

    if row_kind = 'expense' then
      select * into old from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and transaction_ref = txn;
      if old.id is not null then
        merged_cost := (r ->> 'cost')::numeric;
        changed := old.cost_sar is distinct from merged_cost;
        merged_revenue := old.revenue_sar;
        merged_profit := case when merged_revenue is null or merged_cost is null then null
          else merged_revenue - merged_cost end;
        update work.import_record set cost_sar = merged_cost, profit_sar = merged_profit,
          cost_pending = merged_cost is null, updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
        if not changed then counts_unchanged := counts_unchanged + 1;
        elsif old.invoice_ref is null then counts_needs := counts_needs + 1;
        else counts_updated := counts_updated + 1; end if;
        continue;
      end if;
      insert into work.import_record (partner_id, batch_id, kind, transaction_ref, record_date, cost_sar,
        direct_ref, missing_transaction, missing_invoice, cost_pending, needs_linking, created_by)
        values (batch.partner_id, batch.id, 'expense', txn, (r ->> 'record_date')::date, (r ->> 'cost')::numeric,
          txn, false, true, false, true, me);
      counts_needs := counts_needs + 1;
      continue;
    end if;

    if row_kind = 'promo' then
      -- Invoice-only row first, else one single transaction row. Several transaction
      -- rows sharing the invoice number own no single code link: a holding, plus a clash.
      select * into old from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and work.import_record.kind <> 'promo'
          and transaction_ref is null and invoice_ref = inv;
      if old.id is null then
        select pg_catalog.count(*) into group_count from work.import_record
          where partner_id = batch.partner_id and deleted_at is null and transaction_ref is not null and invoice_ref = inv;
        if group_count = 1 then
          select * into old from work.import_record
            where partner_id = batch.partner_id and deleted_at is null and transaction_ref is not null and invoice_ref = inv;
        elsif group_count > 1 then
          apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', row_no,
            'reason', 'Invoice number covers several transactions, so no single row owns this code link: held for a person');
        end if;
      end if;
      if old.id is not null then
        if old.source_promo is not null and old.source_promo <> batch.source_promo then
          apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', row_no,
            'reason', 'Already linked to another discount code, kept as it was');
          counts_unchanged := counts_unchanged + 1;
          continue;
        end if;
        changed := old.source_promo is distinct from batch.source_promo
          or old.attribution_promo is distinct from true;
        update work.import_record set source_promo = batch.source_promo, attribution_promo = true,
          promo_before_sar = coalesce(old.promo_before_sar, (r ->> 'promo_before')::numeric),
          promo_discount_sar = coalesce(old.promo_discount_sar, (r ->> 'promo_discount')::numeric),
          promo_after_sar = coalesce(old.promo_after_sar, (r ->> 'promo_after')::numeric),
          updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
        if changed then counts_updated := counts_updated + 1; else counts_unchanged := counts_unchanged + 1; end if;
        continue;
      end if;
      insert into work.import_record (partner_id, batch_id, kind, invoice_ref, source_promo, attribution_promo,
        promo_before_sar, promo_discount_sar, promo_after_sar, product, status_text, fully_paid, audit_required,
        direct_url, direct_ref, missing_transaction, missing_invoice, cost_pending, needs_linking, created_by)
        values (batch.partner_id, batch.id, 'promo', inv, batch.source_promo, true,
          (r ->> 'promo_before')::numeric, (r ->> 'promo_discount')::numeric, (r ->> 'promo_after')::numeric,
          nullif(r ->> 'product', ''), nullif(r ->> 'status_text', ''),
          coalesce((r ->> 'fully_paid')::boolean, false), coalesce((r ->> 'audit_required')::boolean, false),
          nullif(r ->> 'direct_url', ''), nullif(r ->> 'direct_ref', ''), true, false, true, true, me);
      counts_needs := counts_needs + 1;
      continue;
    end if;

    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'kind';
  end loop;

  for held_row in select value from pg_catalog.jsonb_array_elements(coalesce(p_held, '[]'::jsonb)) loop
    counts_excluded := counts_excluded + 1;
    apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', (held_row ->> 'row_no')::int,
      'reason', held_row ->> 'reason');
  end loop;

  update work.import_batch set status = 'confirmed',
    counts = pg_catalog.jsonb_build_object('new', counts_new, 'updated', counts_updated,
      'unchanged', counts_unchanged, 'excluded', counts_excluded, 'needs_linking', counts_needs),
    problems = apply_problems, updated_at = now(), updated_by = me, version = version + 1 where id = batch.id;
  return pg_catalog.jsonb_build_object('batch_id', batch.id,
    'counts', pg_catalog.jsonb_build_object('new', counts_new, 'updated', counts_updated,
      'unchanged', counts_unchanged, 'excluded', counts_excluded, 'needs_linking', counts_needs),
    'problems', apply_problems);
end
$$;
