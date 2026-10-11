-- IMP-01 — the Payments invoice export (P4-1b, V618): a FAKE file's rows become invoices with source = import, of the
-- kind Payments shapes them; an unknown status word, a future date and an unreadable amount are held with their reason
-- and never become records (D21, V461); the same file twice changes nothing; a dry run writes nothing; a newer file
-- changes a value, an older one only fills a blank and a blank never wipes (§3.11.6); a hand-typed or removed row is
-- never touched (D21, OA12); only a person with finance.import may import. Every value is made up.
-- Sabotages: supabase/tests/sabotage/an-unknown-status-word-is-guessed.sql, the-same-file-twice-writes-again.sql,
-- an-older-file-overwrites-a-newer-value.sql, an-import-changes-a-typed-row.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 20)::text, true);   -- a made-up created day, in the past

select set_config('t.file', jsonb_build_array(
  jsonb_build_object('ref', 'TX-1001', 'consolidated_ref', 'BL-2001', 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'paid_on', current_setting('t.d'), 'total_sar', 1000, 'customer_name', 'Made Up Travel Co',
                     'client_id', '90001', 'lines', jsonb_build_array(jsonb_build_object('line_no', 1, 'product', 'Direct Hotels',
                     'name', 'Hotel night', 'total_sar', 1000))),
  jsonb_build_object('ref', 'TX-1002', 'consolidated_ref', 'BL-2001', 'status', ' fully  paid ', 'created_on', current_setting('t.d'),
                     'total_sar', 500, 'client_id', '90001'),
  jsonb_build_object('ref', 'BL-2001', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'total_sar', 1500, 'dpin', 'DP-9001', 'client_id', '90001'),
  jsonb_build_object('ref', 'SA-3001', 'status', 'Published', 'created_on', current_setting('t.d'), 'total_sar', 300),
  jsonb_build_object('ref', 'XX-4001', 'status', 'Paid', 'created_on', current_setting('t.d'), 'total_sar', 70),
  jsonb_build_object('ref', 'XX-4002', 'status', 'Fully Paid', 'created_on', (core.riyadh_today() + 2)::text, 'total_sar', 70),
  jsonb_build_object('ref', 'XX-4003', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 'twelve'),
  jsonb_build_object('ref', 'TX-1003', 'consolidated_ref', 'BL-9999', 'status', 'Draft', 'created_on', current_setting('t.d'),
                     'total_sar', 80))::text, true);

-- only a person with finance.import may import
select test.as_person(current_setting('t.mem')::uuid);
select test.raises($$select api.finance_import('invoices', current_setting('t.file')::jsonb, now() - interval '2 days')$$,
  '42501', 'a member without finance.import is refused');

select test.as_person(current_setting('t.head')::uuid);
-- a dry run is the preview: the same answer, nothing written
select test.eq(api.finance_import('invoices', current_setting('t.file')::jsonb, now() - interval '2 days', 'made-up.csv',
                                  null, true) -> 'counts',
  '{"read": 8, "new": 5, "changed": 0, "unchanged": 0, "held": 3}'::jsonb, 'the preview counts five new and three held');
select test.as_owner();
select test.eq((select count(*)::int from finance.invoice), 0, 'and writes nothing');
select test.eq((select count(*)::int from finance.import_batch), 0, 'not even the batch');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r1', api.finance_import('invoices', current_setting('t.file')::jsonb, now() - interval '2 days',
                                             'made-up.csv', repeat('a', 64))::text, true);
select test.eq(current_setting('t.r1')::jsonb -> 'counts', '{"read": 8, "new": 5, "changed": 0, "unchanged": 0, "held": 3}'::jsonb,
  'five invoices written, three held');
select test.eq((select jsonb_agg(h ->> 'reason' order by h ->> 'reason') from jsonb_array_elements(current_setting('t.r1')::jsonb -> 'held') h
                where not (h ->> 'written')::boolean),
  '["bad_amount", "date_in_future", "status_unknown"]'::jsonb, 'each held row says why: the unknown word, the future date, the unreadable amount');
select test.eq((select h ->> 'reason' from jsonb_array_elements(current_setting('t.r1')::jsonb -> 'held') h
                where (h ->> 'written')::boolean and h ->> 'ref' = 'TX-1003'),
  'billing_unknown', 'a transaction naming a billing invoice Finance lacks is written, its link waits');

select test.as_owner();
select test.eq((select jsonb_object_agg(ref, kind) from finance.invoice),
  '{"TX-1001": "transaction", "TX-1002": "transaction", "BL-2001": "billing", "SA-3001": "standalone", "TX-1003": "transaction"}'::jsonb,
  'each of the kind Payments shapes it');
