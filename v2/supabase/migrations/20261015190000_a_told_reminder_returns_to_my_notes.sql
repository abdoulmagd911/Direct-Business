-- A note captured as a Reminder comes back among My notes once its reminder has been told (the Architect's ruling of
-- 15 Oct, after QA-568): it is left out of My notes only while its reminder is still to come, because until then My day
-- lists it under Reminders. Once told it leaves Reminders, so without this it would show nowhere on My day. A note
-- turned into a reminder later (Turn into → Reminder) stays among My notes throughout, as before.
create or replace function my.captured_as_reminder(p_note uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.reminder r
                 where r.note_id = p_note and r.deleted_at is null and r.sent_at is null
                   and not exists (select 1 from my.note_link l
                                   where l.entity_table = 'core.reminder' and l.entity_id = r.id))
$$;
comment on function my.captured_as_reminder(uuid) is
  'Whether a note captured as a Reminder is left out of My notes: only while its reminder is still to come, when it is '
  'listed as its reminder. Once told it is among My notes again. A note turned into a reminder later is never left out (QA-568).';
