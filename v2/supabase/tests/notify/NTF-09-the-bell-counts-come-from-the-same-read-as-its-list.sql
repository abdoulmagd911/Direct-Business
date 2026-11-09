-- NTF-09 — the bell's counts come from the same read as its list (FIX-34, F238/F237, D36(c)): the badge, the All
-- count and the tab counts are the one response's counts, so they agree with each other — and they are over the full
-- set, not the capped rows, so they agree above the row cap too. Every value is made up.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
insert into notify.notification (person_id, kind, actor_id, label_key, created_at) values
  (current_setting('t.am1')::uuid, 'assigned', current_setting('t.admin')::uuid, 'task.assigned', now() - interval '3 hours'),
  (current_setting('t.am1')::uuid, 'mentioned', current_setting('t.admin')::uuid, 'note.mentioned', now() - interval '2 hours'),
  (current_setting('t.am1')::uuid, 'helper_added', current_setting('t.admin')::uuid, 'task.helper_added', now() - interval '1 hour'),
  (current_setting('t.am1')::uuid, 'changed_by_other', current_setting('t.admin')::uuid, 'person.renamed', now());

select test.as_person(current_setting('t.am1')::uuid);
select test.eq((api.notifications() ->> 'unread')::int, 4, 'the All count counts every unread row');
select test.eq((api.notifications() ->> 'unread_mentions')::int, 1, 'the Mentions count counts mentioned rows');
select test.eq((api.notifications() ->> 'unread_assigned')::int, 2,
  'the Assigned count counts assigned and helper_added rows');
select test.eq((api.notifications() ->> 'unread')::int, api.notifications_unread(),
  'and the one read''s count agrees with the count read');
select test.eq(jsonb_array_length(api.notifications('all', null, 1) -> 'rows'), 1, 'one row under a cap of one');
select test.eq((api.notifications('all', null, 1) ->> 'unread')::int, 4,
  'but the count is over the full set, not the capped rows');

select test.eq(api.notifications_mark_read(array[(api.notifications() -> 'rows' -> 0 ->> 'id')::uuid]), 1,
  'mark one read');
select test.eq((api.notifications() ->> 'unread')::int, 3, 'the All count drops by one');
select test.eq(api.notifications_mark_read(), 3, 'Mark all read marks the rest that show');
select test.eq((api.notifications() ->> 'unread')::int, 0, 'nothing unread');
select test.eq((api.notifications() ->> 'unread_mentions')::int, 0, 'no tab counts anything unread either');
select test.eq((api.notifications() ->> 'unread_assigned')::int, 0, 'nor the other tab');
