-- Sabotage: a-told-reminder-keeps-its-note-hidden
-- Breaks: sql:FUP-03
-- Expect: its note is among My notes again once told
-- A note captured as a Reminder stays out of My notes after its reminder is told, so it shows nowhere on My day.
create or replace function my.captured_as_reminder(p_note uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.reminder r
                 where r.note_id = p_note and r.deleted_at is null
                   and not exists (select 1 from my.note_link l
                                   where l.entity_table = 'core.reminder' and l.entity_id = r.id))
$$;
