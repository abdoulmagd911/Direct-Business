-- CID-01 — an imported row records WHICH code it carries (Landing 32, A3). At import the row's code text is
-- matched to the code's own row: found → code_id, with the code type and the batch's time; no code carries the
-- text → "Code has not been found", on the row and in the Ledger, never silent; more than one code row carries
-- it → held for a person, never guessed. The migration's backfill is the same match over the stored rows: its
-- statement, run here over rows whose code arrived later, fills exactly the rows that now match.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-unknown-code-is-silent.sql, a-code-shared-by-two-rows-is-guessed.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Code Id Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
-- one code that exists now; one text held by two code rows (two periods); one text no code carries
select set_config('t.code', api.identifier_add(current_setting('t.p')::uuid, 'discount_code', 'MADEUPFOUND', 'made up') ->> 'id', true);
-- (an organisation holds one code, so each made-up code has its own made-up holder)
select set_config('t.p2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Code Holder Two',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.p3', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Code Holder Three',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.p4', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Code Holder Four',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p2')::uuid, 'discount_code', 'MADEUPTWICE', 'made up', null, '2025-01-01'::date, '2025-12-31'::date);
select api.identifier_add(current_setting('t.p3')::uuid, 'discount_code', 'MADEUPTWICE', 'made up', null, '2026-01-01'::date, '2026-12-31'::date);
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up-cid.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, source_promo, attribution_promo, created_by)
select current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', v.tx, v.tx || '-INV', current_setting('t.d')::date,
       100, 100, 10, 90, true, v.promo, v.attr, current_setting('t.head')::uuid
from (values ('CID-FOUND', ' madeupfound ', false), ('CID-PROMO', 'MADEUPFOUND', true), ('CID-TWICE', 'MADEUPTWICE', false),
             ('CID-NONE', 'MADEUPNOWHERE', false), ('CID-LATER', 'MADEUPLATER', false), ('CID-PLAIN', null, false)) v(tx, promo, attr);
select test.done();

select test.as_owner();
create function pg_temp.rec(p_tx text) returns work.import_record language sql as
$$ select r from work.import_record r where r.transaction_ref = p_tx $$;
-- set at import
select test.eq((pg_temp.rec('CID-FOUND')).code_id, current_setting('t.code')::uuid, 'a text one code carries records that code''s id (the key, not the spelling)');
select test.eq((pg_temp.rec('CID-FOUND')).code_state, 'found', 'and says found');
select test.eq((pg_temp.rec('CID-FOUND')).code_type, 'discount', 'a money row that only carries a code is a discount');
select test.eq((pg_temp.rec('CID-PROMO')).code_type, 'promo', 'a row attributed to the code is a promo use');
select test.eq((pg_temp.rec('CID-FOUND')).code_at, (select b.created_at from work.import_batch b where b.id = current_setting('t.b')::uuid),
  'the import time is the batch''s');
select test.eq((pg_temp.rec('CID-NONE')).code_state, 'not_found', 'a text no code carries is marked: Code has not been found');
select test.ok((pg_temp.rec('CID-NONE')).code_id is null, 'with no id');
select test.eq((pg_temp.rec('CID-TWICE')).code_state, 'ambiguous', 'a text two code rows carry is held for a person');
select test.ok((pg_temp.rec('CID-TWICE')).code_id is null, 'never guessed');
select test.ok((pg_temp.rec('CID-PLAIN')).code_state is null and (pg_temp.rec('CID-PLAIN')).code_id is null,
  'a row with no code text carries nothing');

-- never silent: the Ledger row says so
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ul', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((select r -> 'flags' ? 'code_not_found' from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'rows') r where r ->> 'number' = 'CID-NONE'),
  true, 'the Ledger row carries the flag "Code has not been found"');
select test.eq((select r ->> 'code_state' from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'rows') r where r ->> 'number' = 'CID-TWICE'),
  'ambiguous', 'and the held one says it is held');
select test.eq((select r -> 'flags' ? 'code_not_found' from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'rows') r where r ->> 'number' = 'CID-FOUND'),
  false, 'a found code raises no flag');
-- the preview's check, before anything is stored
select test.eq(api.import_code_check('MADEUPNOWHERE') ->> 'state', 'not_found', 'the preview check says not found');
select test.eq(api.import_code_check('madeupfound') ->> 'code_id', current_setting('t.code'), 'and names the code when found');
select test.eq(api.import_code_check('MADEUPTWICE') ->> 'state', 'ambiguous', 'and held when two rows carry it');

-- the backfill: the code MADEUPLATER arrives after the row was stored; the migration's statement fills it
select test.as_owner();
select test.eq((pg_temp.rec('CID-LATER')).code_state, 'not_found', 'before: stored without a code');
select set_config('t.before', (select count(*)::text from work.import_record where code_id is not null and partner_id = current_setting('t.p')::uuid), true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.later', api.identifier_add(current_setting('t.p4')::uuid, 'discount_code', 'MADEUPLATER', 'made up') ->> 'id', true);
select test.as_owner();
select test.act(current_setting('t.head')::uuid);
update work.import_record r set source_promo = r.source_promo
where r.source_promo is not null and pg_catalog.btrim(r.source_promo) <> '';
select test.done();
select test.eq((pg_temp.rec('CID-LATER')).code_id, current_setting('t.later')::uuid, 'after: the same match fills the stored row');
select test.eq((select count(*)::int from work.import_record where code_id is not null and partner_id = current_setting('t.p')::uuid),
  current_setting('t.before')::int + 1, 'the backfill count: exactly one more row carries a code id');
select test.eq((select count(*)::int from work.import_record where code_state = 'ambiguous' and partner_id = current_setting('t.p')::uuid), 1,
  'the held row is still held');
