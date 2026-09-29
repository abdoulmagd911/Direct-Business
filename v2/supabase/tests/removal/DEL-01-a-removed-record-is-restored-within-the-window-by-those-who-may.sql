-- DEL-01 — Recently deleted (V97, V401; QA-31): nothing is ever physically deleted — a removed record is listed under
-- Recently deleted for audit.recently_deleted_days (30, a setting), to those who may see it, with who removed it and
-- why. Within the window it is restored, in one request that Undo takes back, by whoever removed it, its owner, Full on
-- its page or an admin — not a viewer; never over a live duplicate; after the window it is gone for good. Made up.
-- Sabotages: supabase/tests/sabotage/restore-ignores-the-window.sql,
--            supabase/tests/sabotage/restore-by-rights-then.sql,
--            supabase/tests/sabotage/restore-by-owners-and-full-only.sql,
--            supabase/tests/sabotage/access-restored-by-anyone.sql,
--            supabase/tests/sabotage/restore-by-the-remover-only.sql,
--            supabase/tests/sabotage/restore-ignores-the-record-types-capability.sql,
--            supabase/tests/sabotage/recently-deleted-shows-everything.sql.
-- Its owner restores what someone else removed (QA-60); and bringing a record back asks what adding it asks — an
-- identifier its side's identify capability, a credit limit finance.credit_control (QA-47).
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.pid', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Removals',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.a', api.contact_save(current_setting('t.pid')::uuid, null,
  '{"name_en": "Made Up Contact A", "is_primary": true}') ->> 'id', true);
select set_config('t.c', api.contact_save(current_setting('t.pid')::uuid, null, '{"name_en": "Made Up Contact C"}')
  ->> 'id', true);
select api.contacts_remove(array[current_setting('t.a')::uuid, current_setting('t.c')::uuid], 'made up: left');

select test.as_person(current_setting('t.viewer')::uuid);
select test.eq((select x ->> 'label' || ' · ' || (x ->> 'reason') from jsonb_array_elements(api.recently_deleted()) x
                where x ->> 'id' = current_setting('t.a')), 'Made Up Contact A · made up: left',
  'a removed record is listed with its name and why, to whoever may see it');
select test.raises(format('select api.restore(%L, %L)', 'contact', current_setting('t.a')), '42501',
  'a viewer cannot restore it', 'restore.not_allowed');
select set_config('t.blind', test.person('Test Other Desk', 'member')::text, true);
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.blind')::uuid, 'clients', 'none', 'made up: another desk');
select test.as_person(current_setting('t.blind')::uuid);
select test.ok(not exists (select 1 from jsonb_array_elements(api.recently_deleted()) x
                           where x ->> 'id' = current_setting('t.a')),
  'nobody who may not see a record finds it in Recently deleted (QA-96)');

select test.as_person(current_setting('t.am1')::uuid);
select api.contact_save(current_setting('t.pid')::uuid, null, '{"name_en": "Made Up Contact B", "is_primary": true}');
select test.raises(format('select api.restore(%L, %L)', 'contact', current_setting('t.a')), '23505',
  'a restore never lands on a live duplicate (one primary contact)', 'restore.blocked_by_duplicate');
select set_config('t.r', api.restore('contact', current_setting('t.c')::uuid, 'made up: back') ->> 'request_id', true);
select test.as_owner();
select test.eq((select deleted_at is null from partner.contact where id = current_setting('t.c')::uuid), true,
  'whoever removed it restores it');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.restore(%L, %L)', 'contact', current_setting('t.c')), 'P0001',
  'a live record has nothing to restore', 'restore.not_removed');
select api.undo(current_setting('t.r')::uuid);
select test.as_owner();
select test.eq((select deleted_at is not null from partner.contact where id = current_setting('t.c')::uuid), true,
  'Undo removes it again');

-- whoever removed it, alone: someone neither its owner nor Full on its page restores what they removed — while they
-- still hold Own on it (rights now, V161)
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.d', api.contact_save(current_setting('t.pid')::uuid, null, '{"name_en": "Made Up Contact D",
  "name_ar": "جهة اتصال متخيلة"}') ->> 'id', true);
select api.contacts_remove(array[current_setting('t.d')::uuid], 'made up: wrong one');
select test.eq((select x ->> 'label_ar' from jsonb_array_elements(api.recently_deleted()) x where x ->> 'id' = current_setting('t.d')),
  'جهة اتصال متخيلة', 'Recently deleted names it in Arabic too');
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am2')::uuid, 'clients', 'view', 'made up: moved to another desk');
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.restore(%L, %L)', 'contact', current_setting('t.d')), '42501',
  'with View only now, the one who removed it cannot restore it', 'restore.not_allowed');
