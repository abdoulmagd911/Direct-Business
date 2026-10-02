-- Sabotage: an-admin-reads-a-private-note
-- Breaks: sql:NOTE-02
-- Expect: an admin cannot open a member's private note
-- An admin reads every note, private ones too: "admins see everything" without V454's exception.
create or replace function my.note_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select n.person_id = p_person
        or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                   where p.id = p_person and r.is_admin)
        or (n.visibility <> 'private' and n.deleted_at is null
            and exists (select 1 from core.person p
                        where p.id = p_person and p.kind = 'staff' and p.active and p.deleted_at is null)
            and (n.visibility = 'workspace'
                 or my.team_sees(n.person_id, p_person)
                 or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                            where p.id = p_person and r.is_admin)))
    from my.note n where n.id = p_id), false)
$$;
