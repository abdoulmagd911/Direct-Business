-- NOTE-06 — a reminder fires once, at its time (V455; TECH-SPEC §3.3a): the five-minute job sends each reminder due by
-- now and not yet sent — one due at 10:03 goes with the 10:05 run, not the 10:00 one, and never again; a run missed is
-- caught up once by the next. A reminder is its person's alone, admins included; a removed one is never sent. The job
-- is scheduled every five minutes where pg_cron exists. (A daily alert missed by a paused job fires once on the next
-- run: ALR-02.) Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-reminder-sent-twice.sql, a-reminder-sent-early.sql.
select set_config('v2.test_now', '2026-10-05 09:50:00+03', true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up ring the supplier')) ->> 'id', true);
select set_config('t.r', api.note_turn_into(current_setting('t.n')::uuid, 'reminder',
  jsonb_build_object('remind_at', '2026-10-05 10:03:00+03', 'text', 'Made-up: ring them now')) ->> 'id', true);
select set_config('t.gone', api.note_turn_into(current_setting('t.n')::uuid, 'reminder',
  jsonb_build_object('remind_at', '2026-10-05 10:01:00+03')) ->> 'id', true);
select test.runs(format('select api.reminders_remove(array[%L]::uuid[])', current_setting('t.gone')), 'one is removed');
select test.eq(api.my_day('me') -> 'reminders' -> 0 ->> 'id', current_setting('t.r'), 'the reminder waits on My day');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.record_history(%L, %L)', 'reminder', current_setting('t.r')), '42501',
  'a reminder is its person''s alone, admins included', 'access.needs_level');

select test.as_owner();
select set_config('v2.test_now', '2026-10-05 10:00:00+03', true);
select test.eq(notify.send_reminders(), 0, 'the 10:00 run sends nothing');
select set_config('v2.test_now', '2026-10-05 10:05:00+03', true);
select test.eq(notify.send_reminders(), 1, 'the 10:05 run sends the 10:03 reminder');
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.am1')::uuid and kind = 'reminder'
                  and entity_id = current_setting('t.r')::uuid), 1, 'to its person, once');
select test.eq((select label_args ->> 'text' from notify.notification
                where kind = 'reminder' and entity_id = current_setting('t.r')::uuid), 'Made-up: ring them now',
  'saying what to do');
select test.eq((select count(*)::int from notify.notification where entity_id = current_setting('t.gone')::uuid), 0,
  'the removed one is never sent');
select set_config('v2.test_now', '2026-10-05 10:10:00+03', true);
select test.eq(notify.send_reminders(), 0, 'the 10:10 run sends nothing');
select set_config('v2.test_now', '2026-10-06 10:10:00+03', true);
select notify.send_reminders();
select test.eq((select count(*)::int from notify.notification where kind = 'reminder'
                and entity_id = current_setting('t.r')::uuid), 1, 'and never again');

-- a run missed: the next one catches up, once
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.late', api.note_turn_into(current_setting('t.n')::uuid, 'reminder',
  jsonb_build_object('remind_at', '2026-10-06 11:00:00+03')) ->> 'id', true);
select test.as_owner();
select set_config('v2.test_now', '2026-10-06 12:40:00+03', true);
select test.eq(notify.send_reminders(), 1, 'the first run after a pause sends what it missed');
select test.eq(notify.send_reminders(), 0, 'once');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(jsonb_array_length(api.my_day('me') -> 'reminders'), 0, 'a sent reminder leaves My day');

select test.as_owner();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform test.eq((select schedule from cron.job where jobname = 'notify-send-reminders'), '*/5 * * * *',
      'pg_cron runs the reminder job every five minutes');
    perform test.eq((select command from cron.job where jobname = 'notify-send-reminders'),
      'select notify.send_reminders()', 'and the job is the reminder job');
  end if;
end $$;
