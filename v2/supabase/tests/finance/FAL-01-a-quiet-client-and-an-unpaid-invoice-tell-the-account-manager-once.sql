-- FAL-01 — the Finance daily alerts (V401, §3.3). A client with no fully paid invoice for 60 days, and an invoice still
-- owed 45 days after it was issued, each tell the client's account manager — once, however often the job runs; a client
-- paid lately and an invoice issued lately tell nobody. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-quiet-client-tells-nobody.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Quiet Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.r', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Busy Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select api.identifier_add(current_setting('t.q')::uuid, 'payments_client_id', '85001', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.r')::uuid, 'payments_client_id', '85002', 'made up', 'postpaid');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 200 where person_id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8501', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 75)::text,
                     'paid_on', (current_setting('t.t')::date - 70)::text, 'total_sar', 100, 'client_id', '85001'),
  jsonb_build_object('ref', 'SA-8502', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 12)::text,
                     'paid_on', (current_setting('t.t')::date - 10)::text, 'total_sar', 100, 'client_id', '85002'),
  jsonb_build_object('ref', 'SA-8503', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 50)::text,
                     'total_sar', 300, 'client_id', '85002'),
  jsonb_build_object('ref', 'SA-8504', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 10)::text,
                     'total_sar', 80, 'client_id', '85002')), now() - interval '1 day');

select test.as_owner();
select notify.generate_alerts();
select test.eq((select jsonb_agg(jsonb_build_object('kind', n.kind, 'on',
                  coalesce(n.label_args ->> 'name', n.label_args ->> 'ref')) order by n.kind)
                from notify.notification n
                where n.person_id = current_setting('t.am')::uuid and n.kind in ('alert_quiet_client', 'alert_invoice_unpaid')),
  '[{"kind": "alert_invoice_unpaid", "on": "SA-8503"}, {"kind": "alert_quiet_client", "on": "Made Up Quiet Co"}]'::jsonb,
  'a client quiet for 60 days and an invoice owed 45 days after issue tell the account manager; the recent ones do not');
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification n
                where n.person_id = current_setting('t.am')::uuid and n.kind in ('alert_quiet_client', 'alert_invoice_unpaid')),
  2, 'once, however often the job runs');
