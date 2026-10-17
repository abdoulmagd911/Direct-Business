-- Sabotage: recently-deleted-trusts-the-owners-shortcut
-- Breaks: sql:DEL-03
-- Expect: nor does it read the removed task's title
-- A removed record is listed to anyone authz.can_see_as lets through, its owners shortcut included (before QA-576).
create or replace function core.deleted_visible(p_table text, p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select authz.can_see_as(p_person, p_table, p_id) $$;
