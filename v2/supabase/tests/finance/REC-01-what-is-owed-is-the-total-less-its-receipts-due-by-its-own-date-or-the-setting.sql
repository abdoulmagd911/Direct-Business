-- REC-01 — receipts and what is owed (§3.6 receivable, §3.11; V415, V416). Receipt rows come in once — the same
-- receipt twice is one, a receipt for an invoice Finance lacks or with an unreadable amount is held. What is owed is per
-- collectable invoice: due on its own due date, else the setting's days after it was issued, and the row says which;
-- outstanding is its total less its receipts, nothing once fully paid; a transaction gathered into a monthly invoice
-- is owed on that invoice; a draft owes nothing. Overdue days give the ageing bucket. Every value is made up.
-- Sabotage: supabase/tests/sabotage/what-is-owed-ignores-the-receipts.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Owing Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '83001', 'made up', 'postpaid');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8101', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 50)::text,
                     'total_sar', 1000, 'client_id', '83001'),
  jsonb_build_object('ref', 'SA-8102', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 100)::text,
                     'due_on', (current_setting('t.t')::date - 95)::text, 'total_sar', 500),
  jsonb_build_object('ref', 'SA-8103', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 60)::text,
                     'total_sar', 300),
  jsonb_build_object('ref', 'SA-8104', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 5)::text,
                     'total_sar', 200),
  jsonb_build_object('ref', 'TX-8105', 'consolidated_ref', 'BL-8106', 'status', 'Published',
                     'created_on', (current_setting('t.t')::date - 40)::text, 'total_sar', 150),
  jsonb_build_object('ref', 'BL-8106', 'is_consolidated', true, 'status', 'Published',
                     'created_on', (current_setting('t.t')::date - 40)::text, 'total_sar', 150),
  jsonb_build_object('ref', 'SA-8107', 'status', 'Draft', 'created_on', (current_setting('t.t')::date - 50)::text,
                     'total_sar', 70)), now() - interval '1 day');

select test.eq(api.finance_import('receipts', jsonb_build_array(
  jsonb_build_object('type', 'payment_receipt', 'ref', 'SA-8101', 'method', 'Bank transfer', 'amount_sar', 400,
                     'paid_on', (current_setting('t.t')::date - 30)::text, 'ref_at_method', 'MADE-UP-1'),
  jsonb_build_object('type', 'payment_receipt', 'ref', 'SA-8101', 'method', 'Bank transfer', 'amount_sar', 400,
                     'paid_on', (current_setting('t.t')::date - 30)::text, 'ref_at_method', 'made up 1'),
  jsonb_build_object('type', 'payment_receipt', 'ref', 'SA-9999', 'amount_sar', 10, 'paid_on', current_setting('t.t')),
  jsonb_build_object('type', 'payment_receipt', 'ref', 'SA-8102', 'amount_sar', 'ten', 'paid_on', current_setting('t.t'))),
  now() - interval '1 hour') -> 'counts',
  '{"read": 4, "new": 1, "changed": 0, "unchanged": 1, "held": 2}'::jsonb,
  'a receipt comes in once; one for an invoice Finance lacks, or with an unreadable amount, is held');

select set_config('t.r', api.finance_receivables()::text, true);
select test.eq((select jsonb_agg(jsonb_build_object('ref', e ->> 'ref', 'due_basis', e ->> 'due_basis',
                                                    'received', (e ->> 'received')::numeric,
                                                    'outstanding', (e ->> 'outstanding')::numeric,
                                                    'days_overdue', (e ->> 'days_overdue')::int, 'bucket', e ->> 'bucket'))
                from jsonb_array_elements(current_setting('t.r')::jsonb -> 'rows') e),
  '[{"ref": "SA-8102", "due_basis": "own", "received": 0, "outstanding": 500, "days_overdue": 95, "bucket": "days_over_90"},
    {"ref": "SA-8101", "due_basis": "setting", "received": 400, "outstanding": 600, "days_overdue": 20, "bucket": "days_1_30"},
    {"ref": "BL-8106", "due_basis": "setting", "received": 0, "outstanding": 150, "days_overdue": 10, "bucket": "days_1_30"},
    {"ref": "SA-8104", "due_basis": "setting", "received": 0, "outstanding": 200, "days_overdue": 0, "bucket": "not_due"}]'::jsonb,
  'each invoice owes its total less its receipts, due on its own date or the setting''s days after issue; fully paid, gathered and draft ones owe nothing here');
select test.eq((current_setting('t.r')::jsonb -> 'buckets'),
  '{"days_1_30": 750, "days_over_90": 500, "not_due": 200}'::jsonb, 'the ageing buckets');
select test.eq((current_setting('t.r')::jsonb ->> 'outstanding')::numeric, 1450::numeric, 'and the total owed');
select test.eq((api.finance_receivables(current_setting('t.p')::uuid) ->> 'outstanding')::numeric, 600::numeric,
  'an organisation''s card reads its own');
