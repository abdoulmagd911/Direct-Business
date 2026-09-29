-- NTF-02 — the bell (§3.3, V61): my notifications only, newest first, by tab (all · mentions · assigned to me), with the
-- current name of who caused each; the unread count; mark read one by one or all at once; snooze hides one until its
-- time (at most 30 days, never in the past). Nobody reads or marks another person's.
-- Sabotage: supabase/tests/sabotage/the-bell-shows-everyones.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
insert into notify.notification (person_id, kind, actor_id, label_key, created_at) values
  (current_setting('t.am1')::uuid, 'assigned', current_setting('t.admin')::uuid, 'task.assigned', now() - interval '3 hours'),
  (current_setting('t.am1')::uuid, 'mentioned', current_setting('t.admin')::uuid, 'note.mentioned', now() - interval '2 hours'),
  (current_setting('t.am1')::uuid, 'changed_by_other', current_setting('t.admin')::uuid, 'person.renamed',
   now() - interval '1 hour'),
  (current_setting('t.am2')::uuid, 'assigned', current_setting('t.admin')::uuid, 'task.assigned', now());
update core.person set nickname_en = 'Admin Nick' where id = current_setting('t.admin')::uuid;

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.all', api.notifications()::text, true);
select test.eq(jsonb_array_length(current_setting('t.all')::jsonb), 3,
  'my bell has my three; another person''s notifications are never in my bell');
select test.eq(current_setting('t.all')::jsonb -> 0 ->> 'kind', 'changed_by_other', 'newest first');
select test.eq(current_setting('t.all')::jsonb -> 0 ->> 'actor_name_en', 'Admin Nick',
  'with the current name of who caused it');
select test.eq(jsonb_array_length(api.notifications('mentions')), 1, 'the Mentions tab');
select test.eq(api.notifications('assigned') -> 0 ->> 'kind', 'assigned', 'the Assigned to me tab');
select test.raises('select api.notifications(''elsewhere'')', 'P0001', 'an unknown tab', 'notify.unknown_tab');
select test.eq(api.notifications_unread(), 3, 'three unread');

select test.eq(api.notifications_mark_read(array[(current_setting('t.all')::jsonb -> 0 ->> 'id')::uuid]), 1,
  'mark one read');
select test.eq(api.notifications_unread(), 2, 'two unread');
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.notifications_mark_read(array[(current_setting('t.all')::jsonb -> 1 ->> 'id')::uuid]), 0,
  'nobody marks another person''s notification');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.notifications_unread(), 2, 'still two unread');

select test.eq(api.notifications_snooze(array[(current_setting('t.all')::jsonb -> 1 ->> 'id')::uuid],
  now() + interval '1 day'), 1, 'snooze one until tomorrow');
select test.eq(jsonb_array_length(api.notifications()), 2, 'a snoozed notification leaves the bell');
select test.eq(api.notifications_unread(), 1, 'and the count');
select set_config('v2.test_now', (now() + interval '25 hours')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(jsonb_array_length(api.notifications()), 3, 'and comes back at its time');
select set_config('v2.test_now', '', true);
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.notifications_snooze(%L, %L)', array[(current_setting('t.all')::jsonb -> 2 ->> 'id')],
  now() - interval '1 minute'), 'P0001', 'snooze into the past', 'notify.snooze_in_the_past');
select test.raises(format('select api.notifications_snooze(%L, %L)', array[(current_setting('t.all')::jsonb -> 2 ->> 'id')],
  now() + interval '31 days'), 'P0001', 'snooze beyond 30 days', 'notify.snooze_too_far');

select test.eq(api.notifications_mark_read(), 1, 'Mark all read marks the rest that show');
select test.eq(api.notifications_unread(), 0, 'nothing unread');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and read_at is null), 1, 'the other person''s notification is still unread');
