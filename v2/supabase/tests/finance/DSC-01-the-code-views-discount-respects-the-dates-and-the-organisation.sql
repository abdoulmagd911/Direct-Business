-- DSC-01 — on a code view the discount shown is the discount of the uses inside the view (Landing 32, A4): the
-- same dates and the same organisation as the rows. Before, it was every use of the code, all time, at every
-- organisation, whatever was asked. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-code-discount-ignores-the-dates.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
create function pg_temp.org(p_name text) returns text language sql as
$$ select api.partner_create(jsonb_build_object('trade_name_en', p_name,
     'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id' $$;
select set_config('t.a', pg_temp.org('Made Up Discount Org A'), true);
select set_config('t.b', pg_temp.org('Made Up Discount Org B'), true);
select api.identifier_add(current_setting('t.a')::uuid, 'payments_client_id', '990401', 'made up', 'postpaid');
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, source_promo, created_by)
select gen_random_uuid(), p::uuid, 'promo_code_invoice_export', 'made-up-dsc.csv', 'MADEUPDSC', current_setting('t.head')::uuid
from unnest(array[current_setting('t.a'), current_setting('t.b')]) p;
-- A: 10 in January, 20 in June. B: 40 in June.
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, source_promo, attribution_promo, promo_discount_sar, created_by)
select v.p::uuid, (select b.id from work.import_batch b where b.partner_id = v.p::uuid), 'transaction', v.tx, v.tx || '-INV',
       v.day::date, 500, 500, 50, 450, true, 'MADEUPDSC', true, v.disc, current_setting('t.head')::uuid
from (values (current_setting('t.a'), 'DSC-A-JAN', '2026-01-15', 10::numeric),
             (current_setting('t.a'), 'DSC-A-JUN', '2026-06-15', 20),
             (current_setting('t.b'), 'DSC-B-JUN', '2026-06-20', 40)) v(p, tx, day, disc);
select test.done();

select test.as_person(current_setting('t.head')::uuid);
create function pg_temp.disc(p_from date, p_to date, p_partner uuid default null, p_client text default null) returns numeric
language sql as
$$ select (api.finance_unified_ledger(p_from, p_to, p_partner, p_client, null, 'MADEUPDSC') ->> 'code_discount')::numeric $$;
select test.eq(pg_temp.disc('2026-01-01', '2026-12-31'), 70.00, 'the whole year, every organisation: 10 + 20 + 40');
select test.eq(pg_temp.disc('2026-06-01', '2026-06-30'), 60.00, 'June only: the January use is outside the dates');
select test.eq(pg_temp.disc('2026-01-01', '2026-01-31'), 10.00, 'January only');
select test.eq(pg_temp.disc('2026-01-01', '2026-12-31', current_setting('t.a')::uuid), 30.00,
  'one organisation, the whole year: only its own uses');
select test.eq(pg_temp.disc('2026-06-01', '2026-06-30', current_setting('t.a')::uuid), 20.00,
  'one organisation in June: both filters at once');
select test.eq(pg_temp.disc('2026-06-01', '2026-06-30', null, '990401'), 20.00, 'the client ID filter narrows it the same way');
select test.eq(pg_temp.disc('2025-01-01', '2025-12-31'), 0.00, 'a period with no use shows no discount');
-- the discount always belongs to the rows shown: it equals the sum over the view's own rows
select test.eq(pg_temp.disc('2026-06-01', '2026-06-30'),
  (select sum((r ->> 'discount_sar')::numeric) from pg_catalog.jsonb_array_elements(
     api.finance_unified_ledger('2026-06-01'::date, '2026-06-30'::date, null, null, null, 'MADEUPDSC') -> 'rows') r),
  'the discount is the discount of the rows in the view');
