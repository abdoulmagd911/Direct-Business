-- IMP-07 — one bad row never stops the file (QA-532; D21). A file with a good row and bad ones — a 200-character
-- branch, an over-long ref, lines that are not a list, an unreadable DPIN total, a quantity too large for its column —
-- imports the good row and holds each bad one as unreadable_row with its reason; nothing of a held row is written. Every
-- value is made up.
-- Sabotage: supabase/tests/sabotage/one-bad-row-stops-the-file.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);

select test.as_person(current_setting('t.head')::uuid);
do $$
declare
  r jsonb;
begin
  r := api.finance_import('invoices', jsonb_build_array(
    jsonb_build_object('ref', 'TX-B1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100),
    jsonb_build_object('ref', 'TX-B2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                       'branch', repeat('x', 200)),
    jsonb_build_object('ref', repeat('R', 300), 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100),
    jsonb_build_object('ref', 'TX-B4', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                       'lines', 'not a list'),
    jsonb_build_object('ref', 'BL-B5', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                       'is_consolidated', 'true', 'dpin', 'MADE-UP-DPIN-B5', 'dpin_total', 'a hundred'),
    jsonb_build_object('ref', 'TX-B6', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                       'lines', jsonb_build_array(jsonb_build_object('line_no', 1, 'qty', 1e20, 'total_sar', 100)))),
    now() - interval '1 day');
  perform test.eq(jsonb_build_object('new', r -> 'counts' -> 'new', 'held', r -> 'counts' -> 'held'),
    '{"new": 1, "held": 5}'::jsonb, 'the good row imports and each bad row is held');
exception when others then
  perform test.fail(format('the good row imports and each bad row is held — %s', sqlerrm));
end
$$;
select test.as_owner();
select test.eq((select jsonb_agg(ref order by ref) from finance.invoice), '["TX-B1"]'::jsonb,
  'nothing of a held row is written');
select test.eq((select jsonb_agg(jsonb_build_array(h.row_no, h.reason_key, h.detail) order by h.row_no)
                from finance.import_held h where h.row_no <> 5),
  '[[2, "unreadable_row", "invoice_branch_check"], [3, "unreadable_row", "invoice_ref_check"],
    [4, "bad_amount", "100"], [6, "unreadable_row", "numeric field overflow"]]'::jsonb,
  'each held with its reason: the check it broke, or the message');
select test.ok((select h.reason_key = 'unreadable_row' and h.detail like 'invalid input syntax for type numeric%'
                from finance.import_held h where h.row_no = 5), 'an unreadable DPIN total is held too');
