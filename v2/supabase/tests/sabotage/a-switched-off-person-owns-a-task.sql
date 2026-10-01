-- Sabotage: a-switched-off-person-owns-a-task
-- Breaks: sql:TSK-01
-- Expect: a switched-off person owns nothing
-- Anyone is named, switched off or not.
create or replace function work.person_ok(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select true and core.is_team_member(p_person) $$;
