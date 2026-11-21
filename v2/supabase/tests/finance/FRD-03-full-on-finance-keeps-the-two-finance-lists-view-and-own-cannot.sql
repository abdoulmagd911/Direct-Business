-- FRD-03 — the two lists V627 keeps on the finance page are kept by Full on Finance, not only by admins (QA-539; V627,
-- V613, V622). A head with Full on Finance — no admin — adds a channel and an import column, and edits the channel; a
-- member held at Own on Finance and a viewer with View on Finance are refused both. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-finance-lists-are-admins-only.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
-- Landing 34b (the owner, 21 Nov 2026): a Team member now starts at Full on Finance. The rule here is about the
-- LEVEL, so this member is held at Own — one step below Full — by a person override, as an admin would in Settings.
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.mem')::uuid, 'finance', 'own', 'made up: held at Own on Finance');
select set_config('t.view', test.person('Test Viewer', 'viewer')::text, true);

select test.as_person(current_setting('t.head')::uuid);
do $$
begin
  perform set_config('t.c', api.list_save('channel', null,
    '{"key": "made_up_desk", "name_en": "Made-up desk", "name_ar": "Made-up desk"}', null, 'made up: a new desk') ->> 'id', true);
  perform api.list_save('import_map', null,
    '{"source": "expenses", "header": "Made Up Amount", "name_en": "Made Up Amount", "name_ar": "Made Up Amount",
      "field": "amount_sar"}', null, 'made up: a renamed column');
  perform api.list_save('channel', current_setting('t.c')::uuid, '{"name_en": "Made-up desk (walk-in)"}', 1,
                        'made up: renamed');
exception when others then
  perform test.fail(format('Full on Finance, not an admin, adds and edits the two Finance lists — %s', sqlerrm));
end
$$;
select test.as_owner();
select test.eq((select name_en from finance.channel where key = 'made_up_desk'), 'Made-up desk (walk-in)',
  'the channel is added and renamed');
select test.eq((select count(*)::int from finance.import_map where header = 'Made Up Amount'), 1, 'the column is added');

select test.as_person(current_setting('t.mem')::uuid);
select test.raises($$select api.list_save('channel', null, '{"key": "made_up_two", "name_en": "Two", "name_ar": "Two"}')$$,
  '42501', 'Own on Finance adds no channel');
select test.raises($$select api.list_save('import_map', null,
  '{"source": "expenses", "header": "Made Up Two", "name_en": "Made Up Two", "name_ar": "Made Up Two", "field": "merchant"}')$$,
  '42501', 'Own on Finance adds no import column');
select test.as_person(current_setting('t.view')::uuid);
select test.raises($$select api.list_save('channel', null, '{"key": "made_up_three", "name_en": "Three", "name_ar": "Three"}')$$,
  '42501', 'View on Finance adds no channel');
select test.raises($$select api.list_save('import_map', null,
  '{"source": "expenses", "header": "Made Up Three", "name_en": "Made Up Three", "name_ar": "Made Up Three", "field": "merchant"}')$$,
  '42501', 'View on Finance adds no import column');
