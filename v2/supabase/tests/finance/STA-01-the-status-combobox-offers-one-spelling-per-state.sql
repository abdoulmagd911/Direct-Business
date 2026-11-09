-- STA-01 — the status combobox offers one spelling per state (F188): the four near-duplicates retire, the audit
-- spelling stays because it is the only row carrying the audit signal, and stored rows carrying a retired
-- spelling are normalised to the survivor's word and id together — never the word alone, because 'Fully Paid as
-- receivable' passes the ledger's paid gate only through its maps_to. Rows created by a TEST person are left
-- alone for the hard-delete (O5).
-- The migration ran when this test's database was built, so rows made after the build carry no retired spelling
-- through the api — the normalisation legs below insert rows with retired spellings directly, then replay the
-- migration's own normalisation statements verbatim and assert what they do. Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);

-- the combobox list, as the NewInvoice screen reads it: eight options, one per state
select test.eq((select jsonb_agg(word order by sort) from finance.status_map where active and deleted_at is null),
  '["Fully Paid", "Fully Paid (Audit Required)", "Published", "Pending", "Partially Paid", "Draft", "Void", "Cancelled"]'::jsonb,
  'eight options: the four duplicates retired, the audit spelling kept');
select test.eq((select count(*)::int from finance.status_map where not active and deleted_at is null), 4,
  'four retired rows');
select test.eq((select finance.status_of('Fully Paid as receivable')), null,
  'a retired spelling no longer resolves — a re-import carrying one is held, never silently rewritten');
select test.eq((select key from finance.status_map where id = (finance.status_of('Fully Paid (Audit Required)')).id),
  'fully_paid_audit', 'the audit spelling resolves to its own row');
select test.eq((select audit_required from finance.status_map where id = (finance.status_of('Fully Paid (Audit Required)')).id),
  true, 'and it still carries the audit signal');

-- a TEST person (is_test), with the head role so they may import
select test.as_owner();
insert into core.person (full_name_en, department_id, role_id, can_sign_in, is_test)
values ('Test Person Sta01', test.department('commercial'), test.role('head', false), true, true);
select set_config('t.test', (select id::text from core.person where full_name_en = 'Test Person Sta01'), true);

-- two manual invoices with retired spellings, one by the head, one by the TEST person; and one whose word is
-- already the survivor's but whose id still points at the retired row. Direct inserts as owner are stamped
-- System (no open request), so each insert runs under a request opened as its creator — the same stamping the
-- api's audit.begin gives a real write.
select test.as_owner();
insert into audit.request (actor_id, kind, label_key)
values (current_setting('t.head')::uuid, 'ui', 'test.setup');
select set_config('app.request_id', (select id::text from audit.request
  where actor_id = current_setting('t.head')::uuid order by at desc limit 1), true);
select set_config('app.request_depth', '1', true);
insert into finance.invoice (ref, kind, status_raw, status_id, created_on, created_by) values
  ('STA01-1', 'transaction', 'Fully Paid as receivable',
   (select id from finance.status_map where key = 'fully_paid_receivable'), core.riyadh_today(),
   current_setting('t.head')::uuid),
  ('STA01-3', 'transaction', 'Fully Paid',
   (select id from finance.status_map where key = 'fully_paid_receivable'), core.riyadh_today(),
   current_setting('t.head')::uuid);
select audit.end();
insert into audit.request (actor_id, kind, label_key)
values (current_setting('t.test')::uuid, 'ui', 'test.setup');
select set_config('app.request_id', (select id::text from audit.request
  where actor_id = current_setting('t.test')::uuid order by at desc limit 1), true);
select set_config('app.request_depth', '1', true);
insert into finance.invoice (ref, kind, status_raw, status_id, created_on, created_by) values
  ('STA01-2', 'transaction', 'Pending Payment',
   (select id from finance.status_map where key = 'pending_payment'), core.riyadh_today(),
   current_setting('t.test')::uuid);
select audit.end();

