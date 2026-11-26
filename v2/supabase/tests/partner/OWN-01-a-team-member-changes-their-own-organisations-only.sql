-- OWN-01 — Landing 55 (the owner's approved design of 22 Nov 2026: "Member: can add, edit and delete anything for
-- their own clients. Cannot edit someone else's work."). A team member starts at Own on the organisation pages. On an
-- organisation owned by a colleague every save is refused by the database — its details, a contact, a contract, a
-- file, its status, its side, archive and removal — while reading stays open. Their own organisation they change in
-- full, and one they add is theirs. "Edit someone else's work — Allowed" opens a colleague's to that one person
-- only. A note or a logged activity is the writer's own entry and stays open. A manager keeps Full; a Viewer changes
-- nothing; the Finance levels are not touched. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-team-member-starts-at-full-on-organisations.sql,
--            supabase/tests/sabotage/own-changes-any-organisation.sql,
--            supabase/tests/sabotage/own-does-not-change-its-own-organisation.sql,
--            supabase/tests/sabotage/own-cannot-add-an-organisation.sql,
--            supabase/tests/sabotage/own-removes-a-colleagues-organisation.sql,
--            supabase/tests/sabotage/allowed-does-not-reach-a-colleagues-organisation.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.b', test.person('Test Member B', 'member')::text, true);
select set_config('t.c', test.person('Test Member C', 'member')::text, true);
select set_config('t.v', test.person('Test Viewer', 'viewer')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.a')::uuid, current_setting('t.b')::uuid,
             current_setting('t.c')::uuid, current_setting('t.v')::uuid);

-- the role
select test.as_person(current_setting('t.b')::uuid);
select test.eq(api.me() -> 'levels' ->> 'clients', 'own', 'a team member starts at Own on Partners');
select test.eq(api.me() -> 'levels' ->> 'suppliers_partners', 'own', 'and on Suppliers & partners');
-- Finance has its own rule (Landing 56, "Own clients only"): a team member is at Own there too, which OWN-02 pins
select test.eq(api.me() -> 'levels' ->> 'finance', 'own', 'Finance follows its own rule: Own (Landing 56)');
select test.eq(api.me() -> 'levels' ->> 'partner_finance', 'own', 'and on an organisation''s Finance tab');

-- A's client, made by a manager, with a contact
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Own01 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.a'))))) ->> 'id', true);
select set_config('t.k', api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Made Up Contact"}') ->> 'id', true);

-- every save a colleague could try on it
create temporary table own01_try (what text, sql text) on commit drop;
grant select on own01_try to public;
insert into own01_try values
  ('change its details', format('select api.partner_update(%L, %L::jsonb, 1, %L)', current_setting('t.p'), '{"city": "Made Up City"}', 'made up')),
  ('add a contact', format('select api.contact_save(%L, null, %L::jsonb)', current_setting('t.p'), '{"name_en": "Made Up Second Contact"}')),
  ('change a contact', format('select api.contact_save(%L, %L, %L::jsonb, 1)', current_setting('t.p'), current_setting('t.k'), '{"name_en": "Made Up Renamed"}')),
  ('remove a contact', format('select api.contacts_remove(array[%L]::uuid[], %L)', current_setting('t.k'), 'made up')),
  ('add a contract', format('select api.contract_save(%L, null, %L::jsonb, null, %L)', current_setting('t.p'), '{"title": "Made up", "side": "client"}', 'made up')),
  ('add a file', format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'certificate', 'attachment', 'c.pdf', 1000, 'application/pdf')),
  ('set its status', format('select api.partner_status_set(%L, %L, %L)', current_setting('t.p'), 'client', 'active')),
  ('change its side', format('select api.partner_side_set(%L, %L, %L::jsonb)', current_setting('t.p'), 'client', '{"type": "corporate"}')),
  ('add a side', format('select api.partner_side_set(%L, %L, %L::jsonb)', current_setting('t.p'), 'supplier_partner', '{"type": "supplier"}')),
  ('archive it', format('select api.partner_archive(%L, %L)', current_setting('t.p'), 'made up')),
  ('remove it', format('select api.partner_remove(%L, %L)', current_setting('t.p'), 'made up'));

-- by role: a colleague reads it, and every save is refused
select test.as_person(current_setting('t.b')::uuid);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'trade_name_en', 'Made Up Own01 Co', 'a colleague still reads the organisation');
select test.raises(x.sql, '42501', 'a team member cannot ' || x.what || ' on a colleague''s organisation', 'access.needs_level')
from own01_try x;
select test.as_owner();
select test.eq((select count(*)::int from audit.change c join audit.request q on q.id = c.request_id
                where q.actor_id = current_setting('t.b')::uuid), 0, 'and nothing was written');

