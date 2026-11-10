-- Landing 6, CI #1576 triage (org:14): core.person_open_work answers the departments a person heads with a bare
-- jsonb_agg, which is NULL when there are none — and PersonRecord.tsx reads openWork.heads.length, so switching
-- off a person who heads no department (the common case) throws and the error boundary takes the page. Coalesce
-- the aggregation to an empty array. The body is otherwise the version landed in 20261007082000_core_leaving.sql
-- (no later migration redefined person_open_work — audited 10 Nov 2026); this one change only.
-- Forward-only: nothing already on v2/main is edited here.

-- What a person holds, for the Leave and Switch off dialogs: Organization & access · View.
create or replace function core.person_open_work(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('settings.org', 'view');
  if not exists (select 1 from core.person p where p.id = p_id and p.kind = 'staff' and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return core.open_work(p_id) || pg_catalog.jsonb_build_object(
    'heads', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', x.id, 'name_en', x.name_en,
                                                                        'name_ar', x.name_ar) order by x.name_en)
              from core.department x where x.head_person_id = p_id and x.deleted_at is null and x.active), '[]'::jsonb));
end
$$;
