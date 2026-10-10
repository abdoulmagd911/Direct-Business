-- IMP-03 — the import's column mapping is a setting (V622 (2), §3.11 step 1). The ported maps are seeded; a header row
-- is recognised with each header's field, ignoring spaces, `_ - . : ( ) /` and case; a file missing a required header is
-- not recognised and the missing ones are named. An admin adds a header through the list door — logged, and Undo takes
-- it back — and the next file with that header is read by it; a field the door does not take, a header that is only
-- signs, and a second copy of a header are refused. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-header-is-compared-letter-for-letter.sql.
select set_config('t.adm', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.adm')::uuid);

select test.eq((select count(*)::int from jsonb_array_elements(api.finance_import_map('invoices'))), 25,
  'the all-invoices map is seeded');
select test.eq((select count(*)::int from jsonb_array_elements(api.finance_import_map('expenses'))), 11,
  'the Transaction Expense Export map is seeded');

select test.eq(api.finance_import_recognise('expenses', array['invoice #', 'AMOUNT_SAR', 'expense-type', ' Status ', 'Colour'])
                 - 'source',
  '{"columns": [{"header": "invoice #", "field": "ref"}, {"header": "AMOUNT_SAR", "field": "amount_sar"},
                {"header": "expense-type", "field": "expense_type"}, {"header": " Status ", "field": "status"},
                {"header": "Colour", "field": null}],
    "missing": [], "recognised": true}'::jsonb,
  'a header row is recognised by the map, spaces, signs and case ignored; an unknown column feeds nothing');
select test.eq(api.finance_import_recognise('invoices', array['Type', 'Invoice Reference #', 'Invoice Total']) -> 'missing',
  '["Customer Name", "Item Is Taxable"]'::jsonb, 'a file without a required header names the missing ones');
select test.eq((api.finance_import_recognise('invoices', array['Type', 'Invoice Reference #']) ->> 'recognised')::boolean, false,
  'and is not read as that export');
select test.raises($$select api.finance_import_recognise('payroll', array['Type'])$$, 'P0001', 'an unknown export is refused',
  'common.invalid');

select set_config('t.r', api.list_save('import_map', null,
  '{"source": "expenses", "header": "Expense Amount", "name_en": "Expense Amount", "name_ar": "Expense Amount", "field": "amount_sar"}', null, 'made up: a renamed column')::text, true);
select test.eq(api.finance_import_recognise('expenses', array['Expense Amount']) -> 'columns',
  '[{"header": "Expense Amount", "field": "amount_sar"}]'::jsonb, 'an admin adds a header and the next file is read by it');
select test.raises($$select api.list_save('import_map', null, '{"source": "expenses", "header": "Colour", "name_en": "Colour", "name_ar": "Colour", "field": "colour"}')$$,
  'P0001', 'a field the import door does not take is refused', 'list.invalid');
select test.raises($$select api.list_save('import_map', null, '{"source": "expenses", "header": " - / ", "name_en": " - / ", "name_ar": " - / ", "field": "merchant"}')$$,
  'P0001', 'a header that is only signs is refused', 'list.invalid');
select test.raises($$select api.list_save('import_map', null, '{"source": "expenses", "header": "MERCHANT", "name_en": "MERCHANT", "name_ar": "MERCHANT", "field": "merchant"}')$$,
  '23505', 'a second copy of a header is refused', 'list.key_taken');

select api.undo((current_setting('t.r')::jsonb ->> 'request_id')::uuid);
select test.eq(api.finance_import_recognise('expenses', array['Expense Amount']) -> 'columns',
  '[{"header": "Expense Amount", "field": null}]'::jsonb, 'Undo takes the header back');

select test.as_person(test.person('Test Member', 'member'));
select test.raises($$select api.list_save('import_map', null, '{"source": "expenses", "header": "Fee", "name_en": "Fee", "name_ar": "Fee", "field": "amount_sar"}')$$,
  '42501', 'only an admin changes the map', 'access.needs_level');