select test.as_owner();
update core.person_page_level set level = 'own' where person_id = current_setting('t.am2')::uuid and page_key = 'clients';
select test.as_person(current_setting('t.am2')::uuid);
select test.runs(format('select api.restore(%L, %L, %L)', 'contact', current_setting('t.d'), 'made up: back'),
  'with Own, neither owner nor Full, the one who removed it restores it');
select test.as_owner();

-- access is an admin's to restore (V128), whatever a page grants: were an access table ever registered on an ordinary
-- page, Full on that page would still restore none of its rows (audit.access_tables — the one list undo reads too)
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
update core.entity set page_key = 'clients' where table_name = 'core.person_page_level';
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am1')::uuid, 'pipeline', 'view', 'made up: a level to remove');
select set_config('t.lvl', (select id::text from core.person_page_level
                            where person_id = current_setting('t.am1')::uuid and page_key = 'pipeline'), true);
-- removed as a person's action (a 'ui' request): what the system removes is never restored (DEL-02)
do $$
declare
  r uuid;
begin
  insert into audit.request (actor_id, kind, label_key, reason)
  values (current_setting('t.head')::uuid, 'ui', 'made.up_removed', 'made up: removed') returning id into r;
  perform set_config('app.request_id', r::text, true);
end
$$;
update core.person_page_level set deleted_at = core.clock(), deleted_by = current_setting('t.head')::uuid,
  delete_reason = 'made up: removed' where id = current_setting('t.lvl')::uuid;
select audit.end();
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.restore(%L, %L)', 'person_level', current_setting('t.lvl')), '42501',
  'Full on the page restores no access row, not even one they removed', 'restore.not_allowed');
select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.restore(%L, %L, %L)', 'person_level', current_setting('t.lvl'), 'made up: back'),
  'an admin restores it');
select test.as_owner();

-- the owner restores what someone else removed; someone with Own who is neither owner nor remover does not (QA-60)
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.e', api.contact_save(current_setting('t.pid')::uuid, null, '{"name_en": "Made Up Contact E"}')
  ->> 'id', true);
select api.contacts_remove(array[current_setting('t.e')::uuid], 'made up: removed by the head');
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.restore(%L, %L)', 'contact', current_setting('t.e')), '42501',
  'with Own, neither its owner nor the one who removed it, nobody restores it', 'restore.not_allowed');
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am1')::uuid, 'clients', 'own', 'made up: own work only');
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.restore(%L, %L, %L)', 'contact', current_setting('t.e'), 'made up: mine'),
  'its owner restores what someone else removed');

-- bringing a record back asks what adding it asks (QA-47): its owner, without the capability, restores neither
select test.as_owner();
insert into core.person_capability (person_id, capability_key, granted, reason)
values (current_setting('t.am1')::uuid, 'clients.identify', false, 'made up: no identifiers');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.vat', api.identifier_add(current_setting('t.pid')::uuid, 'vat', '300000000000013', 'made up')
  ->> 'id', true);
select api.identifier_remove(current_setting('t.vat')::uuid, 'made up: typed on the wrong organisation');
select api.credit_limit_set(current_setting('t.pid')::uuid, 50000, null, current_setting('t.admin')::uuid, 'made up');
select set_config('t.cl', (api.credit_limit_set(current_setting('t.pid')::uuid, 60000, null,
  current_setting('t.admin')::uuid, 'made up: raised') ->> 'id'), true);
select test.as_owner();
select set_config('t.cl', (select id::text from partner.credit_limit where partner_id = current_setting('t.pid')::uuid
                           and deleted_at is not null), true);
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.restore(%L, %L)', 'identifier', current_setting('t.vat')), '42501',
  'an identifier comes back only with its side''s identify capability', 'access.needs_capability');
select test.raises(format('select api.restore(%L, %L)', 'credit_limit', current_setting('t.cl')), '42501',
  'a credit limit only with finance.credit_control', 'access.needs_capability');
select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.restore(%L, %L, %L)', 'identifier', current_setting('t.vat'), 'made up: back'),
  'which an admin holds');
select test.as_owner();

-- the window, 31 days on (the test's device stays signed in past its 30 idle days)
select set_config('v2.test_now', (now() + interval '31 days')::text, true);
insert into core.setting (key, department_id, value, valid_from, reason)
values ('auth.device_idle_days', null, '90', core.riyadh_today(), 'made up for a test');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.recently_deleted()) x
                where x ->> 'id' = current_setting('t.c')), 0, 'after the window it is no longer listed');
select test.raises(format('select api.restore(%L, %L)', 'contact', current_setting('t.c')), 'P0001',
  'restore after the window is refused', 'restore.too_late');
select test.as_owner();
insert into core.setting (key, department_id, value, valid_from, reason)
values ('audit.recently_deleted_days', null, '60', core.riyadh_today(), 'made up for a test');
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.restore(%L, %L)', 'contact', current_setting('t.c')),
  'the window is a setting: at 60 days it is restored after 31');
