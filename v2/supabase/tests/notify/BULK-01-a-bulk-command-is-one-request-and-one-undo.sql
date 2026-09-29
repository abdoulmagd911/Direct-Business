-- BULK-01 — a bulk command is one request and one Undo (V61, §3.3): removing three saved views at once logs one request
-- with three changes, and one Undo brings all three back; a selection holding someone else's view is refused whole.
-- Sabotage: supabase/tests/sabotage/bulk-is-a-request-per-row.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.other', api.view_save(null, 'tasks', 'Not yours', '{}') ->> 'id', true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.a', api.view_save(null, 'tasks', 'View A', '{}') ->> 'id', true);
select set_config('t.b', api.view_save(null, 'tasks', 'View B', '{}') ->> 'id', true);
select set_config('t.c', api.view_save(null, 'partners', 'View C', '{}') ->> 'id', true);

select test.raises(format('select api.views_remove(%L)', array[current_setting('t.a'), current_setting('t.other')]),
  '42501', 'a selection holding someone else''s view is refused', 'view.not_yours');
select set_config('t.r', api.views_remove(array[current_setting('t.a'), current_setting('t.b'),
  current_setting('t.c')]::uuid[], 'made up: tidy up') ->> 'request_id', true);
select test.as_owner();
select test.eq((select count(*)::int from audit.change where request_id = current_setting('t.r')::uuid), 3,
  'removing three views at once is one request with three changes');
select test.eq((select count(*)::int from audit.request q where q.label_key = 'view.removed'
                and q.actor_id = current_setting('t.am1')::uuid), 1, 'removing three views is one request');
select test.eq((select count(*)::int from core.saved_view where owner_id = current_setting('t.am1')::uuid
                and deleted_at is null), 0, 'all three are removed');

select test.as_person(current_setting('t.am1')::uuid);
select api.undo(current_setting('t.r')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from core.saved_view where owner_id = current_setting('t.am1')::uuid
                and deleted_at is null), 3, 'one Undo brings all three back');
