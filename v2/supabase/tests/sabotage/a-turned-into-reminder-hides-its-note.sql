-- Sabotage: a-turned-into-reminder-hides-its-note
-- Breaks: sql:FUP-03
-- Expect: stay among My notes
-- Any note that carries a reminder is left out of My notes, so Turn into → Reminder makes a meeting or checklist vanish.
create or replace function my.captured_as_reminder(p_note uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from core.reminder r where r.note_id = p_note and r.deleted_at is null) $$;
