-- ACH-02 — who sees and who changes an achievement (§5; V96, §3.8). The whole team sees every achievement of its
-- department, nobody another department's (an admin sees all); a viewer reads and logs nothing; a member changes their
-- own and those they share in, never a colleague's; a manager with Full changes anyone's, saying why; no role reads or
-- writes the tables directly. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-colleagues-achievement-edited.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Member One', 'member')::text, true);
select set_config('t.am2', test.person('Test Member Two', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.ops', test.person('Test Other Department', 'member', 'operations')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select api.plan_open(test.department('operations'), 2026);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up refund solved',
  'happened_on', '2026-09-14')) ->> 'id', true);
select set_config('t.v', (api.achievement(current_setting('t.a')::uuid) ->> 'version'), true);
select test.as_person(current_setting('t.ops')::uuid);
select set_config('t.o', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up other fix',
  'happened_on', '2026-09-15')) ->> 'id', true);

-- seeing
select test.as_person(current_setting('t.am2')::uuid);
select test.eq((api.achievements() ->> 'total')::int, 1, 'a colleague sees the department''s achievement (V96)');
select test.eq(api.achievement(current_setting('t.a')::uuid) ->> 'title', 'Made-up refund solved', 'and opens it');
select test.raises(format('select api.achievement(%L)', current_setting('t.o')), 'P0002',
  'never another department''s', 'common.not_found');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.achievements() ->> 'total')::int, 2, 'an admin sees every department''s');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq((api.achievements() ->> 'total')::int, 1, 'a viewer reads');
select test.raises($$select api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made up'))$$,
  '42501', 'and logs nothing', 'access.needs_level');
select test.eq(api.achievement_line(current_setting('t.a')::uuid), 'Problem solved: Made-up refund solved',
  'the line for whoever may see it');
select test.as_person(current_setting('t.ops')::uuid);
select test.eq(api.achievement_line(current_setting('t.a')::uuid), null::text, 'and nothing for anyone else');

-- changing
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.achievement_update(%L, %L::jsonb, %s)', current_setting('t.a'),
  '{"title": "Made-up takeover"}', current_setting('t.v')), '42501', 'a member never changes a colleague''s',
  'access.needs_level');
select test.raises(format('select api.achievements_remove(array[%L]::uuid[], %L)', current_setting('t.a'), 'made up'),
  '42501', 'nor removes it', 'access.needs_level');
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.achievement_participants_set(%L, array[%L]::uuid[])', current_setting('t.a'),
  current_setting('t.am2')), 'the owner adds a participant');
select set_config('t.v', (api.achievement(current_setting('t.a')::uuid) ->> 'version'), true);
select test.as_person(current_setting('t.am2')::uuid);
select test.runs(format('select api.achievement_update(%L, %L::jsonb, %s)', current_setting('t.a'),
  '{"notes": "Made-up detail from the participant"}', current_setting('t.v')), 'a participant changes it');
select test.eq((api.achievements(jsonb_build_object('scope', 'mine')) ->> 'total')::int, 1,
  'and finds it among their own');
select set_config('t.v', (api.achievement(current_setting('t.a')::uuid) ->> 'version'), true);
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.achievement_update(%L, %L::jsonb, %s)', current_setting('t.a'),
  '{"count": 2}', current_setting('t.v')), 'P0001', 'a manager changing someone else''s says why', 'common.reason_required');
select test.runs(format('select api.achievement_update(%L, %L::jsonb, %s, %L)', current_setting('t.a'),
  '{"count": 2}', current_setting('t.v'), 'Made-up correction'), 'and with a reason does');
select test.as_owner();
select test.eq((select reason from audit.request where id = (select request_id from audit.change
                where row_id = current_setting('t.a')::uuid order by id desc limit 1)), 'Made-up correction',
  'the reason is kept with the change');

-- no direct reads or writes
select test.as_person(current_setting('t.admin')::uuid);
select test.raises('select count(*) from perf.achievement', '42501', 'no role reads the table directly');
select test.raises(format('update perf.achievement set title = %L', 'x'), '42501', 'nor writes it');
