-- Sabotage: undo-ignores-who-may-see
-- Breaks: sql:VIS-01
-- Expect: a head with Full on the page cannot undo a change to a private record they cannot see
-- Undo forgets to ask whether the person may see what the request touched (V143).
create or replace function audit.undo_allowed(q audit.request, me uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  window_h int := coalesce((core.setting_at('audit.undo_window_hours', null, core.riyadh_today()) #>> '{}')::int, 24);
begin
  if authz.is_admin() then
    return true;
  end if;
  if audit.touches_access(q.id) then
    return false;
  end if;
  if not exists (select 1 from audit.change c
                 left join core.entity e on e.table_name = c.table_name and e.active
                 where c.request_id = q.id
                   and (e.id is null or authz.record_level(me, c.table_name, c.row_id) < 'full')) then
    return true;
  end if;
  if q.at <= core.clock() - pg_catalog.make_interval(hours => window_h) then
    return false;
  end if;
  return not exists (
    select 1 from audit.change c
    left join core.entity e on e.table_name = c.table_name and e.active
    where c.request_id = q.id
      and (e.id is null
           or not ((e.page_key is null and e.level is null) or authz.record_level(me, c.table_name, c.row_id) >= 'own')
           or (q.actor_id is distinct from me and not (me = any (core.owners_of(c.table_name, c.row_id))))));
end
$$;
