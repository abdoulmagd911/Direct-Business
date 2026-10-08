-- CALL-01 — partner.calls and partner.demos (TECH-SPEC §3.4, §3.8; V63, V88): calls logged on organisations that
-- happened in the period (by outcome when asked), and demos — a call with "demo set" or a demo "held" — per person, team
-- or organisation, by `happened_on`. A count: nothing is a real 0, never "not measured". Every value is made up.
-- Sabotages: supabase/tests/sabotage/demos-count-only-calls.sql, calls-count-every-activity.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.team', (select id from core.team where code = 'test_desk')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = current_setting('t.team')::uuid
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
select set_config('t.d0', core.riyadh_today()::text, true);

-- am1 this week: a call with no answer, a call setting a demo, the demo held, a meeting; last month: a call.
-- am2: one answered call.
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Demos Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select api.activity_log(current_setting('t.p')::uuid, 'call', 'no_answer', current_setting('t.d0')::date - 3);
select api.activity_log(current_setting('t.p')::uuid, 'call', 'demo_set', current_setting('t.d0')::date - 2, null, null,
  current_setting('t.d0')::date + 1);
select api.activity_log(current_setting('t.p')::uuid, 'demo', 'demo_held', current_setting('t.d0')::date - 1);
select api.activity_log(current_setting('t.p')::uuid, 'meeting', 'meeting_held', current_setting('t.d0')::date - 1);
select api.activity_log(current_setting('t.p')::uuid, 'call', 'answered', current_setting('t.d0')::date - 40);
select test.as_person(current_setting('t.am2')::uuid);
select api.activity_log(current_setting('t.p')::uuid, 'call', 'answered', current_setting('t.d0')::date - 2);
select test.as_owner();

select test.eq(measure.partner_calls(null, 'person', current_setting('t.am1')::uuid, current_setting('t.d0')::date - 7,
  current_setting('t.d0')::date)::text, '(2,t,2)', 'am1''s calls this week: two — not the demo, not the meeting');
select test.eq(measure.partner_calls('{"outcomes": ["no_answer"]}', 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 7, current_setting('t.d0')::date)::text, '(1,t,1)', 'by outcome');
select test.eq(measure.partner_calls(null, 'person', current_setting('t.am1')::uuid, current_setting('t.d0')::date - 60,
  current_setting('t.d0')::date - 30)::text, '(1,t,1)', 'last month''s call counts in last month');
select test.eq(measure.partner_demos(null, 'person', current_setting('t.am1')::uuid, current_setting('t.d0')::date - 7,
  current_setting('t.d0')::date)::text, '(2,t,2)', 'am1''s demos: the call setting one and the demo held');
select test.eq(measure.partner_demos(null, 'person', current_setting('t.am2')::uuid, current_setting('t.d0')::date - 7,
  current_setting('t.d0')::date)::text, '(0,t,0)', 'am2''s demos: a real 0, measured');
select test.eq(measure.partner_calls(null, 'team', current_setting('t.team')::uuid, current_setting('t.d0')::date - 7,
  current_setting('t.d0')::date)::text, '(3,t,3)', 'the team''s calls');
select test.eq(measure.partner_calls(null, 'partner', current_setting('t.p')::uuid, current_setting('t.d0')::date - 60,
  current_setting('t.d0')::date)::text, '(4,t,4)', 'the organisation''s calls');
