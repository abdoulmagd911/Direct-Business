-- VIEW-01 — saved views (V61, V78, V130): anyone who can open a page saves personal views on it; sharing one with
-- everyone who can open the page needs Full on it; only its owner changes a view, naming the version they read; a name
-- is used once per person and page; each person picks the view a page opens on, from the views they can see; a
-- removed view leaves the list.
-- Sabotage: supabase/tests/sabotage/anyone-shares-a-view.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);

-- a member (Own on Tasks) saves a personal view; sharing needs Full
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.v1', api.view_save(null, 'tasks', 'My overdue', '{"filters": {"due": "overdue"}}') ->> 'id', true);
select test.raises($$select api.view_save(null, 'tasks', 'Everyone overdue', '{}', true)$$, '42501',
  'sharing a view needs Full on the page', 'access.needs_level');
select test.raises($$select api.view_save(null, 'tasks', 'my overdue', '{}')$$, '23505',
  'a name is used once per person and page', 'view.name_taken');

-- a head (Full on Tasks) shares one
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.v2', api.view_save(null, 'tasks', 'Team this week', '{"filters": {"due": "week"}}', true) ->> 'id',
  true);
select test.eq((select count(*)::int from jsonb_array_elements(api.views('tasks'))), 1,
  'a person''s own and the shared views — not another''s personal ones');

select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.list', api.views('tasks')::text, true);
select test.eq(jsonb_array_length(current_setting('t.list')::jsonb), 1, 'another member sees the shared view only');
select test.eq(current_setting('t.list')::jsonb -> 0 ->> 'id', current_setting('t.v2'), 'the head''s shared one');
select test.eq((current_setting('t.list')::jsonb -> 0 ->> 'mine')::boolean, false, 'marked as not theirs');
select test.raises(format('select api.view_save(%L, %L, %L, %L, true, 0, 1)', current_setting('t.v2'), 'tasks',
  'Taken over', '{}'), '42501', 'only its owner changes a view', 'view.not_yours');
select test.raises(format('select api.view_default_set(%L, %L)', 'tasks', current_setting('t.v1')), 'P0002',
  'nobody opens a page on another person''s personal view', 'common.not_found');
select test.eq(api.view_default_set('tasks', current_setting('t.v2')::uuid), current_setting('t.v2')::uuid,
  'a person picks a shared view as their default');
select test.eq((select (v ->> 'default')::boolean from jsonb_array_elements(api.views('tasks')) v
                where v ->> 'id' = current_setting('t.v2')), true, 'and the list says so');

-- the owner changes it with the version they read
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.saved', api.view_save(current_setting('t.v1')::uuid, 'tasks', 'My overdue, by partner',
  '{"filters": {"due": "overdue"}, "group": "partner"}', false, 0, 1)::text, true);
select test.eq((current_setting('t.saved')::jsonb ->> 'version')::int, 2, 'the owner changes their view');
select test.raises(format('select api.view_save(%L, %L, %L, %L, false, 0, 1)', current_setting('t.v1'), 'tasks',
  'Renamed from a stale screen', '{"filters": {"due": "overdue"}, "group": "partner"}'), '40001',
  'a change from a stale screen to the same field is refused', 'common.conflict');
select test.eq(api.view_default_set('tasks', current_setting('t.v1')::uuid), current_setting('t.v1')::uuid,
  'the owner picks their own view');
select api.views_remove(array[current_setting('t.v1')::uuid], 'made up: not needed');
select test.eq((select count(*)::int from jsonb_array_elements(api.views('tasks')) v
                where v ->> 'id' = current_setting('t.v1')), 0, 'a removed view leaves the list');

-- a person who cannot open the page sees no views on it
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises('select api.views(''activity'')', '42501', 'no views on a page one cannot open',
  'access.needs_level');
