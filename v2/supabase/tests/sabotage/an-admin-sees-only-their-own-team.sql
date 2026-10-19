-- Sabotage: an-admin-sees-only-their-own-team
-- Breaks: sql:NOTE-12
-- Expect: an admin sees the team notes of every team, their own among them
-- My team reads an admin like a member: only the team they belong to (the rule before V642).
create or replace function my.in_scope(n my.note, p_scope text, p_reader uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select n.deleted_at is null and n.done_at is null and coalesce(n.carried_to, n.happened_on) <= core.riyadh_today()
    and case p_scope
          when 'me' then n.person_id = p_reader
          when 'team' then n.person_id <> p_reader and n.visibility = 'team' and my.team_sees(n.person_id, p_reader)
          else n.person_id <> p_reader and n.visibility = 'workspace' end
    and my.note_visible(n.id, p_reader)
$$;
