-- FILE-05 — each side has its own files (V98, V152) and a travel policy its review date (V401): a file on one side of an
-- organisation is added by those who may change that side and seen by those who see it — a person shut out of the
-- Client side sees none of its files, in the app or in Storage; a file goes on a side only while it is on; a travel
-- policy is a client's and needs its review date, which whoever may change it moves; on that day the alerts job tells
-- its uploader and the Client side's owner, once. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-sides-file-shows-to-the-other-side.sql,
--            supabase/tests/sabotage/file-review-alerts-every-day.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.desk', test.person('Test Client Desk', 'member')::text, true);
select set_config('t.sup', test.person('Test Supplier Desk', 'manager')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.sup')::uuid, 'clients', 'none', 'made up: suppliers only'),
       (current_setting('t.desk')::uuid, 'suppliers_partners', 'none', 'made up: clients only');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Both Sides Co',
  'sides', jsonb_build_array(
    jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')),
    jsonb_build_object('side', 'supplier_partner', 'type', 'supplier', 'owner_id', current_setting('t.sup'))))) ->> 'id', true);

-- the Supplier & partner side's rate sheet, by the supplier desk
select test.as_person(current_setting('t.sup')::uuid);
select set_config('t.rate', api.file_begin('partner', current_setting('t.p')::uuid, 'rate_sheet', 'attachment', 'rates.pdf',
  1000, 'application/pdf', null, 'supplier_partner')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'files',
  current_setting('t.rate')::jsonb ->> 'path'), 'uploaded');
select api.file_finish((current_setting('t.rate')::jsonb ->> 'id')::uuid, repeat('1', 64));
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L, null, %L)', 'partner', current_setting('t.p'),
  'certificate', 'attachment', 'c.pdf', 1000, 'application/pdf', 'client'), '42501',
  'the supplier desk adds nothing to the Client side', 'access.needs_level');

-- the Client side's travel policy, by the client desk
select test.as_person(current_setting('t.desk')::uuid);
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'),
  'travel_policy', 'travel_policy', 'policy.pdf', 1000, 'application/pdf'), 'P0001', 'a travel policy needs its review date',
  'file.review_date_required');
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L, null, %L, %L)', 'partner', current_setting('t.p'),
  'travel_policy', 'travel_policy', 'policy.pdf', 1000, 'application/pdf', 'supplier_partner', core.riyadh_today() + 30),
  'P0001', 'and is a client''s', 'file.travel_policy_is_a_clients');
select set_config('t.pol', api.file_begin('partner', current_setting('t.p')::uuid, 'travel_policy', 'travel_policy',
  'policy.pdf', 1000, 'application/pdf', null, null, core.riyadh_today() + 30)::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'files',
  current_setting('t.pol')::jsonb ->> 'path'), 'uploaded');
select api.file_finish((current_setting('t.pol')::jsonb ->> 'id')::uuid, repeat('2', 64));
select test.eq((select jsonb_agg(f ->> 'side') from jsonb_array_elements(api.files('partner', current_setting('t.p')::uuid)) f),
  '["client"]'::jsonb, 'the client desk sees the Client side''s file, not the supplier''s');
select test.eq((select count(*)::int from storage.objects where name = current_setting('t.rate')::jsonb ->> 'path'), 0,
  'nor does Storage show it to them');

select test.as_person(current_setting('t.sup')::uuid);
select test.eq((select jsonb_agg(f ->> 'purpose') from jsonb_array_elements(api.files('partner', current_setting('t.p')::uuid)) f),
  '["attachment"]'::jsonb, 'the supplier desk sees its rate sheet, not the travel policy');
select test.eq((select count(*)::int from storage.objects where name = current_setting('t.pol')::jsonb ->> 'path'), 0,
  'nor does Storage');
select test.raises(format('select api.file_review_set(%L, %L)', current_setting('t.pol')::jsonb ->> 'id',
  core.riyadh_today() + 1), '42501', 'nor moves its review date', 'file.not_yours');

select test.as_person(current_setting('t.am1')::uuid);
select test.eq(jsonb_array_length(api.files('partner', current_setting('t.p')::uuid, 'client')), 1,
  'one side''s files, when a side is named');
select api.file_review_set((current_setting('t.pol')::jsonb ->> 'id')::uuid, core.riyadh_today() + 1, 1);
select test.eq((api.files('partner', current_setting('t.p')::uuid, 'client') -> 0 ->> 'review_on')::date,
  core.riyadh_today() + 1, 'the Client side''s owner moves the review date');
select test.raises(format('select api.file_review_set(%L, null, 2)', current_setting('t.pol')::jsonb ->> 'id'), 'P0001',
  'but never clears it', 'file.review_date_required');

select test.as_person(current_setting('t.head')::uuid);
select api.partner_side_off(current_setting('t.p')::uuid, 'supplier_partner', null, 'made up: no longer supplies');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L, null, %L)', 'partner', current_setting('t.p'),
  'rate_sheet', 'attachment', 'late.pdf', 1000, 'application/pdf', 'supplier_partner'), 'P0001',
  'a file goes on a side only while it is on', 'partner.side_not_on');

select test.as_owner();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_file_review'), 0, 'no alert before the day');
select set_config('v2.test_now', (now() + interval '1 day')::text, true);
select notify.generate_alerts();
select test.eq((select array_agg(person_id order by person_id) from notify.notification where kind = 'alert_file_review'),
  (select array_agg(x order by x) from unnest(array[current_setting('t.desk')::uuid, current_setting('t.am1')::uuid]) x),
  'on its review day, its uploader and the Client side''s owner are told');
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_file_review'), 2, 'once');
