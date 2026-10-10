-- Sabotage: the-as-of-day-is-the-newest-file
-- Breaks: sql:FAS-01
-- Expect: each file its Riyadh day; the stamp is the oldest of them
-- The "Payments · as of" stamp takes the newest file's day, so figures built on an older file look fresh (V500).
create or replace function finance.payments_as_of() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  files jsonb;
begin
  perform authz.require('finance', 'view');
  select coalesce(pg_catalog.jsonb_object_agg(b.file, b.day), '{}'::jsonb) into files
  from (select x.file, (pg_catalog.max(x.export_time) at time zone 'Asia/Riyadh')::date as day
        from finance.import_batch x group by x.file) b;
  return pg_catalog.jsonb_build_object(
    'as_of', (select pg_catalog.max(v.value::text::date) from pg_catalog.jsonb_each(files) v),
    'files', files);
end
$$;
