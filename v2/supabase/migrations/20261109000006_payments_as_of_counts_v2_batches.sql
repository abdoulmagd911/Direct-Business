-- F173: the "Payments · as of" stamp must also count the v2 import engine's batches, or it stays null forever
-- for every company imported through the v2 engine (the old store, finance.import_batch, is never written by it).
-- A draft batch has read nothing into the figures, so only confirmed batches count, at their confirm day
-- (updated_at — a confirmed batch is never touched again, so that is the confirm moment). The old store's
-- per-file day is unchanged, and the key is the batch signature, which cannot collide with the old store's
-- export-kind keys. Forward-only: the 20261011080730 definition is not edited; this file replaces it whole.
-- Follows the same shape as the original (the late-change view and closed_months below it are untouched).

create or replace function finance.payments_as_of() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  files jsonb;
begin
  perform authz.require('finance', 'view');
  select coalesce(pg_catalog.jsonb_object_agg(b.file, b.day), '{}'::jsonb) into files
  from (
    select x.file, (pg_catalog.max(x.export_time) at time zone 'Asia/Riyadh')::date as day
    from finance.import_batch x group by x.file
    union all
    select b.signature, (pg_catalog.max(coalesce(b.updated_at, b.created_at)) at time zone 'Asia/Riyadh')::date
    from work.import_batch b where b.status = 'confirmed' and b.deleted_at is null group by b.signature
  ) b;
  return pg_catalog.jsonb_build_object(
    'as_of', (select pg_catalog.min(v.value::text::date) from pg_catalog.jsonb_each(files) v),
    'files', files);
end
$$;
comment on function finance.payments_as_of() is 'Brief I.4 (V500): the day each Payments export was last read, and the "as of" stamp — the oldest of them. The v2 engine counts too (F173): a confirmed work.import_batch contributes its signature and its confirm day.';