select test.ok((select bool_and(source = 'import' and created_by = core.import_person_id()) from finance.invoice),
  'source import, written as Import (V44)');
select test.eq((select count(*)::int from finance.invoice where ref like 'XX-%'), 0, 'held rows never became records');
select test.eq((select s.key from finance.invoice i join finance.status_map s on s.id = i.status_id where i.ref = 'TX-1002'),
  'fully_paid', 'spacing and case of a status word do not matter');
select test.eq((select array_agg(t.ref order by t.ref) from finance.billing_link l join finance.invoice t on t.id = l.transaction_invoice_id
                where l.source = 'payments'), array['TX-1001', 'TX-1002'], 'the consolidation field links the two transactions');
select test.eq((select t.dpin from finance.tax_invoice t join finance.invoice i on i.id = t.parent_invoice_id where i.ref = 'BL-2001'),
  'DP-9001', 'the DPIN is its own field on the billing invoice (V617)');
select test.eq((select month_on from finance.invoice where ref = 'TX-1001'), date_trunc('month', current_setting('t.d')::date)::date,
  'the month is the created date''s (V610)');
select test.eq((select payments_as_of from finance.invoice where ref = 'TX-1001'), ((now() - interval '2 days') at time zone 'Asia/Riyadh')::date,
  'Payments · as of is the file''s export day (V401)');

-- the same file twice changes nothing
select set_config('t.v', (select jsonb_object_agg(ref, version) from finance.invoice)::text, true);
select set_config('t.c', (select count(*) from audit.change)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select test.eq((api.finance_import('invoices', current_setting('t.file')::jsonb, now() - interval '2 days', 'made-up.csv',
                                   repeat('a', 64)) ->> 'already_imported')::boolean, true, 'the same file again is recognised');
select test.eq(api.finance_import('invoices', current_setting('t.file')::jsonb, now() - interval '2 days', 'made-up-copy.csv') -> 'counts',
  '{"read": 8, "new": 0, "changed": 0, "unchanged": 5, "held": 3}'::jsonb, 'and its rows read again change nothing');
select test.as_owner();
select test.eq((select jsonb_object_agg(ref, version) from finance.invoice), current_setting('t.v')::jsonb, 'no invoice moved');
select test.eq((select count(*) from audit.change)::text, current_setting('t.c'), 'no change was logged');

-- a newer file changes a value; an older one only fills a blank; a blank never wipes
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-3001', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300,
                     'paid_on', current_setting('t.d'))), now() - interval '1 day');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-3001', 'status', 'Draft', 'created_on', current_setting('t.d'), 'total_sar', 999,
                     'branch', 'Made Up Branch')), now() - interval '3 days');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-3001', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', null)),
  now() - interval '12 hours');
select test.as_owner();
select test.eq((select jsonb_build_object('status', status_raw, 'total', total_sar, 'branch', branch, 'paid', paid_on is not null)
                from finance.invoice where ref = 'SA-3001'),
  '{"status": "Fully Paid", "total": 300.00, "branch": "Made Up Branch", "paid": true}'::jsonb,
  'the newer status stands, the older file filled only the blank branch, the blank total wiped nothing');

-- a hand-typed row is never touched; a removed one is never revived
select test.act(current_setting('t.head')::uuid);
insert into finance.invoice (ref, kind, status_raw, status_id, created_on, total_sar, source, created_by)
values ('MN-6001', 'standalone', 'Draft', (select id from finance.status_map where key = 'draft'), current_setting('t.d')::date, 40,
        'manual', current_setting('t.head')::uuid);
update finance.invoice set deleted_at = now(), deleted_by = current_setting('t.head')::uuid, delete_reason = 'made up'
where ref = 'TX-1003';
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r2', api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'MN-6001', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 4000),
  jsonb_build_object('ref', 'TX-1003', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 80)),
  now())::text, true);
select test.eq((select jsonb_agg(h ->> 'reason' order by h ->> 'ref') from jsonb_array_elements(current_setting('t.r2')::jsonb -> 'held') h),
  '["manual_row", "removed_row"]'::jsonb, 'a typed row and a removed row are held, each saying why');
select test.as_owner();
select test.eq((select jsonb_build_object('total', total_sar, 'status', status_raw, 'source', source) from finance.invoice
                where ref = 'MN-6001'), '{"total": 40.00, "status": "Draft", "source": "manual"}'::jsonb, 'the typed row is as typed');
select test.ok(not exists (select 1 from finance.invoice where ref = 'TX-1003' and deleted_at is null), 'the removed row stays removed');
select test.eq((select a.kind from audit.request a join finance.import_batch b on b.request_id = a.id order by b.created_at desc limit 1),
  'import', 'every import is its own request, logged as Import');
