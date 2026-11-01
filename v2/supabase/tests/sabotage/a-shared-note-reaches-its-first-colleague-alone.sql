-- Sabotage: a-shared-note-reaches-its-first-colleague-alone
-- Breaks: sql:NOTE-14
-- Expect: the second colleague reads it too
-- V524 undone: only the first colleague on a note's list may read it.
create or replace function my.note_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select n.person_id = p_person
        or (n.visibility in ('team', 'workspace') and n.deleted_at is null
            and exists (select 1 from core.person p
                        where p.id = p_person and p.kind = 'staff' and p.active and p.deleted_at is null)
            and (n.visibility = 'workspace'
                 or my.team_sees(n.person_id, p_person)
                 or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                            where p.id = p_person and r.is_admin)))
        or (n.visibility = 'person' and n.shared_with[1] = p_person and n.deleted_at is null
            and exists (select 1 from core.person p
                        where p.id = p_person and p.kind = 'staff' and p.active and p.deleted_at is null))
    from my.note n where n.id = p_id), false)
$$;
