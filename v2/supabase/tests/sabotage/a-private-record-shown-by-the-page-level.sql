-- Sabotage: a-private-record-shown-by-the-page-level
-- Breaks: sql:VIS-01
-- Expect: a head with Full on the page does not see a private record
-- The world before V96's visibility rule: a record type's own rule and its privacy are ignored, and View (or more) on
-- its page shows every record — an appraisal would be open to anyone with a level on its page.
create or replace function authz.can_see_as(p_person uuid, p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.id is null or p_person is null then
    return false;
  end if;
  if p_person = any (core.owners_of(p_table, p_id)) then
    return true;
  end if;
  return e.page_key is not null and e.page_key <> 'settings.profile' and authz.level_of(p_person, e.page_key) >= 'view';
end
$$;
