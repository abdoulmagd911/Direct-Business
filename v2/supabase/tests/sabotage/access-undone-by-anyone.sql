-- Sabotage: access-undone-by-anyone
-- Breaks: sql:UNDO-05
-- Expect: cannot undo a change of someone's access
-- Undo forgets that a change of access is an admin's to undo: a head re-grants what the three rules refuse.
create or replace function audit.undo_allowed(q audit.request, me uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  window_h int := coalesce((core.setting_at('audit.undo_window_hours', null, core.riyadh_today()) #>> '{}')::int, 24);
begin
  if authz.is_admin() then
    return true;
  end if;
  if exists (select 1 from audit.change c where c.request_id = q.id and not authz.can_see_as(me, c.table_name, c.row_id)) then
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