-- two imported records with retired spellings, one applied by the head, one by the TEST person. The status lives
-- on the invoice row: an invoice row carrying the retired spelling, then the transaction completing it, so the
-- stored record carries that spelling (a fresh transaction row stores no status of its own).
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Sta01 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.b', api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up.csv') ->> 'id', true);
select api.import_apply(current_setting('t.b')::uuid, jsonb_build_array(
  jsonb_build_object('row_no', 2, 'kind', 'invoice', 'transaction_ref', null, 'invoice_ref', '1163000016',
    'tax_no', null, 'record_date', core.riyadh_today()::text, 'amount', 100, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Pending Payment', 'fully_paid', false, 'audit_required', false, 'provisional', false,
    'product', null, 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 3, 'kind', 'transaction', 'transaction_ref', 'TX-STA01-1', 'invoice_ref', '1163000016',
    'tax_no', null, 'record_date', core.riyadh_today()::text, 'amount', 100, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Pending Payment', 'fully_paid', false, 'audit_required', false, 'provisional', false,
    'product', 'Direct Hotels', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false)));
select test.as_person(current_setting('t.test')::uuid);
select set_config('t.b2', api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up-two.csv') ->> 'id', true);
select api.import_apply(current_setting('t.b2')::uuid, jsonb_build_array(
  jsonb_build_object('row_no', 2, 'kind', 'invoice', 'transaction_ref', null, 'invoice_ref', '1163000017',
    'tax_no', null, 'record_date', core.riyadh_today()::text, 'amount', 200, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Voided', 'fully_paid', false, 'audit_required', false, 'provisional', false,
    'product', null, 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 3, 'kind', 'transaction', 'transaction_ref', 'TX-STA01-2', 'invoice_ref', '1163000017',
    'tax_no', null, 'record_date', core.riyadh_today()::text, 'amount', 200, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Voided', 'fully_paid', false, 'audit_required', false, 'provisional', false,
    'product', 'Direct Hotels', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false)));

-- the migration's normalisation, replayed verbatim against these rows
select test.as_owner();
with mapping(retired_key, retired_word, survivor_key) as (values
  ('fully_paid_receivable', 'Fully Paid as receivable', 'fully_paid'),
  ('pending_payment', 'Pending Payment', 'pending'),
  ('voided', 'Voided', 'void'),
  ('canceled', 'Canceled', 'cancelled'))
update finance.invoice i
set status_raw = s.word, status_id = s.id
from mapping m
join finance.status_map s on s.key = m.survivor_key
where i.deleted_at is null
  and (norm.fold(i.status_raw) = norm.fold(m.retired_word)
       or i.status_id in (select id from finance.status_map where key = m.retired_key))
  and not exists (select 1 from core.person p where p.id = i.created_by and p.is_test);
with mapping(retired_word, survivor_word) as (values
  ('Fully Paid as receivable', 'Fully Paid'),
  ('Pending Payment', 'Pending'),
  ('Voided', 'Void'),
  ('Canceled', 'Cancelled'))
update work.import_record r
set status_text = m.survivor_word
from mapping m
where r.deleted_at is null
  and norm.fold(r.status_text) = norm.fold(m.retired_word)
  and not exists (select 1 from core.person p where p.id = r.created_by and p.is_test);

select test.eq((select jsonb_build_object('word', status_raw, 'key', s.key) from finance.invoice i
                join finance.status_map s on s.id = i.status_id where i.ref = 'STA01-1'),
  '{"word": "Fully Paid", "key": "fully_paid"}'::jsonb,
  'the head''s invoice now carries the survivor word and id together');
select test.eq((select jsonb_build_object('word', status_raw, 'key', s.key) from finance.invoice i
                join finance.status_map s on s.id = i.status_id where i.ref = 'STA01-2'),
  '{"word": "Pending Payment", "key": "pending_payment"}'::jsonb,
  'the TEST person''s invoice is left alone for the hard-delete');
select test.eq((select jsonb_build_object('word', status_raw, 'key', s.key) from finance.invoice i
                join finance.status_map s on s.id = i.status_id where i.ref = 'STA01-3'),
  '{"word": "Fully Paid", "key": "fully_paid"}'::jsonb,
  'an id pointing at a retired row is fixed even when the word already reads right');
select test.eq((select jsonb_build_object('status', status_text, 'paid', fully_paid)
                from work.import_record where transaction_ref = 'TX-STA01-1'),
  '{"status": "Pending", "paid": false}'::jsonb,
  'the head''s imported record now carries the survivor word, its paid flag untouched');
select test.eq((select jsonb_build_object('status', status_text, 'paid', fully_paid)
                from work.import_record where transaction_ref = 'TX-STA01-2'),
  '{"status": "Voided", "paid": false}'::jsonb,
  'the TEST person''s imported record is left alone');
