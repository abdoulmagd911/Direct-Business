-- TND-01 — a tender in Finance (the Finance screens brief I.7; V614, V619). A signed tender shows its signed value (the
-- awarded value), what its paid units have consumed, what is left and what is over, with the units above the signed
-- value; only the counted units carrying the tender's own client ID consume it — not a unit still pending, not another
-- of the organisation's IDs, and nothing at all until the tender names its ID. A tender only Applied shows no money.
-- Naming the ID needs Full on Finance, takes only a tender client ID of the same organisation that no other tender has
-- named, and one Undo takes it back. The signing is the account manager's sales credit in the signing month, and never
-- revenue: the period's revenue is the paid units alone. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-tender-is-consumed-by-any-client-id.sql, an-applied-tender-shows-money.sql,
-- a-tender-names-another-organisations-client-id.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Authority',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select set_config('t.other', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Other Authority',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government')))) ->> 'id', true);
select api.identifier_add(current_setting('t.gov')::uuid, 'payments_client_id', '87001', 'made up', 'tender');
select api.identifier_add(current_setting('t.gov')::uuid, 'payments_client_id', '87002', 'made up', 'tender');
select api.identifier_add(current_setting('t.gov')::uuid, 'payments_client_id', '87009', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.other')::uuid, 'payments_client_id', '87101', 'made up', 'tender');
select test.as_owner();
select set_config('t.id1', (select id::text from partner.identifier where value_raw = '87001'), true);
select set_config('t.id2', (select id::text from partner.identifier where value_raw = '87002'), true);
select set_config('t.idp', (select id::text from partner.identifier where value_raw = '87009'), true);
select set_config('t.ido', (select id::text from partner.identifier where value_raw = '87101'), true);
-- the account manager since August, before the signing
update partner.side_owner set effective_from = '2026-08-01'
where partner_id = current_setting('t.gov')::uuid and side = 'client';

-- T1 signed in September at 900 awarded; T2 only applied
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.T1', api.tender_save(null, jsonb_build_object('title', 'Made-up delegation travel', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'value_sar', 1000, 'happened_on', '2026-08-20')) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'awarded', '2026-09-05', '{"awarded_value_sar": 900}');
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'signed', '2026-09-10');
select set_config('t.T2', api.tender_save(null, jsonb_build_object('title', 'Made-up conference travel', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'value_sar', 5000, 'happened_on', '2026-09-01')) ->> 'id', true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-61', 'status', 'Fully Paid', 'created_on', '2026-09-12', 'total_sar', 600, 'client_id', '87001'),
  jsonb_build_object('ref', 'TX-62', 'status', 'Fully Paid', 'created_on', '2026-09-15', 'total_sar', 500, 'client_id', '87001'),
  jsonb_build_object('ref', 'TX-63', 'status', 'Published', 'created_on', '2026-09-16', 'total_sar', 100, 'client_id', '87001'),
  jsonb_build_object('ref', 'TX-64', 'status', 'Fully Paid', 'created_on', '2026-09-17', 'total_sar', 50, 'client_id', '87009')),
  now() - interval '1 day');

select test.eq((select jsonb_build_object('consumed', t -> 'consumed', 'named', t -> 'client_id_named')
                from jsonb_array_elements(api.finance_tenders(current_setting('t.gov')::uuid)) t
                where t ->> 'id' = current_setting('t.T1')),
  '{"consumed": 0, "named": false}'::jsonb, 'nothing consumes a tender until it names its client ID');

-- naming the ID: Full on Finance, a tender ID of the same organisation, one tender per ID
select test.as_person(current_setting('t.am')::uuid);
select test.raises(format('select api.finance_tender_client_id_set(%L, %L)', current_setting('t.T1'), current_setting('t.id1')),
  '42501', 'Own on Finance names no client ID', 'access.needs_level');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.finance_tender_client_id_set(%L, %L)', current_setting('t.T1'), current_setting('t.idp')),
  'P0001', 'a postpaid ID is not a tender''s', 'finance.tender_client_id_invalid');
select test.raises(format('select api.finance_tender_client_id_set(%L, %L)', current_setting('t.T1'), current_setting('t.ido')),
  'P0001', 'another organisation''s tender ID is refused', 'finance.tender_client_id_invalid');
select set_config('t.r', api.finance_tender_client_id_set(current_setting('t.T1')::uuid, current_setting('t.id1')::uuid,
                                                          'made up: the award letter names it')::text, true);
select test.raises(format('select api.finance_tender_client_id_set(%L, %L)', current_setting('t.T2'), current_setting('t.id1')),
  '23505', 'an ID one tender has named is not named by another', 'finance.tender_client_id_taken');

select test.as_owner();
select set_config('t.n1', (select number from pipeline.tender where id = current_setting('t.T1')::uuid), true);
select set_config('t.x62', (select id::text from finance.invoice where ref = 'TX-62'), true);
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select t - 'id' - 'partner_id' - 'title'
                from jsonb_array_elements(api.finance_tenders(current_setting('t.gov')::uuid)) t
                where t ->> 'id' = current_setting('t.T1')),
  jsonb_build_object('number', current_setting('t.n1'),
    'state', 'signed', 'signed_on', '2026-09-10', 'client_id_named', true, 'signed_value', 900.00, 'consumed', 1100.00,
    'left', 0, 'over', 200.00, 'units', 2,
    'units_over', jsonb_build_array(jsonb_build_object('invoice_id', current_setting('t.x62'),
                                                       'ref', 'TX-62', 'created_on', '2026-09-15', 'revenue', 500.00))),
  'signed at the awarded value; only its own ID''s paid units consume it; what is over, and the unit above it');
select test.eq((select jsonb_build_object('state', t -> 'state', 'signed_value', t -> 'signed_value', 'consumed', t -> 'consumed',
                                          'left', t -> 'left', 'over', t -> 'over')
                from jsonb_array_elements(api.finance_tenders(current_setting('t.gov')::uuid)) t
                where t ->> 'id' = current_setting('t.T2')),
  '{"state": "applied", "signed_value": null, "consumed": null, "left": null, "over": null}'::jsonb,
  'a tender only Applied shows no money');

-- the signing is sales credit in its month, never revenue
select test.eq(api.finance_tender_credit('2026-09-01', '2026-09-30') - 'from' - 'to',
  jsonb_build_object('tenders', 1, 'sales_credit', 900.00, 'rows', jsonb_build_array(jsonb_build_object(
    'month', '2026-09-01', 'person_id', current_setting('t.am'), 'tenders', 1, 'sales_credit', 900.00))),
  'the signing is the account manager''s sales credit in the signing month');
select test.eq((api.finance_period('2026-09-01', '2026-09-30') ->> 'revenue')::numeric, 1150::numeric,
  'and never revenue: the month''s revenue is its paid units alone');
select test.raises($$select api.finance_tender_credit('2026-10-01', '2026-09-01')$$, 'P0001',
  'a period that ends before it starts is refused', 'common.invalid');

-- one Undo takes the naming back
select api.undo((current_setting('t.r')::jsonb ->> 'request_id')::uuid);
select test.eq((select (t ->> 'consumed')::numeric from jsonb_array_elements(api.finance_tenders(current_setting('t.gov')::uuid)) t
                where t ->> 'id' = current_setting('t.T1')), 0::numeric, 'Undo takes the naming back');
