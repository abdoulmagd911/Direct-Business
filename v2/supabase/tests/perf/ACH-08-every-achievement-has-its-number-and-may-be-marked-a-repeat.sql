-- ACH-08 — numbers and repeats (V531). Every achievement gets ACH-<its year>-0042 from the app — a 2025 one in 2025, a
-- draft in the year it is logged — and the number never changes; the list finds it by its number. The repeat check
-- finds an earlier achievement for the same organisation and category in the last 12 months with a similar title —
-- never another organisation's, never an older one; "This is a new one" saves it linked with repeat_of; a repeat of an
-- unrelated achievement is refused; a paste never prompts but names its possible repeats. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-repeat-found-at-another-organisation.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select api.plan_open(test.department('commercial'), 2025);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.org', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Repeat Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.mgr'))))) ->> 'id', true);
select set_config('t.org2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Other Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.mgr'))))) ->> 'id', true);

-- numbers
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up travel award',
  'happened_on', '2026-03-05', 'partner_id', current_setting('t.org'))) ->> 'id', true);
select test.ok((api.achievement(current_setting('t.a')::uuid) ->> 'number') ~ '^ACH-2026-[0-9]{4}$', 'ACH-2026-0001');
select set_config('t.n', api.achievement(current_setting('t.a')::uuid) ->> 'number', true);
select test.ok((api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up 2025 award',
  'happened_on', '2025-12-30')) ->> 'number') like 'ACH-2025-%', 'a 2025 achievement is numbered in 2025');
select test.ok((api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up undated'))
  ->> 'number') like 'ACH-2026-%', 'a draft takes the year it is logged');
select test.eq((api.achievements(jsonb_build_object('q', current_setting('t.n'))) ->> 'total')::int, 1,
  'the list finds it by its number');
select test.as_owner();
select test.raises(format($$update perf.achievement set number = 'ACH-2026-9999' where id = %L$$, current_setting('t.a')),
  'P0001', 'the number never changes', 'achievement.number_fixed');

-- repeats
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(jsonb_array_length(api.achievement_repeats(current_setting('t.org')::uuid, 'award',
  'Made up travel award!', '2026-09-20')), 1, 'a similar title, same organisation and category, is a possible repeat');
select test.eq(api.achievement_repeats(current_setting('t.org')::uuid, 'AWARD', 'Made-up travel award', '2026-09-20')
  -> 0 ->> 'number', current_setting('t.n'), 'named by its number');
select test.eq(api.achievement_repeats(current_setting('t.org2')::uuid, 'AWARD', 'Made-up travel award', '2026-09-20'),
  '[]'::jsonb, 'never another organisation''s');
select test.eq(api.achievement_repeats(current_setting('t.org')::uuid, 'COST', 'Made-up travel award', '2026-09-20'),
  '[]'::jsonb, 'never another category''s');
select test.eq(api.achievement_repeats(current_setting('t.org')::uuid, 'AWARD', 'Made-up travel award', '2027-03-06'),
  '[]'::jsonb, 'never one older than 12 months');
select test.eq(api.achievement_repeats(current_setting('t.org')::uuid, 'AWARD', 'Quarterly cost review', '2026-09-20'),
  '[]'::jsonb, 'never an unlike title');
select set_config('t.b', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up travel award',
  'happened_on', '2026-09-20', 'partner_id', current_setting('t.org'), 'repeat_of', current_setting('t.a'))) ->> 'id', true);
select test.eq(api.achievement(current_setting('t.b')::uuid) ->> 'repeat_of_number', current_setting('t.n'),
  'This is a new one: saved, linked to the earlier one');
select test.raises(format('select api.achievement_log(%L::jsonb)', jsonb_build_object('category', 'AWARD',
  'title', 'Made up', 'partner_id', current_setting('t.org2'), 'repeat_of', current_setting('t.a'))),
  'P0001', 'a repeat of another organisation''s is refused', 'achievement.repeat_invalid');

-- a paste names its possible repeats, never prompts
select set_config('t.p', api.backfill_achievements(jsonb_build_object('mode', 'achievements', 'origin', 'backfill',
  'source', jsonb_build_object('kind', 'bd_monthly', 'period', '2026-04', 'last_day', '2026-04-30'),
  'rows', jsonb_build_array(jsonb_build_object('title', 'Made-up travel award', 'happened_on', '2026-04-02',
    'kind', 'AWARD', 'organisation_id', current_setting('t.org'), 'import_key', 'made-up-repeat-1'))))::text, true);
select test.eq((current_setting('t.p')::jsonb ->> 'saved')::int, 1, 'a paste saves its row');
select test.eq(jsonb_array_length(current_setting('t.p')::jsonb -> 'repeats' -> 0 -> 'matches') >= 1, true,
  'and names its possible repeats');
