-- PRIV-02 — Stage 2 keeps V454 (V632): a private reminder is its person's alone, admins included — not in another's
-- reminders_due, not movable by them, not readable through the bell's live read rule (each person reads only their own
-- notifications) — and a follow-up reveals no record: one on a record its maker cannot see is not found, one for an
-- assignee who cannot see it is refused, and a record's list of follow-ups is closed to whoever cannot see the record.
-- Every value is made up; the day is the one after the database is built (see NOTE-06).
-- Sabotages: supabase/tests/sabotage/a-follow-up-reveals-an-invoice.sql, the-bell-reads-everyones-notifications.sql.
select set_config('t.d1', (current_date + 1)::text, true);
select set_config('v2.test_now', current_setting('t.d1') || ' 09:00:00+03', true);
select set_config('t.am', test.person('Test Quiet Member', 'member')::text, true);
select set_config('t.am2', test.person('Test Quiet Colleague', 'member')::text, true);
select set_config('t.admin', test.person('Test Quiet Admin', 'admin')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am')::uuid, 'finance', 'none', 'made up: no Finance');

select test.as_person(current_setting('t.am')::uuid);
select api.note_capture('reminder', jsonb_build_object('title', 'Zebracorn private call',
  'remind_at', current_setting('t.d1') || 'T09:30:00+03:00'));
select set_config('t.r', (api.my_day('me') -> 'reminders' -> 0 ->> 'id'), true);
select test.as_owner();
select set_config('v2.test_now', current_setting('t.d1') || ' 09:31:00+03', true);
select notify.send_reminders();

select test.as_person(current_setting('t.am2')::uuid);
select test.ok(position('Zebracorn' in api.reminders_due()::text) = 0, 'a colleague''s due reminders hold nothing of it');
select test.raises(format('select api.reminder_move(%L, %L)', current_setting('t.r'), current_setting('t.d1') || ' 12:00:00+03'),
  'P0002', 'nor can they move it', 'common.not_found');
select test.eq((select count(*)::int from notify.notification where entity_id = current_setting('t.r')::uuid), 0,
  'nor read its alert through the bell''s live read rule');
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(position('Zebracorn' in api.reminders_due()::text) = 0, 'an admin''s due reminders hold nothing of it');
select test.raises(format('select api.reminder_move(%L, %L)', current_setting('t.r'), current_setting('t.d1') || ' 12:00:00+03'),
  'P0002', 'nor can an admin move it', 'common.not_found');
select test.eq((select count(*)::int from notify.notification where entity_id = current_setting('t.r')::uuid), 0,
  'nor read its alert');
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select count(*)::int from notify.notification where entity_id = current_setting('t.r')::uuid), 1,
  'its person reads their own alert live');

-- a follow-up reveals no record: an invoice (Finance) a member cannot see
select test.as_owner();
insert into finance.invoice (ref, kind, status_raw, status_id, created_on, total_sar, source, created_by)
values ('MN-7001', 'standalone', 'Draft', (select id from finance.status_map where key = 'draft'), current_setting('t.d1')::date, 40,
        'manual', current_setting('t.admin')::uuid);
select set_config('t.inv', (select id from finance.invoice where ref = 'MN-7001')::text, true);
select test.as_person(current_setting('t.am')::uuid);
select test.raises(format('select api.follow_up(%L, %L, %L)', 'invoice', current_setting('t.inv'), current_setting('t.d1')),
  'P0002', 'a follow-up on an invoice its maker cannot see is not found', 'common.not_found');
select test.raises(format('select api.follow_ups(%L, %L)', 'invoice', current_setting('t.inv')),
  'P0002', 'nor is its list of follow-ups', 'common.not_found');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.follow_up(%L, %L, %L, %L)', 'invoice', current_setting('t.inv'), current_setting('t.d1'),
  current_setting('t.am')), 'P0001', 'an assignee who cannot see the invoice is refused', 'follow_up.assignee_cannot_see');
select test.eq(jsonb_array_length(api.follow_ups('invoice', current_setting('t.inv')::uuid)), 0,
  'and nothing was made');
