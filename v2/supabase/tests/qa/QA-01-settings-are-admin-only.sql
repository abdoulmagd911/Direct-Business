-- QA-01 — Settings are admin-only (owner decision, 29 Sep 2026): no role but the admin role reads or changes a settings
-- group, a setting list or the block list; My profile stays each person's own. Written by the QA auditor to fail until
-- the rule is built: on v2/main at 72577fa the head role starts with Full on Settings → Finance, Partners, Performance
-- and Work and View on App and Organization & access, managers and members with View on some (registry.json).
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-01. Made-up people only.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.view', test.person('Test Viewer', 'viewer')::text, true);

select test.as_owner();
select test.eq((select count(*)::int from core.role_page_level l join core.role r on r.id = l.role_id
                where not r.is_admin and l.deleted_at is null and l.page_key like 'settings.%'
                  and l.page_key <> 'settings.profile' and l.level <> 'none'), 0,
  'no role but the admin role starts with a level on a settings page');

select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.setting_set('work.no_update_days', null, '30', null, 'made up')$$, '42501',
  'a head cannot change a Work setting');
select test.raises($$select api.list_save('side_type', null,
  '{"side": "client", "key": "made_up_segment", "name_en": "Made up", "name_ar": "مختلق"}', null, 'made up')$$, '42501',
  'a head cannot add to a setting list');
select test.raises($$select api.identifier_block_add('email', 'domain', 'example.org', 'made up')$$, '42501',
  'a head cannot change the block list');
select test.raises($$select api.settings('settings.org')$$, '42501', 'a head does not read Organization & access');
select test.raises($$select api.people()$$, '42501', 'nor the people list with everyone''s allowed emails');

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises($$select api.settings('settings.partners')$$, '42501', 'a manager does not read Settings → Partners');
select test.as_person(current_setting('t.mem')::uuid);
select test.raises($$select api.settings('settings.finance')$$, '42501', 'a member does not read Settings → Finance');
select test.as_person(current_setting('t.view')::uuid);
select test.raises($$select api.settings('settings.performance')$$, '42501',
  'a viewer does not read Settings → Performance');
