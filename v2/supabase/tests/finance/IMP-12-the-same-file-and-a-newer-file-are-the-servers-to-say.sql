-- IMP-12 — "the same file" and "a newer file" are the server's to say (QA-539; §3.11.6, D21). The same rows with the same
-- export time are the same file whatever sha-256 the browser sends; different rows sent with a repeated sha-256 are a
-- new file; a file exported before one already imported is read and its answer says older_than; an older file that
-- fills a blank never lowers the field's recorded time. Every value is made up.
-- Sabotages: supabase/tests/sabotage/the-same-file-is-the-callers-to-say.sql,
-- supabase/tests/sabotage/filling-a-blank-lowers-its-time.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 8)::text, true);
select set_config('t.t', (now() - interval '2 hours')::text, true);
select set_config('t.sha', repeat('a', 64), true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-N1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100)),
  current_setting('t.t')::timestamptz, 'made-up-1.xlsx', current_setting('t.sha'));
do $$
begin
  perform test.ok(api.finance_import('invoices', jsonb_build_array(
    jsonb_build_object('ref', 'TX-N1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100)),
    current_setting('t.t')::timestamptz, 'made-up-1-again.xlsx', repeat('b', 64)) ? 'already_imported',
    'the same rows and export time are the same file whatever sha-256 is sent');
exception when others then
  perform test.fail(format('the same rows and export time are the same file whatever sha-256 is sent — %s', sqlerrm));
end
$$;
select test.ok(not (api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-N2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 70)),
  current_setting('t.t')::timestamptz, 'made-up-2.xlsx', current_setting('t.sha')) ? 'already_imported'),
  'other rows sent with a repeated sha-256 are a new file');
select test.as_owner();
select test.eq((select count(*)::int from finance.invoice where ref = 'TX-N2'), 1, 'and are imported');

select test.as_person(current_setting('t.head')::uuid);
select test.eq((api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-N3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 40)),
  current_setting('t.t')::timestamptz - interval '1 day') ->> 'older_than')::timestamptz,
  current_setting('t.t')::timestamptz, 'a file exported before the newest one says older_than');

select test.as_owner();
select test.eq((select src ->> 'a' from finance.merge_fields('{"a": null}', '{"a": "x"}',
                                                             '{"a": "2026-10-10T00:00:00+00:00"}', '2026-10-01T00:00:00Z'))::timestamptz,
  '2026-10-10T00:00:00Z'::timestamptz, 'an older file that fills a blank keeps the field''s newer time');
