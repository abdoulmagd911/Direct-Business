-- Sabotage: people-change-their-own-access
-- Breaks: sql:ACC-04
-- Expect: an admin cannot change their own level
-- The access guard forgets that a person may not change their own access.
create or replace function core.access_guard(p_person uuid) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
begin
  if not exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff' and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not authz.is_admin() and exists (select 1 from core.person p join core.role r on r.id = p.role_id
                                      where p.id = p_person and r.is_admin) then
    raise exception using errcode = '42501', message = 'access.admins_only';
  end if;
  return me;
end
$$;
