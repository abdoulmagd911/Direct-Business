-- AGE-01 — Landing 47, A6: outstanding and how old. The ageing list names what is still owed — a document recorded
-- here that is not fully paid, an imported row not confirmed paid — with its age in days since it was issued and
-- its bucket (0–30, 31–60, 61–90, over 90), and adds the same up by organisation. It is the pursue list for
-- postpaid: by default it keeps postpaid rows and the rows whose deal type is not set (a missing flag hides
-- nothing); asked for all, it lists every deal type. A paid, cancelled, void or draft document is never owed.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-paid-invoice-is-still-owed.sql,
--   an-unset-deal-type-is-hidden-from-the-pursue-list.sql, the-ageing-buckets-are-one-bucket.sql,
--   the-ageing-list-shows-prepaid-by-default.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.today', core.riyadh_today()::text, true);
create function pg_temp.age(p_partner uuid default null, p_all boolean default false) returns jsonb language sql as
$$ select api.finance_ageing(p_partner, p_all) $$;
create function pg_temp.row_of(p_number text, p_all boolean default false) returns jsonb language sql as
$$ select r from pg_catalog.jsonb_array_elements(pg_temp.age(null, p_all) -> 'rows') r where r ->> 'number' = p_number $$;
create function pg_temp.co(p_partner uuid) returns jsonb language sql as
$$ select c from pg_catalog.jsonb_array_elements(pg_temp.age() -> 'companies') c where c ->> 'partner_id' = p_partner::text $$;
grant execute on function pg_temp.age(uuid, boolean), pg_temp.row_of(text, boolean), pg_temp.co(uuid) to public;

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.post', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ageing Postpaid',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.pre', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ageing Prepaid',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.none', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ageing No Kind',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.post')::uuid, 'payments_client_id', '990601', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.pre')::uuid, 'payments_client_id', '990602', 'made up', 'prepaid');
-- recorded here: postpaid owing 1,000 for 40 days and 300 for 10 days; one Fully Paid, one Cancelled, one Draft;
-- a prepaid one owing 200 for 20 days
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'AGE-M1', 'client_id', '990601', 'status', 'Pending', 'created_on', (current_setting('t.today')::date - 40)::text, 'total_sar', 1000),
  jsonb_build_object('ref', 'AGE-M2', 'client_id', '990601', 'status', 'Pending', 'created_on', (current_setting('t.today')::date - 10)::text, 'total_sar', 300),
  jsonb_build_object('ref', 'AGE-PAID', 'client_id', '990601', 'status', 'Fully Paid', 'created_on', (current_setting('t.today')::date - 50)::text, 'total_sar', 900),
  jsonb_build_object('ref', 'AGE-CANC', 'client_id', '990601', 'status', 'Cancelled', 'created_on', (current_setting('t.today')::date - 50)::text, 'total_sar', 900),
  jsonb_build_object('ref', 'AGE-DRAFT', 'client_id', '990601', 'status', 'Draft', 'created_on', (current_setting('t.today')::date - 50)::text, 'total_sar', 900),
  jsonb_build_object('ref', 'AGE-PRE', 'client_id', '990602', 'status', 'Pending', 'created_on', (current_setting('t.today')::date - 20)::text, 'total_sar', 200)),
  now() - interval '1 day');
-- imported: postpaid owing 500 for 100 days and 70 for 75 days; one paid; an organisation with no kind owing 50
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
select gen_random_uuid(), p::uuid, 'invoice_export', 'made-up-age.csv', current_setting('t.head')::uuid
from unnest(array[current_setting('t.post'), current_setting('t.none')]) p;
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, fully_paid, status_text, created_by)
select v.p::uuid, (select b.id from work.import_batch b where b.partner_id = v.p::uuid), 'transaction', v.txn, v.inv,
       current_setting('t.today')::date - v.days, v.amount, v.amount, v.paid, v.status, current_setting('t.head')::uuid
from (values (current_setting('t.post'), 'AGE-I1', 'AGE-INV-1', 100, 500::numeric, false, 'Pending Payment'),
             (current_setting('t.post'), 'AGE-I2', 'AGE-INV-2', 75, 70, false, null),
             (current_setting('t.post'), 'AGE-I3', 'AGE-INV-3', 95, 800, true, 'Fully Paid + Receivables'),
             (current_setting('t.post'), 'AGE-I4', 'AGE-INV-4', 95, 800, false, 'Cancelled'),
             (current_setting('t.none'), 'AGE-I5', 'AGE-INV-5', 5, 50, false, 'Pending Payment')) v(p, txn, inv, days, amount, paid, status);
select test.done();

