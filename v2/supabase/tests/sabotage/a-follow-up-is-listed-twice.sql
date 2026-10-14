-- Sabotage: a-follow-up-is-listed-twice
-- Breaks: sql:FUP-02
-- Expect: the follow-up is not listed again among My notes
-- A note captured as a Reminder is listed among My notes as well as under Reminders, so one follow-up looks like two.
create or replace function my.captured_as_reminder(p_note uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select false $$;
