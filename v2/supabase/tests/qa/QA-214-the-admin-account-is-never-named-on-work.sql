-- QA-214 — The owner's admin account is never named on work (V444: "never counted as a team member — not in team
-- lists, KPIs, leaderboards or reports-to pickers"; his own work is on his employee account; V465's active check). On
-- #140 at db46551 work.person_ok refuses the test account but not the admin account: another admin names it a task's
-- owner or helper, a task it makes falls back to it as owner (the creator, unchecked), and the Past work grid's
-- api.people_match counts it, so the owner's name — shared by his two accounts — answers "many" instead of his
-- employee account. Written by the QA auditor to fail until built (it needs P5-1's tasks). Made-up people only.
select test.ok(to_regprocedure('api.task_create(jsonb,uuid[])') is not null, 'tasks exist (P5-1)');

select set_config('t.acct', test.person('Test Owner Same Name', 'admin')::text, true);
select set_config('t.emp', test.person('Test Owner Same Name', 'member')::text, true);
select set_config('t.boss', test.person('Test Other Admin', 'admin')::text, true);
select test.as_owner();
with x as (insert into core.team (department_id, code, name_en, name_ar)
  select department_id, 'qa_214', 'Test Team 214', 'فريق اختبار' from core.person where id = current_setting('t.boss')::uuid
  returning id)
select set_config('t.team', (select id::text from x), true);
update core.person set team_id = current_setting('t.team')::uuid
  where id in (current_setting('t.boss')::uuid, current_setting('t.emp')::uuid);
update core.person set team_id = null, manager_id = null where id = current_setting('t.acct')::uuid;
update core.person set account = 'admin_account' where id = current_setting('t.acct')::uuid;

select test.as_person(current_setting('t.boss')::uuid);
select test.raises(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made-up task',
  'work_type', 'internal', 'team_id', current_setting('t.team'), 'owner_id', current_setting('t.acct'))::text),
  'P0001', 'the admin account is never named a task''s owner');
select set_config('t.task', (api.task_create(jsonb_build_object('title', 'Made-up task with helpers',
  'work_type', 'internal', 'team_id', current_setting('t.team'))) ->> 'id'), true);
select test.raises(format('select api.task_helpers_set(%L::uuid, array[%L::uuid])', current_setting('t.task'),
  current_setting('t.acct')), 'P0001', 'nor a helper on one');

select test.as_person(current_setting('t.acct')::uuid);
do $$
declare r jsonb;
begin
  r := api.task_create(jsonb_build_object('title', 'Made-up task the admin account makes', 'work_type', 'internal',
                                          'team_id', current_setting('t.team')));
  perform set_config('t.made', r ->> 'id', true);
exception when others then
  perform set_config('t.made', '', true); -- refused, whatever the words: it may not fall back to itself
end
$$;
select test.as_owner();
select test.ok(not exists (select 1 from work.task where id = nullif(current_setting('t.made'), '')::uuid
                                                      and owner_id = current_setting('t.acct')::uuid),
  'a task the admin account makes never falls back to it as owner');

select test.as_person(current_setting('t.boss')::uuid);
select test.eq(api.people_match(array['Test Owner Same Name']) -> 'Test Owner Same Name',
  jsonb_build_object('kind', 'one', 'id', current_setting('t.emp')),
  'a pasted name shared with the admin account resolves to the employee account');