select test.as_person(current_setting('t.head')::uuid);
-- each owed document, its age and its bucket
select test.eq((pg_temp.row_of('AGE-M1') ->> 'outstanding')::numeric, 1000.00, 'a document not fully paid owes its total');
select test.eq((pg_temp.row_of('AGE-M1') ->> 'age_days')::int, 40, 'it is 40 days old');
select test.eq(pg_temp.row_of('AGE-M1') ->> 'bucket', 'days_31_60', 'in the 31–60 bucket');
select test.eq(pg_temp.row_of('AGE-M2') ->> 'bucket', 'days_0_30', '10 days: the 0–30 bucket');
select test.eq(pg_temp.row_of('AGE-I1') ->> 'bucket', 'days_over_90', 'an imported row, 100 days: over 90');
select test.eq(pg_temp.row_of('AGE-I2') ->> 'bucket', 'days_61_90', '75 days: the 61–90 bucket');
select test.eq((pg_temp.row_of('AGE-I2') ->> 'outstanding')::numeric, 70.00, 'an imported row with no status word is still owed, never dropped');
select test.eq(pg_temp.row_of('AGE-M1') ->> 'deal_type', 'postpaid', 'each row carries its deal type');
-- never owed: paid, cancelled, draft
select test.eq(pg_temp.row_of('AGE-PAID', true), null::jsonb, 'a Fully Paid invoice is not owed');
select test.eq(pg_temp.row_of('AGE-I3', true), null::jsonb, 'nor a paid-but-receivable imported row');
select test.eq(pg_temp.row_of('AGE-CANC', true), null::jsonb, 'nor a cancelled one');
select test.eq(pg_temp.row_of('AGE-I4', true), null::jsonb, 'nor a cancelled imported row');
select test.eq(pg_temp.row_of('AGE-DRAFT', true), null::jsonb, 'nor a draft');
-- the pursue list is for postpaid: prepaid is left out by default, a row with no deal type is kept
select test.eq(pg_temp.row_of('AGE-PRE'), null::jsonb, 'a prepaid row is not on the postpaid pursue list');
select test.eq((pg_temp.row_of('AGE-PRE', true) ->> 'outstanding')::numeric, 200.00, 'asked for all, it is listed');
select test.eq((pg_temp.row_of('AGE-I5') ->> 'outstanding')::numeric, 50.00, 'a row whose deal type is not set is kept: a missing flag hides nothing');
select test.eq(pg_temp.row_of('AGE-I5') ->> 'deal_type', null, 'and says it is not set');
-- the totals and the buckets
select test.eq((pg_temp.age() ->> 'outstanding')::numeric, 1920.00, 'outstanding: 1000 + 300 + 500 + 70 + 50');
select test.eq((pg_temp.age() ->> 'units')::int, 5, 'five documents');
select test.eq(pg_temp.age() -> 'buckets', '{"days_0_30": 350.00, "days_31_60": 1000.00, "days_61_90": 70.00, "days_over_90": 500.00}'::jsonb,
  'by bucket');
select test.eq((pg_temp.age(null, true) ->> 'outstanding')::numeric, 2120.00, 'every deal type: 200 more');
-- by organisation, oldest first
select test.eq((pg_temp.co(current_setting('t.post')::uuid) ->> 'outstanding')::numeric, 1870.00, 'the postpaid organisation owes 1,870');
select test.eq((pg_temp.co(current_setting('t.post')::uuid) ->> 'oldest_days')::int, 100, 'its oldest is 100 days');
select test.eq((pg_temp.co(current_setting('t.post')::uuid) ->> 'days_over_90')::numeric, 500.00, 'with 500 over 90 days');
select test.eq((pg_temp.co(current_setting('t.post')::uuid) ->> 'units')::int, 4, 'four documents');
select test.eq(pg_temp.age() -> 'companies' -> 0 ->> 'partner_id', current_setting('t.post'), 'the organisation with the oldest debt is first');
select test.eq(pg_temp.age() -> 'rows' -> 0 ->> 'number', 'AGE-I1', 'and the oldest document is first');
-- one organisation's own list (its Finance tab)
select test.eq((pg_temp.age(current_setting('t.post')::uuid) ->> 'outstanding')::numeric, 1870.00, 'one organisation: its own 1,870');
select test.eq((pg_temp.age(current_setting('t.pre')::uuid) ->> 'units')::int, 0, 'a prepaid organisation has nothing on the pursue list');
-- paid: it leaves the list
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'AGE-M1', 'client_id', '990601', 'status', 'Fully Paid', 'created_on', (current_setting('t.today')::date - 40)::text, 'total_sar', 1000)),
  now());
select test.eq(pg_temp.row_of('AGE-M1'), null::jsonb, 'once paid, the document leaves the list');
select test.eq((pg_temp.age() ->> 'outstanding')::numeric, 920.00, 'and the total falls by exactly its amount');
