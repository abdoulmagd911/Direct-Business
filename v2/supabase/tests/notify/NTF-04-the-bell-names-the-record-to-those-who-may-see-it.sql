-- NTF-04 — the bell names each notification's record (Builder B's request, 13 Oct): a task assigned to me reads as its
-- number and title, a client as its trade name — in Arabic where it has one; a reader who may not see the record gets
-- no name for it (the bell shows the kind's word), and a notification with no record has none. One read: every row
-- comes named. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-bell-names-records-to-anyone.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_bell', 'Test Bell Desk', 'فريق الجرس');
select set_config('t.am', test.person('Test Bell Member', 'member')::text, true);
select set_config('t.far', test.person('Test Far Head', 'head', 'test_other_dept')::text, true);
select set_config('t.team', (select id from core.team where code = 'test_bell')::text, true);
update core.person set team_id = current_setting('t.team')::uuid where id = current_setting('t.am')::uuid;

-- the admin gives the member a task; a client the member owns
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.made', api.task_create(jsonb_build_object('title', 'Made-up hotel call',
  'owner_id', current_setting('t.am'), 'team_id', current_setting('t.team'),
  'due_on', (core.riyadh_today() + 1)::text))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Bell Co',
  'trade_name_ar', 'شركة الجرس المختلقة',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);

select test.as_owner();
insert into notify.notification (person_id, kind, actor_id, entity_table, entity_id, label_key, created_at) values
  (current_setting('t.am')::uuid, 'changed_by_other', current_setting('t.admin')::uuid, 'partner.partner',
   current_setting('t.p')::uuid, 'partner.changed', now() - interval '1 minute'),
  (current_setting('t.am')::uuid, 'changed_by_other', current_setting('t.admin')::uuid, null, null, 'person.renamed',
   now() - interval '2 minutes'),
  (current_setting('t.far')::uuid, 'changed_by_other', current_setting('t.admin')::uuid, 'work.task',
   current_setting('t.t')::uuid, 'task.changed', now());

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.bell', api.notifications()::text, true);
select test.eq((select x ->> 'title' from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                where x ->> 'entity_id' = current_setting('t.t') and x ->> 'kind' = 'assigned'),
  (current_setting('t.made')::jsonb ->> 'number') || ' · Made-up hotel call', 'a task reads as its number and title');
select test.eq((select jsonb_build_object('en', x ->> 'title', 'ar', x ->> 'title_ar')
                from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                where x ->> 'entity_id' = current_setting('t.p') and x ->> 'label_key' = 'partner.changed'),
  jsonb_build_object('en', 'Made Up Bell Co', 'ar', 'شركة الجرس المختلقة'), 'a client reads as its trade name, in Arabic too');
select test.eq((select x -> 'title' from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                where x ->> 'label_key' = 'person.renamed'), 'null'::jsonb, 'a notification with no record has no name');

select test.as_owner();
select test.ok(not authz.can_see_as(current_setting('t.far')::uuid, 'work.task', current_setting('t.t')::uuid),
  'the far head may not see the task');
select test.as_person(current_setting('t.far')::uuid);
select test.eq(api.notifications() -> 0 -> 'title', 'null'::jsonb, 'so their bell gives no name for it');
