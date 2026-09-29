-- Sabotage: record-level-ignores-the-sides
-- Breaks: sql:SIDE-01
-- Expect: and reads that side's history
-- A record type's own level rule is ignored: every organisation record goes by the Clients page alone.
create or replace function authz.record_level(p_person uuid, p_table text, p_id uuid) returns core.level
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  lv core.level;
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.id is null or p_person is null then
    return 'none';
  end if;
  if e.page_key is null then
    return 'none';
  end if;
  return authz.level_of(p_person, e.page_key);
end
$$;
