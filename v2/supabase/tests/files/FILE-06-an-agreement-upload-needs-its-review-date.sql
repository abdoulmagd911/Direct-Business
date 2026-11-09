-- FILE-06 — an Agreement upload needs its review date (FIX-15, F162): the Agreement kind requires a review
-- date, so file_begin without one is refused, with one it succeeds, and the file carries the date. Every value
-- is made up.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Review Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);

select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'),
  'agreement', 'agreement', 'agreement.pdf', 1000, 'application/pdf'), 'P0001',
  'an Agreement without a review date is refused', 'file.review_date_required');
select set_config('t.ag', api.file_begin('partner', current_setting('t.p')::uuid, 'agreement', 'agreement',
  'agreement.pdf', 1000, 'application/pdf', null, null, core.riyadh_today() + 30)::text, true);
select test.ok((current_setting('t.ag')::jsonb ->> 'id') is not null, 'with a review date it begins');
select test.eq((select f ->> 'review_on' from jsonb_array_elements(api.files('partner', current_setting('t.p')::uuid)) f
  where f ->> 'id' = current_setting('t.ag')::jsonb ->> 'id'), (core.riyadh_today() + 30)::text,
  'and the file carries its review date');
