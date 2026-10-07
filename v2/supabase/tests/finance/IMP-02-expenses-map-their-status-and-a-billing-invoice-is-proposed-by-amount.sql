-- IMP-02 — the transaction-expense export and the amount proposal (P4-1b; V611, V616): expense statuses go through the
-- list, a blank one reads issued, an unknown word is held; an expense for a reference Finance lacks, or on a billing
-- invoice, is held, never written; a blank transaction-level expense status reads issued. A billing invoice without
-- Payments' consolidation field gets an amount proposal — the one set of its customer's unlinked transactions adding up
-- to its total — linked only when a person ticks it; no set adding up is said, never guessed. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-blank-expense-status-is-not-ready.sql, a-proposal-links-before-its-tick.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 20)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-7001', 'status', 'Fully Paid', 'consolidation_status', 'consolidation_invoiced',
                     'created_on', current_setting('t.d'), 'total_sar', 200, 'client_id', '70001'),
  jsonb_build_object('ref', 'TX-7002', 'status', 'Fully Paid', 'consolidation_status', 'consolidation_invoiced',
                     'created_on', current_setting('t.d'), 'total_sar', 300, 'client_id', '70001'),
  jsonb_build_object('ref', 'TX-7003', 'status', 'Fully Paid', 'consolidation_status', 'consolidation_invoiced',
                     'created_on', current_setting('t.d'), 'total_sar', 450, 'client_id', '70001'),
  jsonb_build_object('ref', 'TX-7004', 'status', 'Fully Paid', 'consolidation_status', 'consolidation_invoiced',
                     'created_on', current_setting('t.d'), 'total_sar', 125, 'client_id', '70002'),
  jsonb_build_object('ref', 'BL-7101', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'total_sar', 500, 'client_id', '70001'),
  jsonb_build_object('ref', 'BL-7102', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'total_sar', 130, 'client_id', '70002')), now() - interval '2 days');

select test.as_owner();
select test.eq((select array_agg(t.ref order by t.ref) from finance.billing_proposal p
                join finance.invoice b on b.id = p.billing_invoice_id cross join unnest(p.transaction_ids) x(id)
                join finance.invoice t on t.id = x.id where b.ref = 'BL-7101' and p.state = 'open'),
  array['TX-7001', 'TX-7002'], 'the one set of the customer''s transactions adding up to 500 is proposed');
select test.eq((select count(*)::int from finance.billing_link), 0, 'and links nothing until ticked');
select test.eq((select h.reason_key || ': ' || h.detail from finance.import_held h where h.ref = 'BL-7102' and h.reason_key like 'link%'),
  'link_not_found: no set adds up', 'no set adding up to 130 is said, never guessed');
select test.eq((select count(*)::int from finance.import_held h where h.reason_key = 'unknown_client_id' and h.written),
  6, 'a client ID no organisation holds is written and waits for a person (V420)');

-- a person with Full on Finance ticks it: its transactions become the billing invoice's, one request
select set_config('t.p', (select p.id from finance.billing_proposal p join finance.invoice b on b.id = p.billing_invoice_id
                          where b.ref = 'BL-7101')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_proposal_decide(current_setting('t.p')::uuid, true, 'made up: the amounts agree');
select test.as_owner();
select test.eq((select array_agg(t.ref order by t.ref) from finance.billing_link l join finance.invoice t on t.id = l.transaction_invoice_id
                where l.source = 'proposal'), array['TX-7001', 'TX-7002'], 'ticked: linked, source proposal');
select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.finance_proposal_decide(current_setting('t.p')::uuid, false)$$,
  'P0001', 'a decided proposal is not decided again', 'finance.proposal_decided');

-- the expense export
select set_config('t.r', api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-7001', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 150,
                     'created_at', current_setting('t.d') || 'T10:00:00+03:00', 'transaction_expense_status', ''),
  jsonb_build_object('ref', 'TX-7002', 'expense_type', 'Hotel', 'status', 'Under Review', 'amount_sar', 210,
                     'created_at', current_setting('t.d') || 'T10:00:00+03:00', 'transaction_expense_status', 'Pending'),
  jsonb_build_object('ref', 'TX-7003', 'expense_type', 'Visa', 'status', '', 'amount_sar', 90,
                     'created_at', current_setting('t.d') || 'T11:00:00+03:00'),
  jsonb_build_object('ref', 'TX-7004', 'expense_type', 'Hotel', 'status', 'Paid out', 'amount_sar', 90,
                     'created_at', current_setting('t.d') || 'T11:00:00+03:00'),
  jsonb_build_object('ref', 'TX-0000', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 10,
                     'created_at', current_setting('t.d') || 'T11:00:00+03:00'),
  jsonb_build_object('ref', 'BL-7101', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 10,
                     'created_at', current_setting('t.d') || 'T11:00:00+03:00')), now() - interval '1 day')::text, true);
select test.eq(current_setting('t.r')::jsonb -> 'counts', '{"read": 6, "new": 3, "changed": 0, "unchanged": 0, "held": 3}'::jsonb,
  'three expenses written, three held');
select test.eq((select jsonb_object_agg(h ->> 'ref', h ->> 'reason') from jsonb_array_elements(current_setting('t.r')::jsonb -> 'held') h),
  '{"TX-7004": "expense_status_unknown", "TX-0000": "no_invoice", "BL-7101": "expense_on_billing"}'::jsonb,
  'an unknown word, a reference Finance lacks, an expense on a billing invoice — each held, saying why');
select test.as_owner();
select test.eq((select jsonb_object_agg(i.ref, e.status) from finance.expense_line e join finance.invoice i on i.id = e.invoice_id),
  '{"TX-7001": "approved", "TX-7002": "under_review", "TX-7003": "issued"}'::jsonb,
  'the words through the list; a blank expense status reads issued (V611)');
select test.eq((select jsonb_object_agg(ref, expense_status) from finance.invoice where ref in ('TX-7001', 'TX-7002')),
  '{"TX-7001": "issued", "TX-7002": "pending"}'::jsonb, 'a blank transaction-level status reads issued, never "not ready"');
