-- FRD-02 — one search, both numbers (the screens brief I.5; V617 (3)). The transaction number and the tax invoice number
-- (DPIN) are two fields: a search finds an invoice by either, comparing letters and digits only, shows both numbers apart and
-- says which one matched; an exact number comes first. A transaction billed in a monthly invoice carries that
-- invoice's DPIN, in the search and in the unit list, where the DPIN stands beside the transaction number.
-- Text shorter than two characters finds nothing; no sign in the text is a wildcard. Every value is made up.
-- Sabotage: supabase/tests/sabotage/search-finds-only-the-transaction-number.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month' + interval '9 days')::date::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-5101', 'consolidated_ref', 'BL-7701', 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'paid_on', current_setting('t.d'), 'total_sar', 200),
  jsonb_build_object('ref', 'BL-7701', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'paid_on', current_setting('t.d'), 'total_sar', 200, 'dpin', 'DP-5101'),
  jsonb_build_object('ref', 'SA-5101', 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'paid_on', current_setting('t.d'), 'total_sar', 90, 'dpin', 'DP-8800'),
  jsonb_build_object('ref', 'TX-5102', 'status', 'Fully Paid', 'created_on', (current_setting('t.d')::date + 1)::text,
                     'paid_on', (current_setting('t.d')::date + 1)::text, 'total_sar', 60),
  jsonb_build_object('ref', 'TX-51010', 'status', 'Fully Paid', 'created_on', (current_setting('t.d')::date + 2)::text,
                     'paid_on', (current_setting('t.d')::date + 2)::text, 'total_sar', 40)),
  now() - interval '1 day');

select test.eq((select jsonb_agg(jsonb_build_object('ref', x ->> 'ref', 'dpin', x ->> 'dpin', 'matched', x ->> 'matched'))
                from jsonb_array_elements(api.finance_search('dp-8800')) x),
  '[{"ref": "SA-5101", "dpin": "DP-8800", "matched": "dpin"}]'::jsonb,
  'a tax invoice number finds its invoice, and the hit shows both numbers apart');
select test.eq((select jsonb_agg(x ->> 'ref') from jsonb_array_elements(api.finance_search(' bl 7701 ')) x),
  '["BL-7701"]'::jsonb, 'a transaction number finds its invoice, spaces, dashes and case ignored');
select test.eq((select jsonb_agg(jsonb_build_object('ref', x ->> 'ref', 'matched', x ->> 'matched') order by x ->> 'ref')
                from jsonb_array_elements(api.finance_search('5101')) x),
  '[{"ref": "BL-7701", "matched": "dpin"}, {"ref": "SA-5101", "matched": "ref"}, {"ref": "TX-5101", "matched": "both"},
    {"ref": "TX-51010", "matched": "ref"}]'::jsonb,
  'part of a number finds every invoice holding it in either field');
select test.eq((select jsonb_agg(jsonb_build_object('ref', x ->> 'ref', 'dpin', x ->> 'dpin', 'billing_ref', x ->> 'billing_ref')
                                 order by x ->> 'ref')
                from jsonb_array_elements(api.finance_search('DP5101')) x),
  '[{"ref": "BL-7701", "dpin": "DP-5101", "billing_ref": null}, {"ref": "TX-5101", "dpin": "DP-5101", "billing_ref": "BL-7701"}]'::jsonb,
  'a monthly invoice''s DPIN finds it and each transaction billed in it, naming the monthly invoice');
select test.eq((select jsonb_agg(x ->> 'ref') from jsonb_array_elements(api.finance_search('TX-510')) x),
  '["TX-51010", "TX-5102", "TX-5101"]'::jsonb, 'newest first when no number is exact');
select test.eq((select jsonb_agg(x ->> 'ref') from jsonb_array_elements(api.finance_search('TX-5101')) x),
  '["TX-5101", "TX-51010"]'::jsonb, 'an exact number comes first, before a newer one that only starts with it');
select test.eq(api.finance_search('5'), '[]'::jsonb, 'one character finds nothing');
select test.eq(api.finance_search('T%1'), '[]'::jsonb, 'a % is never a wildcard');

select test.eq((select jsonb_agg(jsonb_build_object('ref', ref, 'dpin', dpin) order by ref)
                from api.finance_period_units(current_setting('t.d')::date, current_setting('t.d')::date + 1)
                where ref in ('SA-5101', 'TX-5101', 'TX-5102')),
  '[{"ref": "SA-5101", "dpin": "DP-8800"}, {"ref": "TX-5101", "dpin": "DP-5101"}, {"ref": "TX-5102", "dpin": null}]'::jsonb,
  'the unit list carries the DPIN beside the transaction number, a billed one its monthly invoice''s');
