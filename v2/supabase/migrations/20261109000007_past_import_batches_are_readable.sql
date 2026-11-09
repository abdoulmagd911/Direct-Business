-- F177: past imports are re-viewable. The store already exists — work.import_batch carries the outcome snapshot
-- the apply step wrote (counts, held rows with their reasons) and work.import_record is keyed by batch_id — but
-- no read of it existed anywhere, so a confirmed import's outcome could never be seen again. Two reads, gated the
-- same as import_ledger (finance view):
--   work.import_batches(p_partner): one row per batch, newest first, with the five counts (a draft batch, whose
--     counts are still the empty default, answers five zeros), the held rows, who confirmed it, and the stored
--     source file when one was attached (the file link the confirm step wrote: entity work.import_batch).
--   work.import_batch_rows(p_batch): the batch's records in import_ledger's record shape, as they stand now.
-- Two limits, recorded here and in the build note: a held row survives only as its row number and reason — the raw
-- row values were never stored, so a re-viewed held row shows its reason, not its values; and a record a later
-- import updated still points at its first batch, so the rows are approximate after later imports — the counts
-- snapshot on the batch is the reliable per-batch totals record. Forward-only; no table changes except the
-- creation-order sequence below.
-- Newest first must be deterministic: created_at is the transaction's start, so two batches confirmed in one
-- transaction share it. The seq column is the tie-break (the same shape as core.file.seq for the F150 flip):
-- existing rows take their sequence when the column is added, in unspecified order, but their created_at values
-- differ, so the sequence only ever breaks an exact tie.

alter table work.import_batch add column seq bigint generated always as identity;

create function work.import_batches(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'view');
begin
  if p_partner is null or not exists (select 1 from partner.partner where id = p_partner and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return coalesce((select pg_catalog.jsonb_agg(x.obj order by x.created_at desc, x.seq desc) from (
    select pg_catalog.jsonb_build_object(
      'id', b.id, 'file_name', b.file_name, 'signature', b.signature, 'source_promo', b.source_promo,
      'status', b.status,
      'counts', pg_catalog.jsonb_build_object('new', coalesce((b.counts ->> 'new')::int, 0),
        'updated', coalesce((b.counts ->> 'updated')::int, 0),
        'unchanged', coalesce((b.counts ->> 'unchanged')::int, 0),
        'excluded', coalesce((b.counts ->> 'excluded')::int, 0),
        'needs_linking', coalesce((b.counts ->> 'needs_linking')::int, 0)),
      'problems', b.problems,
      'created_at', b.created_at, 'created_by_name', core.file_person_name(b.created_by),
      'source_file_id', f.id, 'source_file_name', f.original_name) as obj,
      b.created_at as created_at, b.seq as seq
    from work.import_batch b
    left join lateral (
      select fl.file_id from core.file_link fl
      where fl.entity_table = 'work.import_batch' and fl.entity_id = b.id and fl.deleted_at is null
      order by fl.created_at desc limit 1
    ) l on true
    left join core.file f on f.id = l.file_id and f.deleted_at is null
    where b.partner_id = p_partner and b.deleted_at is null
  ) x), '[]'::jsonb);
end
$$;

create function work.import_batch_rows(p_batch uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'view');
  batch work.import_batch;
begin
  select * into batch from work.import_batch where id = p_batch and deleted_at is null;
  if batch.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id, 'kind', kind, 'transaction_ref', transaction_ref, 'invoice_ref', invoice_ref,
      'tax_no', tax_no, 'record_date', record_date, 'amount_sar', amount_sar,
      'wallet_topup_sar', wallet_topup_sar, 'cost_sar', cost_sar, 'revenue_sar', revenue_sar,
      'profit_sar', profit_sar, 'promo_before_sar', promo_before_sar,
      'promo_discount_sar', promo_discount_sar, 'promo_after_sar', promo_after_sar,
      'product', product, 'status_text', status_text, 'fully_paid', fully_paid,
      'audit_required', audit_required, 'provisional', provisional, 'expense_gate', expense_gate,
      'source_promo', source_promo, 'attribution_promo', attribution_promo,
      'missing_transaction', missing_transaction, 'missing_invoice', missing_invoice,
      'cost_pending', cost_pending, 'needs_linking', needs_linking,
      'direct_url', direct_url, 'direct_ref', direct_ref)
    order by record_date nulls last, id)
    from work.import_record where batch_id = p_batch and deleted_at is null), '[]'::jsonb);
end
$$;

create function api.import_batches(p_partner uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.import_batches(p_partner) $$;
create function api.import_batch_rows(p_batch uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.import_batch_rows(p_batch) $$;

revoke all on function work.import_batches(uuid) from public;
revoke all on function work.import_batch_rows(uuid) from public;
grant execute on function work.import_batches(uuid) to authenticated;
grant execute on function work.import_batch_rows(uuid) to authenticated;
grant execute on function api.import_batches(uuid) to authenticated;
grant execute on function api.import_batch_rows(uuid) to authenticated;
