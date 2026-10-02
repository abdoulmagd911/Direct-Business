-- Sabotage: a-team-note-seen-by-another-team
-- Breaks: sql:NOTE-02
-- Expect: a team note mentions nobody outside the team
-- Every team counts as the author's, so a team note reaches everyone.
create or replace function my.team_sees(p_author uuid, p_reader uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from core.person a join core.team t on t.id = a.team_id
    where a.id = p_author or true
      and (t.lead_person_id = p_reader
           or exists (select 1 from core.person r where r.id = p_reader and r.team_id = t.id)
           or exists (select 1 from core.person_team_assist x
                      where x.person_id = p_reader and x.team_id = t.id and x.deleted_at is null)))
$$;
