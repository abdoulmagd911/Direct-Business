-- NORM-02 (NORM-DRIFT) — stored keys stay true (§3.5, A17): after partners and identifiers are made, norm.drift() is
-- empty; when a rule changes (here, a new stop word), drift lists every key that no longer equals its recomputation,
-- and norm.rebuild() mends them in one system request — leaving, and listing, a key that would now collide.
-- Sabotage: supabase/tests/sabotage/drift-sees-nothing.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create('{"trade_name_en": "Made Up Group Travel"}') ->> 'id', true);
select set_config('t.b', api.partner_create('{"trade_name_en": "Made Up Travel"}') ->> 'id', true);
select api.identifier_add(current_setting('t.a')::uuid, 'email', 'desk@example.test', 'made up');
select test.as_owner();
select test.eq((select count(*)::int from norm.drift()), 0, 'drift is empty');

select set_config('t.words', (core.setting_at('partner.name_stop_words', null, core.riyadh_today()) || '["group"]')::text, true);
update core.setting set deleted_at = now(), deleted_by = current_setting('t.head')::uuid, delete_reason = 'made up for a test'
where key = 'partner.name_stop_words' and valid_from = core.riyadh_today() and deleted_at is null;
insert into core.setting (key, department_id, value, valid_from, reason)
values ('partner.name_stop_words', null, current_setting('t.words')::jsonb, core.riyadh_today(), 'made up for a test');
select test.eq((select count(*)::int from norm.drift()), 1, 'a new stop word: drift lists the name key it changes');
select set_config('t.rb', norm.rebuild()::text, true);
select test.eq((current_setting('t.rb')::jsonb ->> 'changed')::int, 0, 'a key that would collide is not changed');
select test.eq(jsonb_array_length(current_setting('t.rb')::jsonb -> 'stuck'), 1, 'but listed for a person');
update partner.partner set trade_name_en = 'Made Up Travel Two' where id = current_setting('t.b')::uuid;
select partner.names_sync(current_setting('t.b')::uuid, 'made up');
select test.eq((norm.rebuild() ->> 'changed')::int, 1, 'once free, rebuild mends it');
select test.eq((select count(*)::int from norm.drift()), 0, 'and drift is empty again');
