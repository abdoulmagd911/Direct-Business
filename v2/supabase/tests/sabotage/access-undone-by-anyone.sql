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
  if not exists (select 1 from (select distinct c.table_name from audit.change c where c.request_id = q.id) t
                 left join core.entity e on e.table_name = t.table_name and e.active
                 where e.page_key is null or authz.level_of(me, e.page_key) < 'full') then
    return true;
  end if;
  if q.at <= core.clock() - pg_catalog.make_interval(hours => window_h) then
    return false;
  end if;
  if q.actor_id = me then
    return true;
  end if;
  return not exists (select 1 from audit.change c
                     left join core.entity e on e.table_name = c.table_name and e.active
                     where c.request_id = q.id
                       and (not (me = any (core.owners_of(c.table_name, c.row_id)))
                            or e.page_key is null or authz.level_of(me, e.page_key) < 'own'));
end
$$;
