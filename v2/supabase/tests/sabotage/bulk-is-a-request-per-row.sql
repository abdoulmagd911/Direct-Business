-- Sabotage: bulk-is-a-request-per-row
-- Breaks: sql:BULK-01
-- Expect: removing three views at once is one request
-- A bulk removal logs one request per row: one Undo brings back only the last.
create or replace function core.views_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  req uuid;
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if exists (select 1 from pg_catalog.unnest(p_ids) i(id)
             where not exists (select 1 from core.saved_view v where v.id = i.id and v.deleted_at is null)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not authz.is_admin() and exists (select 1 from core.saved_view v where v.id = any (p_ids) and v.owner_id <> me) then
    raise exception using errcode = '42501', message = 'view.not_yours';
  end if;
  n := 0;
  for req in select pg_catalog.unnest(p_ids) loop
    perform audit.begin('ui', 'view.removed', pg_catalog.jsonb_build_object('count', 1), p_reason);
    update core.saved_view set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason where id = req;
    n := n + 1;
    req := audit.end();
  end loop;
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$$;
