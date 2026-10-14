-- PRIV-02 — Stage 2 keeps V454 (V632): a private reminder is its person's alone, admins included — not in another's
-- reminders_due, not movable by them, not readable through the bell's live read rule (each person reads only their own
-- notifications) — and a follow-up, a note about a record, reveals no record: one on a record its author cannot see is
-- not found, and a note shared with the team shows its record only to those who may see it.
-- Every value is made up; the day is the one after the database is built (see NOTE-06).
-- Sabotages: supabase/tests/sabotage/the-bell-reads-everyones-notifications.sql, a-note-reveals-its-record.sql.
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

-- a follow-up is a note about a record, and the record shows only to whoever may see it: an invoice (Finance) a
-- member cannot see
select test.as_owner();
insert into finance.invoice (ref, kind, status_raw, status_id, created_on, total_sar, source, created_by)
values ('MN-7001', 'standalone', 'Draft', (select id from finance.status_map where key = 'draft'), current_setting('t.d1')::date, 40,
        'manual', current_setting('t.admin')::uuid);
select set_config('t.inv', (select id from finance.invoice where ref = 'MN-7001')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_quiet', 'Test Quiet Desk', 'فريق الهدوء');
update core.person set team_id = (select id from core.team where code = 'test_quiet')
where id in (current_setting('t.am')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'reminder', jsonb_build_object('title', 'Made-up chase',
  'remind_at', current_setting('t.d1') || 'T15:00:00+03:00', 'about', jsonb_build_object('entity', 'invoice', 'id', current_setting('t.inv')))),
  'P0002', 'a follow-up on an invoice its author cannot see is not found', 'common.not_found');

-- a colleague shares a note about the invoice with the team: I see the note, and nothing of the invoice
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.shared', api.note_capture('sticky', jsonb_build_object('title', 'Made-up chase the payment',
  'visibility', 'team', 'about', jsonb_build_object('entity', 'invoice', 'id', current_setting('t.inv')))) ->> 'id', true);
select test.eq(api.my_note(current_setting('t.shared')::uuid) -> 'about' ->> 'label', 'MN-7001',
  'its author sees what it is about');
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.seen', api.my_day('team')::text || api.my_note(current_setting('t.shared')::uuid)::text, true);
select test.ok(position('Made-up chase the payment' in current_setting('t.seen')) > 0, 'a teammate sees the shared note');
select test.ok(position('MN-7001' in current_setting('t.seen')) = 0
               and api.my_note(current_setting('t.shared')::uuid) -> 'about' = 'null'::jsonb,
  'but a teammate who cannot see the invoice reads nothing of it');
