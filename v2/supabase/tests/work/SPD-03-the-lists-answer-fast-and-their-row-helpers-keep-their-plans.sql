-- SPD-03 — the lists answer fast, and the helpers they call per row keep their plans (Landing 35; owner's live
-- sweep, 21 Nov 2026: Tasks, Partners, My Day and search took seconds for a few dozen rows, and failed on and off).
-- A list calls small helpers several times for every row — is this task past work, is it stale, when was it last
-- touched, is this side on, what is its status, who owns it. They were SQL-language functions with a pinned
-- search_path (SEC-01), which Postgres plans again on EVERY call: work.last_activity_on alone cost 0.9 ms a call,
-- twice per task. Two guards:
--   1. the per-row helpers are plpgsql, which keeps a statement's plan for the connection;
--   2. a clock: with 150 made-up tasks and 40 made-up organisations the Tasks list, the Partners list, My Day,
--      search and the team's load each answer in under 2 s (a generous bound: they take a few hundredths here).
-- The answers are the ones the Tasks, Partners and My Day tests pin; this file adds only the counts it loads.
-- Every value is made up. Sabotages: supabase/tests/sabotage/a-row-helper-is-planned-on-every-call.sql,
-- the-task-flags-take-a-while-per-task.sql.
select test.eq(
  (select coalesce(pg_catalog.string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), '')
   from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid = p.prolang
   where p.oid in ('work.last_activity_on(uuid)'::regprocedure, 'work.task_is_past(work.task)'::regprocedure,
                   'work.is_past(date)'::regprocedure, 'work.task_flags(work.task)'::regprocedure,
                   'work.task_row(work.task,uuid)'::regprocedure, 'work.can_edit_task(uuid,work.task)'::regprocedure,
                   'work.in_my_work(work.task,uuid)'::regprocedure, 'work.sees_department(uuid,uuid)'::regprocedure,
                   'work.can_comment(uuid,work.task)'::regprocedure,
                   'core.logged_late(date,timestamptz)'::regprocedure, 'core.riyadh_day(timestamptz)'::regprocedure,
                   'core.person_available(uuid)'::regprocedure, 'core.is_team_member(uuid)'::regprocedure,
                   'authz.is_settings_page(text)'::regprocedure,
                   'partner.side_page(text)'::regprocedure, 'partner.side_on(uuid,text,date)'::regprocedure,
                   'partner.status_of(uuid,text,date)'::regprocedure, 'partner.level_of(uuid,uuid,text)'::regprocedure,
                   'partner.sees_side(uuid,uuid,text)'::regprocedure, 'partner.side_json(uuid,text)'::regprocedure,
                   'partner.stale_on(uuid)'::regprocedure, 'partner.last_activity_on(uuid)'::regprocedure,
                   'partner.flags(uuid,uuid,text)'::regprocedure, 'partner.owner_seen_by(uuid,uuid)'::regprocedure,
                   'partner.side_owners(uuid,text)'::regprocedure, 'partner.contract_state(date,date,date)'::regprocedure,
                   'finance.item_head(text)'::regprocedure, 'finance.item_tail(text)'::regprocedure,
                   'finance.code_state(date,date)'::regprocedure,
                   'notify.changed_fields(text,uuid,text,uuid,uuid)'::regprocedure,
                   'finance.partner_match(uuid)'::regprocedure, 'finance.exclusion_of(uuid)'::regprocedure,
                   'finance.is_wallet_line(uuid,text)'::regprocedure, 'measure.client_segment(uuid)'::regprocedure)
     and l.lanname <> 'plpgsql'),
  '', 'the helpers a list calls per row keep their plans: every one is plpgsql');

-- 6 made-up people on one desk, 40 organisations, 150 tasks (a fifth done, a quarter with a helper)
select set_config('t.m' || g, test.person('Made Up Desk Member ' || g, 'member')::text, true) from generate_series(1, 6) g;
select set_config('t.head', test.person('Test Head', 'head')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'made_up_speed_desk', 'Made-up speed desk', 'مكتب مختلق');
update core.person set team_id = (select id from core.team where code = 'made_up_speed_desk')
where id in (select current_setting('t.m' || g)::uuid from generate_series(1, 6) g) or id = current_setting('t.head')::uuid;
select test.as_person(current_setting('t.head')::uuid);
do $$
declare
  i int; t uuid;
begin
  for i in 1..40 loop
    perform api.partner_create(jsonb_build_object('trade_name_en', 'Made Up List Org ' || i,
      'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                    'owner_id', current_setting('t.m' || (1 + i % 6))))));
  end loop;
  for i in 1..150 loop
    perform test.as_person(current_setting('t.m' || (1 + i % 6))::uuid);
    t := (api.task_create(jsonb_build_object('title', 'Made-up list task ' || i, 'work_type', 'internal',
                                             'due_on', core.riyadh_today() + (i % 20) - 8)) ->> 'id')::uuid;
    if i % 4 = 0 then
      perform api.task_helpers_set(t, array[current_setting('t.m' || (1 + (i + 1) % 6))::uuid]);
    end if;
    if i % 5 = 0 then
      perform api.task_status_set(t, 'done');
    end if;
  end loop;
end $$;

select test.as_person(current_setting('t.m2')::uuid);
create temp table spd_list (read text primary key, ms numeric, answer jsonb) on commit drop;
do $$
declare
  r record; t0 timestamptz; a jsonb;
begin
  for r in select * from (values
      ('the Tasks list', $q$api.tasks()$q$),
      ('the Tasks list, my work', $q$api.tasks('{"scope": "my_work"}'::jsonb, 50, 0)$q$),
      ('the Partners list', $q$api.partners()$q$),
      ('My Day', $q$api.my_day()$q$),
      ('search', $q$api.search('made up list')$q$),
      ('the team load', $q$api.team_load()$q$),
      ('the notifications', $q$api.notifications()$q$),
      ('who am I', $q$api.me()$q$)) v(read, call) loop
    t0 := pg_catalog.clock_timestamp();
    execute 'select to_jsonb(' || r.call || ')' into a;
    insert into spd_list values (r.read, extract(epoch from pg_catalog.clock_timestamp() - t0) * 1000, a);
  end loop;
end $$;
select test.eq((select coalesce(pg_catalog.string_agg(read || ' (' || pg_catalog.round(ms) || ' ms)', ', ' order by ms desc), '')
                from spd_list where ms >= 2000),
  '', 'every list answers in under 2 s with 150 tasks and 40 organisations');
-- the answers: all 150 tasks are this department's (30 of them done), the first page holds 50; 40 organisations
select test.eq((select (answer ->> 'total')::int from spd_list where read = 'the Tasks list'), 150, 'the Tasks list counts the 150 tasks');
select test.eq((select pg_catalog.jsonb_array_length(answer -> 'rows') from spd_list where read = 'the Tasks list'), 50, 'a page at a time');
select test.eq((select pg_catalog.count(*)::int from spd_list, pg_catalog.jsonb_array_elements(answer -> 'rows') r
                where read = 'the Tasks list' and (r ->> 'past_work')::boolean), 0, 'none of them past work');
select test.eq((select (answer ->> 'total')::int from spd_list where read = 'the Partners list'), 40, 'the Partners list counts the 40 organisations');
-- member 2 owns the tasks numbered 1, 7, 13 … (25 of the 150) and helps on those of member 1 with a helper
select test.eq((select (answer ->> 'total')::int from spd_list where read = 'the Tasks list, my work') >= 25, true,
  'my work holds at least the 25 tasks I own');
