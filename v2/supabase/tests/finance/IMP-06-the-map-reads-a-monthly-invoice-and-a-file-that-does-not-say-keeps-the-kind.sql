-- IMP-06 — the column map reads a monthly invoice (QA-529; V616, V622 (2), D21). The seeded map feeds the
-- consolidation, client ID and discount code columns; a monthly invoice imported with them is a billing invoice and its
-- transaction is linked; a newer file without those columns keeps the stored kind instead of failing the whole file; a
-- line with no number is numbered by its place. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-file-that-does-not-say-resets-the-kind.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.finance_import_recognise('invoices', array['is_consolidated', 'consolidated_proforma_id',
                                                               'B2B Transaction Status', 'Client ID #', 'Discount Code']) -> 'columns',
  '[{"header": "is_consolidated", "field": "is_consolidated"}, {"header": "consolidated_proforma_id", "field": "consolidated_ref"},
    {"header": "B2B Transaction Status", "field": "consolidation_status"}, {"header": "Client ID #", "field": "client_id"},
    {"header": "Discount Code", "field": "discount_code"}]'::jsonb,
  'the seeded map feeds the consolidation, client ID and discount code columns');

select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'BL-61Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900,
                     'is_consolidated', 'true', 'client_id', '86161'),
  jsonb_build_object('ref', 'TX-61Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900,
                     'consolidated_ref', 'BL-61Q', 'client_id', '86161',
                     'lines', jsonb_build_array(jsonb_build_object('name', 'Made up hotel', 'total_sar', 600),
                                                jsonb_build_object('name', 'Made up flight', 'total_sar', 300)))),
  now() - interval '2 days');
do $$
begin
  perform test.eq(api.finance_import('invoices', jsonb_build_array(
    jsonb_build_object('ref', 'BL-61Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900)),
    now() - interval '1 day') -> 'counts' ->> 'held', '0', 'a newer file without the consolidation columns imports');
exception when sqlstate 'P0001' then
  perform test.fail(format('a newer file without the consolidation columns imports — %s', sqlerrm));
end
$$;
select test.as_owner();
select test.eq((select jsonb_object_agg(ref, kind) from finance.invoice where ref in ('BL-61Q', 'TX-61Q')),
  '{"BL-61Q": "billing", "TX-61Q": "transaction"}'::jsonb, 'and keeps the stored kind; the transaction stays linked');
select test.eq((select count(*)::int from finance.billing_link l join finance.invoice b on b.id = l.billing_invoice_id
                where b.ref = 'BL-61Q' and l.deleted_at is null), 1, 'the link stands');
select test.eq((select jsonb_agg(x.line_no order by x.line_no) from finance.invoice_line x join finance.invoice i on i.id = x.invoice_id
                where i.ref = 'TX-61Q' and x.deleted_at is null), '[1, 2]'::jsonb,
  'lines with no number are numbered by their place');
