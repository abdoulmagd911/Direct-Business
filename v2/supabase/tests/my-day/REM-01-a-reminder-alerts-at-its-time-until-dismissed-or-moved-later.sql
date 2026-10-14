-- REM-01 — a reminder alerts at its time (V632 Stage 2; D20): before its time api.reminders_due() lists nothing and
-- says when the next one falls; once the job has told it, it is due — with the alert to dismiss — until dismissed;
-- Later (api.reminder_move) sets it again for a time still to come, puts the alert away and is told again then; a time
-- gone by is refused; one Undo takes a move back; a snoozed alert waits for its time. The job runs every minute where
-- pg_cron exists. Every value is made up; the day is the one after the database is built (see NOTE-06).
-- Sabotages: supabase/tests/sabotage/a-dismissed-reminder-stays-due.sql, a-reminder-moved-later-is-never-told-again.sql.
select set_config('t.d1', (current_date + 1)::text, true);
select set_config('v2.test_now', current_setting('t.d1') || ' 09:50:00+03', true);
select set_config('t.am', test.person('Test Reminder Member', 'member')::text, true);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.n', api.note_capture('reminder', jsonb_build_object('title', 'Made-up ring the supplier',
  'remind_at', current_setting('t.d1') || 'T10:03:00+03:00')) ->> 'id', true);
select set_config('t.r', (api.my_day('me') -> 'reminders' -> 0 ->> 'id'), true);
select test.eq(api.reminders_due() -> 'due', '[]'::jsonb, 'before its time nothing is due');
select test.eq((api.reminders_due() ->> 'next_at')::timestamptz, (current_setting('t.d1') || ' 10:03:00+03')::timestamptz,
  'and the next one falls at 10:03 Riyadh time');

select test.as_owner();
select set_config('v2.test_now', current_setting('t.d1') || ' 10:03:30+03', true);
select test.eq(notify.send_reminders(), 1, 'the job tells it within the minute');
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.due', api.reminders_due()::text, true);
select test.eq(jsonb_array_length(current_setting('t.due')::jsonb -> 'due'), 1, 'now it is due');
select test.eq(current_setting('t.due')::jsonb -> 'due' -> 0 ->> 'text', 'Made-up ring the supplier', 'saying what to do');
select test.ok(current_setting('t.due')::jsonb -> 'due' -> 0 ->> 'notification_id' is not null, 'with the alert to dismiss');
select test.ok(current_setting('t.due')::jsonb -> 'next_at' = 'null'::jsonb, 'and none is still to come');

-- Later: set again for 11:00, the alert put away, told again then
select test.raises(format('select api.reminder_move(%L, %L)', current_setting('t.r'), current_setting('t.d1') || ' 10:00:00+03'),
  'P0001', 'a time gone by is refused', 'reminder.time_passed');
select set_config('t.req', api.reminder_move(current_setting('t.r')::uuid, (current_setting('t.d1') || ' 11:00:00+03')::timestamptz)
  ->> 'request_id', true);
select test.eq(api.reminders_due() -> 'due', '[]'::jsonb, 'Later puts the alert away');
select test.eq((api.reminders_due() ->> 'next_at')::timestamptz, (current_setting('t.d1') || ' 11:00:00+03')::timestamptz,
  'and the next one falls at 11:00');
select test.as_owner();
select set_config('v2.test_now', current_setting('t.d1') || ' 10:30:00+03', true);
select test.eq(notify.send_reminders(), 0, 'at 10:30 nothing is told');
select set_config('v2.test_now', current_setting('t.d1') || ' 11:00:20+03', true);
select test.eq(notify.send_reminders(), 1, 'at 11:00 it is told again');
select test.eq((select count(*)::int from notify.notification where kind = 'reminder'
                and entity_id = current_setting('t.r')::uuid), 2, 'two alerts in all, one per time');
select test.as_person(current_setting('t.am')::uuid);
select test.eq(jsonb_array_length(api.reminders_due() -> 'due'), 1, 'and it is due again');

-- a snoozed alert waits for its time; Dismiss is the existing mark-read
select set_config('t.nid', api.reminders_due() -> 'due' -> 0 ->> 'notification_id', true);
select api.notifications_snooze(array[current_setting('t.nid')::uuid], (current_setting('t.d1') || ' 11:30:00+03')::timestamptz);
select test.eq(api.reminders_due() -> 'due', '[]'::jsonb, 'a snoozed alert is not due');
select set_config('v2.test_now', current_setting('t.d1') || ' 11:31:00+03', true);
select test.eq(jsonb_array_length(api.reminders_due() -> 'due'), 1, 'until its snooze is over');
select api.notifications_mark_read(array[current_setting('t.nid')::uuid]);
select test.eq(api.reminders_due() -> 'due', '[]'::jsonb, 'dismissed, it is due no more');

-- one Undo takes a move back (on the real clock: Undo's window is counted from when the request was really made)
select set_config('v2.test_now', '', true);
select set_config('t.req2', api.reminder_move(current_setting('t.r')::uuid, (current_setting('t.d1') || ' 15:00:00+03')::timestamptz)
  ->> 'request_id', true);
select api.undo(current_setting('t.req2')::uuid);
select test.as_owner();
select test.eq((select jsonb_build_object('at', remind_at, 'sent', sent_at is not null) from core.reminder
                where id = current_setting('t.r')::uuid),
  jsonb_build_object('at', (current_setting('t.d1') || ' 11:00:00+03')::timestamptz, 'sent', true),
  'one Undo takes the move back: its time and that it was told');

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform test.eq((select schedule from cron.job where jobname = 'notify-send-reminders'), '* * * * *',
      'pg_cron runs the reminder job every minute');
  end if;
end $$;
