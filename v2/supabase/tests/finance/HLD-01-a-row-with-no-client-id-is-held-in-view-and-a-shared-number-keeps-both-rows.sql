-- HLD-01 — Landing 47, A11: held, never dropped. The held list names every unit Finance cannot tie firmly — a row
-- that matches no organisation, a row with no client ID (its invoice carries none, or its organisation holds none),
-- and a number found under more than one organisation — each with its amount. They count as they counted: the list
-- moves no figure. And the two number rules, told apart: one DOCUMENT through both doors is one row, the row
-- recorded here kept (L18); two DOCUMENTS sharing a number are two rows, both kept, both listed (FND-09).
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-held-row-is-dropped-from-the-ledger.sql,
--   a-row-with-no-client-id-is-not-held.sql, a-row-with-no-organisation-is-not-held.sql,
--   a-shared-number-is-not-listed.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.member', test.person('Test No Finance', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
create function pg_temp.held() returns jsonb language sql as
$$ select api.finance_held_rows('2026-01-01'::date, '2026-12-31'::date) $$;
create function pg_temp.reasons_of(p_number text) returns text[] language sql as
$$ select coalesce(array_agg(r ->> 'reason' order by r ->> 'reason', r ->> 'source'), '{}') from pg_catalog.jsonb_array_elements(pg_temp.held() -> 'rows') r where r ->> 'number' = p_number $$;
grant execute on function pg_temp.held(), pg_temp.reasons_of(text) to public;

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Held Org A',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.b', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Held Org B',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.c', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Held Org C',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.a')::uuid, 'payments_client_id', '990401', 'made up', 'prepaid');
select api.identifier_add(current_setting('t.b')::uuid, 'payments_client_id', '990402', 'made up', 'prepaid');
-- recorded here: tied by its client ID (not held) · no client and no organisation · shared number with an import
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'HLD-OK', 'client_id', '990401', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000),
  jsonb_build_object('ref', 'HLD-NOORG', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300),
  jsonb_build_object('ref', 'HLD-SAME', 'client_id', '990401', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200),
  jsonb_build_object('ref', 'HLD-BOTH', 'client_id', '990401', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 150)),
  now() - interval '1 day');
-- imported: under B, the SAME number as a row of A (two documents) · under A, the same document as HLD-BOTH (one
-- document, both doors) · under C, which holds no client ID at all
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
select gen_random_uuid(), p::uuid, 'invoice_export', 'made-up-hld.csv', current_setting('t.head')::uuid
from unnest(array[current_setting('t.a'), current_setting('t.b'), current_setting('t.c')]) p;
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, fully_paid, created_by)
select v.p::uuid, (select b.id from work.import_batch b where b.partner_id = v.p::uuid), v.kind, v.txn, v.inv,
       current_setting('t.d')::date, v.amount, v.amount, true, current_setting('t.head')::uuid
from (values (current_setting('t.b'), 'invoice', null, 'HLD-SAME', 70::numeric),
             (current_setting('t.a'), 'invoice', null, 'HLD-BOTH', 150),
             (current_setting('t.c'), 'transaction', 'HLD-NOID', 'HLD-INV-3', 40)) v(p, kind, txn, inv, amount);
select test.done();

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ledger', (api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) -> 'totals')::text, true);
-- what is held, and why
select test.eq(pg_temp.reasons_of('HLD-OK'), '{}'::text[], 'a row tied by its client ID is not held');
select test.eq(pg_temp.reasons_of('HLD-NOORG'), array['no_organisation'], 'a row that matches no organisation is held, and says why');
select test.eq(pg_temp.reasons_of('HLD-NOID'), array['no_client_id'], 'an imported row whose organisation holds no client ID is held');
select test.eq(pg_temp.reasons_of('HLD-SAME'), array['same_number', 'same_number'],
  'one number under two organisations: both rows are listed');
select test.eq(pg_temp.reasons_of('HLD-BOTH'), '{}'::text[],
  'one document through both doors is one row, not a shared number');
select test.eq((pg_temp.held() -> 'totals' -> 'no_organisation' ->> 'amount')::numeric, 300.00, 'with its amount');
select test.eq((pg_temp.held() -> 'totals' -> 'same_number' ->> 'units')::int, 2, 'two rows share a number');
select test.eq((pg_temp.held() -> 'totals' -> 'same_number' ->> 'amount')::numeric, 270.00, '200 + 70');
select test.eq((pg_temp.held() ->> 'units')::int, 4, 'four held rows in all');
-- held, never dropped: every one of them is still a Ledger row and still counts
select test.eq((select count(*)::int from jsonb_array_elements(api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) -> 'rows') r
                where r ->> 'number' in ('HLD-NOORG', 'HLD-NOID', 'HLD-SAME') and (r ->> 'counted')::boolean), 4,
  'the held rows are all in the Ledger and counted: none was dropped');
select test.eq((current_setting('t.ledger')::jsonb ->> 'revenue')::numeric, 1000.00 + 300 + 200 + 150 + 70 + 40,
  'the Ledger counts every row: the two documents sharing a number both, the both-doors document once');
select test.eq((api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) -> 'totals')::jsonb, current_setting('t.ledger')::jsonb,
  'reading the held list moved no figure');
-- once the organisation holds a client ID, its row is no longer held
select api.identifier_add(current_setting('t.c')::uuid, 'payments_client_id', '990403', 'made up', 'prepaid');
select test.eq(pg_temp.reasons_of('HLD-NOID'), '{}'::text[], 'tied by a person: no longer held');
-- a bad period is refused; a reader below View on Finance reads nothing
select test.raises($$select api.finance_held_rows('2026-02-01'::date, '2026-01-01'::date)$$, 'P0001', 'a period the wrong way round is refused');
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.member')::uuid, 'finance', 'none', 'made up: no Finance access');
select test.as_person(current_setting('t.member')::uuid);
select test.raises($$select api.finance_held_rows('2026-01-01'::date, '2026-12-31'::date)$$, '42501', 'no level on Finance, no held list');
