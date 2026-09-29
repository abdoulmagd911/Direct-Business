-- VIS-01 — a private record type (V96; QA-05, QA-09): a record type may name its own rule, a function (record id,
-- person) → boolean, and be private. Then a person sees a record only by that rule, as one of its owners, or as an
-- admin — Full (or Own) on its page never counts — and history, Follow, notices and Activity all ask the same question
-- (authz.can_see_as). P6-3's appraisals use it; here the partner type is made private for the test. Made up.
-- Sabotage: supabase/tests/sabotage/a-private-record-shown-by-the-page-level.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.mgr', test.person('Test Allowed Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.pid', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Private',
  'account_manager_id', current_setting('t.am1'))) ->> 'id', true);
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.can_see('partner', current_setting('t.pid')::uuid), true, 'an open record: Full on its page sees it');
select api.follow('partner', current_setting('t.pid')::uuid);
select test.as_person(current_setting('t.mgr')::uuid);
select api.follow('partner', current_setting('t.pid')::uuid);

-- the type becomes private, with its own rule: only the one person the test names
select test.as_owner();
create function test.vis_only(p_id uuid, p_person uuid) returns boolean
language sql stable set search_path = ''
as $$ select p_person = pg_catalog.current_setting('t.mgr')::uuid $$;
select test.raises($$update core.entity set visible = 'test.no_such_rule' where key = 'partner'$$, 'P0001',
  'a rule that is not a function (record id, person) is refused', 'entity.bad_visible');
update core.entity set private = true, visible = 'test.vis_only' where key = 'partner';

select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.can_see('partner', current_setting('t.pid')::uuid), true, 'an admin sees a private record');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(api.can_see('partner', current_setting('t.pid')::uuid), true, 'the person its rule names sees it');
select test.runs(format('select api.record_history(%L, %L)', 'partner', current_setting('t.pid')), 'and its history');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.can_see('partner', current_setting('t.pid')::uuid), true, 'its owner sees it');
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.can_see('partner', current_setting('t.pid')::uuid), false,
  'a head with Full on the page does not see a private record');
select test.raises(format('select api.record_history(%L, %L)', 'partner', current_setting('t.pid')), '42501',
  'nor its history', 'access.needs_level');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(api.can_see('partner', current_setting('t.pid')::uuid), false, 'nor a viewer');
select test.raises(format('select api.follow(%L, %L)', 'partner', current_setting('t.pid')), '42501',
  'who cannot follow it either', 'access.needs_level');

-- a change by the admin: the owner and the allowed follower are told; the head, who follows it, is not
select set_config('t.r', test.act(current_setting('t.admin')::uuid, 'partner.changed')::text, true);
update partner.partner set trade_name_en = 'Made Up Private Renamed' where id = current_setting('t.pid')::uuid;
select test.eq(notify.push(current_setting('t.head')::uuid, 'mentioned', 'partner.partner',
                           current_setting('t.pid')::uuid), false, 'a mention of it tells nobody who cannot see it');
select test.eq(notify.push(current_setting('t.mgr')::uuid, 'mentioned', 'partner.partner',
                           current_setting('t.pid')::uuid), true, 'and tells one who can');
select test.done();
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.r')::uuid
                and person_id = current_setting('t.head')::uuid), 0,
  'a follower who can no longer see the record is not told of the change');
select test.eq((select kind from notify.notification where request_id = current_setting('t.r')::uuid
                and person_id = current_setting('t.am1')::uuid), 'changed_by_other', 'its owner is');
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.r')::uuid
                and person_id = current_setting('t.mgr')::uuid), 1,
  'the follower its rule names is told once — the mention already told them');

select test.as_person(current_setting('t.head')::uuid);
select test.ok(not exists (select 1 from jsonb_array_elements(api.activity()) x
                           where x ->> 'request_id' = current_setting('t.r')),
  'Activity does not show the head a change to a record they cannot see');
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(exists (select 1 from jsonb_array_elements(api.activity()) x
                       where x ->> 'request_id' = current_setting('t.r')), 'an admin''s Activity does');
