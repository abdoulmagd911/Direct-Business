-- Sabotage: an-idea-is-listed-as-a-plain-note
-- Breaks: sql:NOTE-11
-- Expect: an idea says idea
-- An idea is read back as a plain note, as it was before 17 Oct: nothing on My notes says what it is, and the Idea kind
-- finds nothing.
create or replace function my.capture_kind(n my.note) returns text
language sql stable security definer set search_path = ''
as $$
  select case
           when n.kind in ('meeting', 'checklist') then n.kind
           when false then 'idea'
           when exists (select 1 from core.reminder r
                        where r.note_id = n.id and r.deleted_at is null
                          and not exists (select 1 from my.note_link l
                                          where l.entity_table = 'core.reminder' and l.entity_id = r.id)) then 'reminder'
           else 'note' end
$$;
