-- Sabotage: a-definer-function-that-writes-for-anyone
-- Breaks: sql:SEC-02
-- Expect: core.rename_anyone(p_person uuid, p_name text) — a nobody changed something
-- A security-definer function renames a person for whoever calls it, asking nobody.
create function core.rename_anyone(p_person uuid, p_name text) returns void
language sql security definer set search_path = ''
as $$
  update core.person set nickname_en = coalesce(p_name, 'Renamed By Anyone')
  where id = coalesce(p_person, (select p.id from core.person p where p.kind = 'staff' order by p.created_at limit 1))
$$;
grant execute on function core.rename_anyone(uuid, text) to authenticated;
