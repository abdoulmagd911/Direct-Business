-- DEL-03 — QA-576: Recently deleted offers Restore only where pressing it would work. api.restorable takes the listed
-- rows and returns the "entity:id" keys this person may restore: whoever removed it, its owner, Full on its page, an
-- admin — not a viewer who can only see it. It changes no rule (core.restore still decides). Made up.
-- Sabotage: supabase/tests/sabotage/restorable-says-yes-to-everyone.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.pid', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Restorable',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.c', api.contact_save(current_setting('t.pid')::uuid, null, '{"name_en": "Made Up Contact R"}') ->> 'id', true);
select api.contacts_remove(array[current_setting('t.c')::uuid], 'made up: left');
select set_config('t.items', jsonb_build_array(jsonb_build_object('entity', 'contact', 'id', current_setting('t.c')))::text, true);

select test.eq(api.restorable(current_setting('t.items')::jsonb), jsonb_build_array('contact:' || current_setting('t.c')),
  'whoever removed it is offered Restore');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(api.restorable(current_setting('t.items')::jsonb), '[]'::jsonb,
  'a viewer sees it listed but is not offered Restore');
select test.raises(format('select api.restore(%L, %L)', 'contact', current_setting('t.c')), '42501',
  'and pressing it would have been refused', 'restore.not_allowed');
