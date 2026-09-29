-- SETS-01 — setting lists are safe to change (V97; QA-31): "Used in" counts every live record using an entry; an entry
-- in use cannot be removed, and one nothing uses is soft-removed — gone from the list, restorable from Recently
-- deleted; retiring an entry replaces it everywhere in one request, with the count, and one Undo puts it all back; an
-- entry that feeds logic keeps its locked meaning — renamed, never re-meant, removed or retired. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-list-value-in-use-is-removed.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.corporate', (select id::text from partner.segment where key = 'corporate'), true);
select set_config('t.meeting', (select id::text from partner.call_outcome where key = 'meeting_set'), true);
select set_config('t.mv', (select version::text from partner.call_outcome where key = 'meeting_set'), true);
select set_config('t.answered', (select id::text from partner.call_outcome where key = 'answered'), true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.s', api.list_save('segment', null, '{"key": "made_up", "name_en": "Made up", "name_ar": "متخيل"}')
  ->> 'id', true);
select set_config('t.spare', api.list_save('segment', null,
  '{"key": "made_up_spare", "name_en": "Made up spare", "name_ar": "متخيل احتياطي"}') ->> 'id', true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Segment Co',
  'segment_id', current_setting('t.s'))) ->> 'id', true);

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.list_usage('segment', current_setting('t.s')::uuid) ->> 'total')::int, 1,
  '"Used in" counts the partner using it');
select test.raises(format('select api.list_remove(%L, %L)', 'segment', current_setting('t.s')), 'P0001',
  'a value in use cannot be removed', 'list.in_use');
select set_config('t.r', api.list_retire('segment', current_setting('t.s')::uuid, current_setting('t.corporate')::uuid,
  'made up: folded into Corporate')::text, true);
select test.eq((current_setting('t.r')::jsonb ->> 'moved')::int, 1, 'retiring replaces it everywhere, with the count');
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'segment_id', current_setting('t.corporate'),
  'the partner now has the replacement');
select test.ok(not exists (select 1 from jsonb_array_elements(api.list('segment')) x where x ->> 'id' = current_setting('t.s')),
  'the retired entry is archived');
select api.undo((current_setting('t.r')::jsonb ->> 'request_id')::uuid);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'segment_id', current_setting('t.s'),
  'one Undo puts the partner back');
select test.ok(exists (select 1 from jsonb_array_elements(api.list('segment')) x where x ->> 'id' = current_setting('t.s')),
  'and the entry');

select test.eq((api.list_usage('segment', current_setting('t.spare')::uuid) ->> 'total')::int, 0, 'an unused entry');
select api.list_remove('segment', current_setting('t.spare')::uuid, 'made up: never used');
select test.ok(not exists (select 1 from jsonb_array_elements(api.list('segment', true)) x
                           where x ->> 'id' = current_setting('t.spare')), 'is removed from the list');
select test.ok(exists (select 1 from jsonb_array_elements(api.recently_deleted()) x
                       where x ->> 'id' = current_setting('t.spare') and x ->> 'label' = 'Made up spare'),
  'and waits in Recently deleted');
select api.restore('segment', current_setting('t.spare')::uuid, 'made up: needed after all');
select test.ok(exists (select 1 from jsonb_array_elements(api.list('segment')) x where x ->> 'id' = current_setting('t.spare')),
  'from where it is restored');

select test.eq((api.list_save('call_outcome', current_setting('t.meeting')::uuid, '{"name_en": "Meeting booked"}',
                current_setting('t.mv')::int) ->> 'version')::int, current_setting('t.mv')::int + 1,
  'a value with a locked meaning is renamed');
select test.raises(format('select api.list_save(%L, %L, %L)', 'call_outcome', current_setting('t.meeting'),
  '{"meaning": "demo_set"}'), 'P0001', 'but its meaning never changes', 'list.meaning_locked');
select test.raises(format('select api.list_remove(%L, %L)', 'call_outcome', current_setting('t.meeting')), 'P0001',
  'nor is it removed', 'list.meaning_locked');
select test.raises(format('select api.list_retire(%L, %L, %L, %L)', 'call_outcome', current_setting('t.meeting'),
  current_setting('t.answered'), 'made up'), 'P0001', 'nor retired', 'list.meaning_locked');

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.list_usage(%L, %L)', 'segment', current_setting('t.s')), '42501',
  'lists are Settings: a head neither counts nor changes them', 'access.needs_level');
