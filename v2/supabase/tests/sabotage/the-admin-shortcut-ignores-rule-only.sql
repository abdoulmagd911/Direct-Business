-- Sabotage: the-admin-shortcut-ignores-rule-only
-- Breaks: sql:NOTE-02
-- Expect: nor read its history
-- A record type's own rule is asked after the admin shortcut again, so a rule-only type is open to admins (V183).
create or replace function authz.can_see_as(p_person uuid, p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  ok boolean;
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.id is null or p_person is null then
    return false;
  end if;
  if exists (select 1 from core.person p join core.role r on r.id = p.role_id
             where p.id = p_person and r.is_admin and p.active and p.can_sign_in and p.deleted_at is null) then
    return true;
  end if;
  if e.visible is not null then
    execute pg_catalog.format('select %s($1, $2)', pg_catalog.to_regprocedure(e.visible || '(uuid, uuid)')::regproc)
      into ok using p_id, p_person;
    if coalesce(ok, false) then
      return true;
    end if;
  end if;
  if p_person = any (core.owners_of(p_table, p_id)) then
    return true;
  end if;
  return not e.private and (e.page_key is not null or e.level is not null)
         and e.page_key is distinct from 'settings.profile'
         and authz.record_level(p_person, p_table, p_id) >= 'view';
end
$$;
