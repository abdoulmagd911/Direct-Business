-- IMP-11 — what a person undid, a file never redoes (QA-539; V622, V616). A proposal a person dismissed is not proposed
-- again by the next file, which says so (link_dismissed); a link a person removed — here by undoing the tick that made
-- it — is not made again by a file that names the monthly invoice, which holds the row as removed_link. Every value is
-- made up.
-- Sabotages: supabase/tests/sabotage/a-dismissed-proposal-comes-back.sql,
-- supabase/tests/sabotage/a-removed-link-comes-back.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 12)::text, true);
select set_config('t.rows', jsonb_build_array(
  jsonb_build_object('ref', 'TX-U1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200,
                     'client_id', '61001'),
  jsonb_build_object('ref', 'TX-U2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300,
                     'client_id', '61001'),
  jsonb_build_object('ref', 'BL-U1', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'total_sar', 500, 'client_id', '61001'),
  jsonb_build_object('ref', 'TX-U3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 150,
                     'client_id', '61002'),
  jsonb_build_object('ref', 'BL-U2', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'total_sar', 150, 'client_id', '61002'))::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', current_setting('t.rows')::jsonb, now() - interval '3 hours');
select test.as_owner();
select set_config('t.p1', (select p.id from finance.billing_proposal p join finance.invoice b on b.id = p.billing_invoice_id
                           where b.ref = 'BL-U1')::text, true);
select set_config('t.p2', (select p.id from finance.billing_proposal p join finance.invoice b on b.id = p.billing_invoice_id
                           where b.ref = 'BL-U2')::text, true);

-- BL-U1's proposal dismissed; BL-U2's ticked, then the tick undone
select test.as_person(current_setting('t.head')::uuid);
select api.finance_proposal_decide(current_setting('t.p1')::uuid, false, 'made up: not these bookings');
select api.finance_proposal_decide(current_setting('t.p2')::uuid, true, 'made up: the amounts agree');
select test.as_owner();
select set_config('t.req', (test.last_change('finance.billing_link',
  (select l.id from finance.billing_link l join finance.invoice t on t.id = l.transaction_invoice_id
   where t.ref = 'TX-U3'))).request_id::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.undo(current_setting('t.req')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from finance.billing_link l join finance.invoice t on t.id = l.transaction_invoice_id
                where t.ref = 'TX-U3' and l.deleted_at is null), 0, 'the undo removed the link');

-- the next file: BL-U1's file unchanged; TX-U3 now names BL-U2 as its monthly invoice
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', (select jsonb_agg(case when x ->> 'ref' = 'TX-U3'
                                                            then x || '{"consolidated_ref": "BL-U2"}' else x end)
                                       from jsonb_array_elements(current_setting('t.rows')::jsonb) x),
                          now() - interval '1 hour');
select test.as_owner();
select test.eq((select count(*)::int from finance.billing_proposal p join finance.invoice b on b.id = p.billing_invoice_id
                where b.ref = 'BL-U1' and p.state = 'open'), 0, 'a dismissed proposal is not proposed again');
select test.eq((select h.reason_key from finance.import_held h join finance.import_batch b on b.id = h.batch_id
                where h.ref = 'BL-U1' and h.reason_key like 'link%'
                order by b.export_time desc limit 1), 'link_dismissed', 'and the file says a person dismissed it');
select test.eq((select count(*)::int from finance.billing_link l join finance.invoice t on t.id = l.transaction_invoice_id
                where t.ref = 'TX-U3' and l.deleted_at is null), 0, 'a removed link is not made again by a file');
select test.eq((select h.reason_key from finance.import_held h where h.ref = 'TX-U3' and h.reason_key = 'removed_link'),
  'removed_link', 'the row is held as removed_link');
