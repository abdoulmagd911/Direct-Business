-- Sabotage: a-head-changes-an-admin
-- Breaks: sql:PPL-01
-- Expect: a head cannot change an admin's record
-- The people door forgets that only an admin changes an admin's record.
create or replace function core.person_guard_write(p_person uuid) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
begin
  if not exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff' and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return me;
end
$$;
