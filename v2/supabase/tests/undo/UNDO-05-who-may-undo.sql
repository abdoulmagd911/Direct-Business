-- UNDO-05 — who may undo (§3.3, D7, V128): the person who made a change, within audit.undo_window_hours (a setting);
-- the owner of every record it changed, with at least Own on its page, within the window; someone with Full on the
-- page of every record type it touched, and an admin, at any time — nobody else. A change of someone's access only an
-- admin undoes: it would re-grant what the three rules of P3-4 keep a non-admin from granting.
-- Sabotages: supabase/tests/sabotage/access-undone-by-anyone.sql, supabase/tests/sabotage/the-undo-window-never-closes.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.dep', test.department('undo_five')::text, true);
insert into core.person_profile (person_id, theme) values (current_setting('t.am1')::uuid, 'light');

-- the owner of the record, within the window
select set_config('t.r1', test.act(current_setting('t.admin')::uuid)::text, true);
update core.person_profile set theme = 'dark' where person_id = current_setting('t.am1')::uuid;
select test.done();
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r1')), '42501',
  'someone who neither made a change nor owns the record cannot undo it', 'undo.not_allowed');
select set_config('v2.test_now', (now() + interval '25 hours')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r1')), '42501',
  'the owner cannot undo it after the window', 'undo.not_allowed');
select set_config('v2.test_now', '', true);
select test.as_person(current_setting('t.am1')::uuid);
select api.undo(current_setting('t.r1')::uuid);
select test.as_owner();
select test.eq((select theme from core.person_profile where person_id = current_setting('t.am1')::uuid), 'light',
  'the owner of the record undoes a change made to it within the window');

-- the person who made it, within the window — a setting
select set_config('t.r2', test.act(current_setting('t.am2')::uuid)::text, true);
update core.department set name_en = 'Renamed By A Member' where id = current_setting('t.dep')::uuid;
select test.done();
select set_config('v2.test_now', (now() + interval '25 hours')::text, true);
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r2')), '42501',
  'the person who made a change cannot undo it after the window', 'undo.not_allowed');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r2')), '42501',
  'nor can someone without Full on the page', 'undo.not_allowed');
select test.as_owner();
insert into core.setting (key, department_id, value, valid_from, reason)
values ('audit.undo_window_hours', null, '48', core.riyadh_today(), 'made up for a test');
select test.as_person(current_setting('t.am2')::uuid);
select api.undo(current_setting('t.r2')::uuid);
select test.as_owner();
select test.eq((select name_en from core.department where id = current_setting('t.dep')::uuid), 'Undo Five',
  'the window is a setting: at 48 hours the person who made it undoes it after 25');

-- Full on the page, any time (a head has Full on Partners)
select set_config('v2.test_now', '', true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Undo Co"}') ->> 'id', true);
select set_config('t.r3', test.act(current_setting('t.am1')::uuid)::text, true);
update partner.partner set city = 'Made Up City' where id = current_setting('t.p')::uuid;
select test.done();
select set_config('v2.test_now', (now() + interval '100 hours')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.undo(current_setting('t.r3')::uuid);
select test.as_owner();
select test.eq((select city from partner.partner where id = current_setting('t.p')::uuid), null::text,
  'someone with Full on the page undoes a change long after the window');

-- a change of someone's access: an admin's to undo
select set_config('v2.test_now', '', true);
select set_config('t.r4', test.act(current_setting('t.head')::uuid, 'access.person_level_set')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am1')::uuid, 'kpis', 'view', 'made up: narrowed');
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r4')), '42501',
  'a non-admin cannot undo a change of someone''s access, not even their own change', 'undo.not_allowed');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r4')), '42501',
  'nor the person whose access it was', 'undo.not_allowed');
select test.as_person(current_setting('t.admin')::uuid);
select api.undo(current_setting('t.r4')::uuid);
select test.as_owner();
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'kpis'), 'own'::core.level,
  'an admin undoes it');
