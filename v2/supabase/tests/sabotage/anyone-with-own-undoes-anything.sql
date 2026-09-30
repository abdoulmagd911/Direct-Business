-- Sabotage: anyone-with-own-undoes-anything
-- Breaks: sql:UNDO-05
-- Expect: with Own, someone who neither made the change nor owns the record cannot undo it
-- Own on a page undoes anyones change to any record there, owner or not.
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
  -- My profile (V9, V97): a change you made to your own names or your own profile is yours to undo within the window,
  -- whatever your level on the people pages — exactly what api.profile_update let you change.
  if q.actor_id = me and q.at > core.clock() - pg_catalog.make_interval(hours => window_h)
     and not exists (
       select 1 from audit.change c
       where c.request_id = q.id
         and not ((c.table_name = 'core.person' and c.row_id = me
                   and c.fields <@ array['full_name_en', 'full_name_ar', 'nickname_en', 'nickname_ar'])
                  or (c.table_name = 'core.person_profile'
                      and exists (select 1 from core.person_profile pp where pp.id = c.row_id and pp.person_id = me)))) then
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
           or false));
end
$$;
