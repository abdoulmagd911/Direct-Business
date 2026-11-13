-- TSK-07 — the list door answers every chip itself (owner 13 Nov, A-tasks), so a view never loses a task past its
-- first page and its total is the view's: Helping is my work someone else owns; due Today is Riyadh's today, This week
-- today and the six days after, No date no due day; the priority chip and sort are the door's too. Every value is
-- made up.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
select set_config('t.d0', core.riyadh_today()::text, true);

-- am1's own: due today, in three days, in ten days, none; am2's two, one am1 helps on
select test.as_person(current_setting('t.am1')::uuid);
select api.task_create(jsonb_build_object('title', 'Made-up today', 'due_on', current_setting('t.d0'), 'priority', 'high'));
select api.task_create(jsonb_build_object('title', 'Made-up in three days', 'due_on', current_setting('t.d0')::date + 3,
  'priority', 'low'));
select api.task_create(jsonb_build_object('title', 'Made-up in ten days', 'due_on', current_setting('t.d0')::date + 10));
select api.task_create(jsonb_build_object('title', 'Made-up no date'));
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.h', api.task_create(jsonb_build_object('title', 'Made-up helped on',
  'due_on', current_setting('t.d0')::date + 6)) ->> 'id', true);
select api.task_create(jsonb_build_object('title', 'Made-up not mine'));
select api.task_helpers_set(current_setting('t.h')::uuid, array[current_setting('t.am1')::uuid]);

select test.as_person(current_setting('t.am1')::uuid);
select test.eq((api.tasks(jsonb_build_object('scope', 'my_work')) ->> 'total')::int, 5, 'my work: four owned, one helped on');
select test.eq((api.tasks(jsonb_build_object('scope', 'helping')) ->> 'total')::int, 1, 'helping: the one someone else owns');
select test.eq(api.tasks(jsonb_build_object('scope', 'helping')) #>> '{rows,0,title}', 'Made-up helped on',
  'and it is that one');
select test.eq((api.tasks(jsonb_build_object('scope', 'my_work', 'due', 'today')) ->> 'total')::int, 1, 'due today');
select test.eq((api.tasks(jsonb_build_object('scope', 'my_work', 'due', 'week')) ->> 'total')::int, 3,
  'this week: today and the six days after, not the tenth day');
select test.eq((api.tasks(jsonb_build_object('scope', 'my_work', 'due', 'none')) ->> 'total')::int, 1, 'no due day');
select test.eq((api.tasks(jsonb_build_object('scope', 'my_work', 'priority', 'high')) ->> 'total')::int, 1,
  'the priority chip');
select test.eq((api.tasks(jsonb_build_object('scope', 'mine', 'sort', 'priority')) #>> '{rows,0,title}'),
  'Made-up today', 'the priority sort puts High first');
select test.eq((api.tasks(jsonb_build_object('scope', 'mine', 'sort', 'priority')) #>> '{rows,1,title}'),
  'Made-up in three days', 'then Low, then no priority');

-- the total is the view's, past the first page
select test.eq((api.tasks(jsonb_build_object('scope', 'my_work', 'due', 'week'), 1) ->> 'total')::int, 3,
  'a page of one still counts the whole view');
select test.eq((api.tasks(jsonb_build_object('scope', 'my_work', 'due', 'week'), 1) ->> 'more')::boolean, true,
  'and says there is more');
