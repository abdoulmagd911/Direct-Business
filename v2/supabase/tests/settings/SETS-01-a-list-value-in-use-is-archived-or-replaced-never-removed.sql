-- SETS-01 — setting lists are safe to change (V97; QA-31): "Used in" counts every live record using an entry; an entry
-- in use cannot be removed, and one nothing uses is soft-removed — gone from the list, restorable from Recently
-- deleted; retiring an entry replaces it everywhere in one request, with the count, and one Undo puts it all back; an
-- entry that feeds logic keeps its locked meaning — renamed, never re-meant, removed or retired. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-list-value-in-use-is-removed.sql,
--            supabase/tests/sabotage/a-value-used-in-recently-deleted-is-removed.sql,
--            supabase/tests/sabotage/a-retire-leaves-removed-rows-behind.sql,
--            supabase/tests/sabotage/anyone-retires-a-list-value.sql,
--            supabase/tests/sabotage/retire-rewrites-history.sql,
--            supabase/tests/sabotage/retire-moves-definitions.sql,
--            supabase/tests/sabotage/retire-leaks-a-raw-duplicate.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.corporate', (select id::text from partner.side_type where side = 'client' and key = 'corporate'), true);
select set_config('t.supplier', (select id::text from partner.side_type where side = 'supplier_partner' and key = 'supplier'), true);
select set_config('t.meeting', (select id::text from partner.activity_outcome where key = 'meeting_set'), true);
select set_config('t.mv', (select version::text from partner.activity_outcome where key = 'meeting_set'), true);
select set_config('t.answered', (select id::text from partner.activity_outcome where key = 'answered'), true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.s', api.list_save('side_type', null,
  '{"side": "client", "key": "made_up", "name_en": "Made up", "name_ar": "متخيل"}') ->> 'id', true);
select set_config('t.spare', api.list_save('side_type', null,
  '{"side": "client", "key": "made_up_spare", "name_en": "Made up spare", "name_ar": "متخيل احتياطي"}') ->> 'id', true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Segment Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type_id', current_setting('t.s'))))) ->> 'id', true);

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.list_usage('side_type', current_setting('t.s')::uuid) ->> 'total')::int, 1,
  '"Used in" counts the organisation using it');
select test.raises(format('select api.list_remove(%L, %L)', 'side_type', current_setting('t.s')), 'P0001',
  'a value in use cannot be removed', 'list.in_use');
select test.raises(format('select api.list_retire(%L, %L, %L, %L)', 'side_type', current_setting('t.s'),
  current_setting('t.supplier'), 'made up'), 'P0001', 'a side''s value is replaced from its own side''s list',
  'partner.list_of_other_side');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.list_retire(%L, %L, %L, %L)', 'side_type', current_setting('t.s'),
  current_setting('t.corporate'), 'made up'), '42501', 'only an admin retires a list value (QA-96)', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r', api.list_retire('side_type', current_setting('t.s')::uuid, current_setting('t.corporate')::uuid,
  'made up: folded into Corporate')::text, true);
select test.eq((current_setting('t.r')::jsonb ->> 'moved')::int, 1, 'retiring replaces it everywhere, with the count');
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'sides' -> 0 ->> 'type_id', current_setting('t.corporate'),
  'the organisation now has the replacement');
select test.ok(not exists (select 1 from jsonb_array_elements(api.list('side_type')) x where x ->> 'id' = current_setting('t.s')),
  'the retired entry is archived');
select api.undo((current_setting('t.r')::jsonb ->> 'request_id')::uuid);
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'sides' -> 0 ->> 'type_id', current_setting('t.s'),
  'one Undo puts the organisation back');
select test.ok(exists (select 1 from jsonb_array_elements(api.list('side_type')) x where x ->> 'id' = current_setting('t.s')),
  'and the entry');

select test.eq((api.list_usage('side_type', current_setting('t.spare')::uuid) ->> 'total')::int, 0, 'an unused entry');
select api.list_remove('side_type', current_setting('t.spare')::uuid, 'made up: never used');
select test.ok(not exists (select 1 from jsonb_array_elements(api.list('side_type', true)) x
                           where x ->> 'id' = current_setting('t.spare')), 'is removed from the list');
select test.ok(exists (select 1 from jsonb_array_elements(api.recently_deleted()) x
                       where x ->> 'id' = current_setting('t.spare') and x ->> 'label' = 'Made up spare'),
  'and waits in Recently deleted');
select api.restore('side_type', current_setting('t.spare')::uuid, 'made up: needed after all');
select test.ok(exists (select 1 from jsonb_array_elements(api.list('side_type')) x where x ->> 'id' = current_setting('t.spare')),
  'from where it is restored');

select test.eq((api.list_save('activity_outcome', current_setting('t.meeting')::uuid, '{"name_en": "Meeting booked"}',
                current_setting('t.mv')::int) ->> 'version')::int, current_setting('t.mv')::int + 1,
  'a value with a locked meaning is renamed');
select test.raises(format('select api.list_save(%L, %L, %L)', 'activity_outcome', current_setting('t.meeting'),
  '{"meaning": "demo_set"}'), 'P0001', 'but its meaning never changes', 'list.meaning_locked');