-- a note and a logged activity are the writer's own entries: still open
select test.as_person(current_setting('t.b')::uuid);
select test.ok(api.note_add('partner', current_setting('t.p')::uuid, 'comment', 'Made-up note by a colleague') ->> 'id' <> '',
  'a colleague still writes a note on it');
select test.ok(api.activity_log(current_setting('t.p')::uuid, 'call', 'answered') ->> 'id' <> '', 'and logs a call with it');

-- a Viewer changes nothing
select test.as_person(current_setting('t.v')::uuid);
select test.raises(x.sql, '42501', 'a Viewer cannot ' || x.what) from own01_try x;

-- its owner changes it in full
select test.as_person(current_setting('t.a')::uuid);
select test.runs(format('select api.partner_update(%L, %L::jsonb, 1, %L)', current_setting('t.p'), '{"city": "Made Up City"}', 'made up: moved'),
  'its owner changes its details');
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'city', 'Made Up City', 'and they are changed');
select set_config('t.k2', api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Made Up Second Contact"}') ->> 'id', true);
select test.ok(current_setting('t.k2') <> '', 'adds a contact');
select test.runs(format('select api.contacts_remove(array[%L]::uuid[], %L)', current_setting('t.k2'), 'made up: a duplicate'), 'removes one');
select test.runs(format('select api.contract_save(%L, null, %L::jsonb, null, %L)', current_setting('t.p'),
  jsonb_build_object('side', 'client', 'title', 'Made-up corporate rates', 'start_on', core.riyadh_today(), 'end_on', core.riyadh_today() + 365),
  'made up'), 'adds a contract');
select test.runs(format('select api.partner_side_set(%L, %L, %L::jsonb)', current_setting('t.p'), 'client', '{"type": "corporate"}'),
  'changes its side');
select test.runs(format('select api.partner_archive(%L, %L)', current_setting('t.p'), 'made up: paused'), 'archives it');
select test.runs(format('select api.partner_unarchive(%L, %L)', current_setting('t.p'), 'made up: back'), 'and brings it back');

-- one a team member adds is theirs
select test.as_person(current_setting('t.b')::uuid);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Own01 Second Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select test.eq(api.partner(current_setting('t.q')::uuid) ->> 'owner_id', current_setting('t.b'), 'a team member adds an organisation, and it is theirs');
select test.runs(format('select api.partner_update(%L, %L::jsonb, 1, %L)', current_setting('t.q'), '{"city": "Made Up Town"}', 'made up'),
  'so they change it');
select test.raises(format('select api.partner_create(%L::jsonb)', jsonb_build_object('trade_name_en', 'Made Up Own01 Third Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.a'))))),
  '42501', 'but they add none in a colleague''s name');
select test.as_person(current_setting('t.a')::uuid);
select test.raises(format('select api.partner_remove(%L, %L)', current_setting('t.q'), 'made up'), '42501',
  'and a colleague cannot remove it', 'access.needs_level');
select test.as_person(current_setting('t.b')::uuid);
select test.runs(format('select api.partner_remove(%L, %L)', current_setting('t.q'), 'made up: a duplicate'), 'they remove their own');

-- "Edit someone else's work — Allowed": that one person changes a colleague's
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_capability(current_setting('t.b')::uuid, 'records.edit_others', true, 'made up: covers for A');
select test.as_person(current_setting('t.b')::uuid);
select test.runs(format('select api.partner_update(%L, %L::jsonb, %s, %L)', current_setting('t.p'), '{"city": "Made Up Port"}',
  api.partner(current_setting('t.p')::uuid) ->> 'version', 'made up: covering'), 'Allowed: they change a colleague''s organisation');
select test.ok(api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Made Up Third Contact"}') ->> 'id' <> '', 'and add a contact to it');
select test.as_person(current_setting('t.c')::uuid);
select test.raises(format('select api.contact_save(%L, null, %L::jsonb)', current_setting('t.p'), '{"name_en": "Made Up Fourth Contact"}'),
  '42501', 'the setting changed that one person only', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select api.access_clear_person_capability(current_setting('t.b')::uuid, 'records.edit_others', 'made up: A is back');
select test.as_person(current_setting('t.b')::uuid);
select test.raises(format('select api.contact_save(%L, null, %L::jsonb)', current_setting('t.p'), '{"name_en": "Made Up Fifth Contact"}'),
  '42501', 'As their role: a colleague''s organisation is closed to them again', 'access.needs_level');

-- a manager keeps Full
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(api.me() -> 'levels' ->> 'clients', 'full', 'a manager keeps Full on Partners');
select test.ok(api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Made Up Sixth Contact"}') ->> 'id' <> '',
  'and changes an organisation they do not own');
