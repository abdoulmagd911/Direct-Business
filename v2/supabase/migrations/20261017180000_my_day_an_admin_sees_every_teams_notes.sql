-- V642 (the Architect's ruling of 17 Oct): on My day, My team shows an admin the team notes of every team, not only
-- the notes of the team they belong to. One door changes, my.in_scope's team branch; no new table. A note reaches the
-- scope only through my.note_visible, unchanged, so a private note stays its author's alone, admins included (V454),
-- and a member still sees the team notes of their own team (home, helping or leading) and of no other.
-- my.in_scope is replaced whole, as 20260930172400 left it, but for the team branch. Forward-only (V103).

create or replace function my.in_scope(n my.note, p_scope text, p_reader uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select n.deleted_at is null and n.done_at is null and coalesce(n.carried_to, n.happened_on) <= core.riyadh_today()
    and case p_scope
          when 'me' then n.person_id = p_reader
          when 'team' then n.person_id <> p_reader and n.visibility = 'team'
                           and (my.team_sees(n.person_id, p_reader)
                                or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                                           where p.id = p_reader and r.is_admin))
          else n.person_id <> p_reader and n.visibility = 'workspace' end
    and my.note_visible(n.id, p_reader)
$$;