select test.raises(format('select api.list_remove(%L, %L)', 'activity_outcome', current_setting('t.meeting')), 'P0001',
  'nor is it removed', 'list.meaning_locked');
select test.raises(format('select api.list_retire(%L, %L, %L, %L)', 'activity_outcome', current_setting('t.meeting'),
  current_setting('t.answered'), 'made up'), 'P0001', 'nor retired', 'list.meaning_locked');

-- a value is in use by a record waiting in Recently deleted too (QA): restoring it would bring the value back
select test.as_owner();
select set_config('t.visit', (select id::text from partner.activity_type where key = 'visit'), true);
select set_config('t.mtg', (select id::text from partner.activity_type where key = 'meeting'), true);
select set_config('t.price', (select id::text from partner.side_status_reason where key = 'price'), true);
select set_config('t.compet', (select id::text from partner.side_status_reason where key = 'competitor'), true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.role', api.list_save('contact_role', null, '{"key": "made_up_role", "name_en": "Made up role",
  "name_ar": "دور متخيل"}') ->> 'id', true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ct', api.contact_save(current_setting('t.p')::uuid, null,
  jsonb_build_object('name_en', 'Made Up Contact', 'role_id', current_setting('t.role'))) ->> 'id', true);
select api.contacts_remove(array[current_setting('t.ct')::uuid], 'made up: left');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.list_usage('contact_role', current_setting('t.role')::uuid) -> 'uses' -> 0 ->> 'in_recently_deleted', '1',
  'a record in Recently deleted still uses the value, counted apart');
select test.raises(format('select api.list_remove(%L, %L)', 'contact_role', current_setting('t.role')), 'P0001',
  'so the value is not removed from under it', 'list.in_use');
-- retired, the value moves on that record too (QA-97): restored, the contact is on the replacement, never the archive
select set_config('t.role2', api.list_save('contact_role', null, '{"key": "made_up_role_two", "name_en": "Made up role two",
  "name_ar": "دور متخيل ثان"}') ->> 'id', true);
select set_config('t.rc', api.list_retire('contact_role', current_setting('t.role')::uuid, current_setting('t.role2')::uuid,
  'made up: folded together')::text, true);
select test.eq((current_setting('t.rc')::jsonb ->> 'moved_removed')::int, 1,
  'a record waiting in Recently deleted moves too, counted apart');
select test.as_person(current_setting('t.head')::uuid);
select api.restore('contact', current_setting('t.ct')::uuid, 'made up: back after all');
select test.as_owner();
select test.eq((select role_id::text from partner.contact where id = current_setting('t.ct')::uuid),
  current_setting('t.role2'), 'restored, it is on the replacement, never on the archived value');
select test.as_person(current_setting('t.admin')::uuid);

-- history is never rewritten (V161): retiring a reason leaves it on the status changes that gave it, counted apart
select test.as_person(current_setting('t.head')::uuid);
select api.partner_status_set(current_setting('t.p')::uuid, 'client', 'at_risk', null, current_setting('t.price')::uuid,
  'made up: prices');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.rr', api.list_retire('side_status_reason', current_setting('t.price')::uuid,
  current_setting('t.compet')::uuid, 'made up: folded into competitor')::text, true);
select test.eq((current_setting('t.rr')::jsonb ->> 'kept_in_history')::int, 1, 'the status change keeps its reason');
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'sides' -> 0 -> 'status_history' -> 0 ->> 'reason_id',
  current_setting('t.price'), 'as it was given');

-- nor are logged activities or another list's own values moved (V161): retiring an activity type leaves its notes and
-- its outcomes alone
select test.as_person(current_setting('t.head')::uuid);
select api.activity_log(current_setting('t.p')::uuid, 'visit', 'visit_done');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.ra', api.list_retire('activity_type', current_setting('t.visit')::uuid,
  current_setting('t.mtg')::uuid, 'made up: visits are meetings now')::text, true);
select test.eq(current_setting('t.ra')::jsonb - 'request_id', '{"moved": 0, "moved_removed": 0, "kept_in_history": 1, "kept_in_lists": 1}'::jsonb,
  'the visit logged stays a visit, and the visit''s outcome stays the visit''s');

-- a move that would make two live rows one names the rule, never a raw database error: a contract holding both terms
select test.as_person(current_setting('t.head')::uuid);
select api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client', 'title',
  'Made-up rate agreement', 'start_on', core.riyadh_today() - 10, 'terms',
  '[{"term": "corporate_rate", "before": 10, "after": 15}, {"term": "free_cancellation", "before": 1, "after": 3}]'::jsonb));
select test.as_owner();
select set_config('t.rate', (select id::text from partner.term where key = 'corporate_rate'), true);
select set_config('t.free', (select id::text from partner.term where key = 'free_cancellation'), true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.list_retire(%L, %L, %L, %L)', 'contract_term', current_setting('t.rate'),
  current_setting('t.free'),
  'made up: one term'), '23505', 'retiring into a term the same contract already holds is refused by name',
  'list.retire_blocked_by_duplicate');

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.list_usage(%L, %L)', 'side_type', current_setting('t.s')), '42501',
  'lists are Settings: a head neither counts nor changes them', 'access.needs_level');
