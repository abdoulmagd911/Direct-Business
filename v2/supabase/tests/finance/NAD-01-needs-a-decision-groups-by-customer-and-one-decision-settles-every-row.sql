-- NAD-01 — Needs a decision (P4-3, §3.5; V420, V421, V412, D25). Rows no organisation holds wait grouped by customer —
-- their strongest clue — with the count and the riyals at stake; an organisation's own name is only a suggestion, never a
-- match. "This is client X" adds the clue to X and every row of the customer matches; a typed alias matches a row with
-- no client ID; "Individual" lists the name and its rows leave the queue. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-organisation-s-name-matches-by-itself.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.x', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Group Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8701', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 20)::text,
                     'total_sar', 100, 'client_id', '87001'),
  jsonb_build_object('ref', 'SA-8702', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 10)::text,
                     'total_sar', 50, 'client_id', '87001'),
  jsonb_build_object('ref', 'SA-8703', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 10)::text,
                     'total_sar', 30, 'customer_name', 'Made Up Traveller'),
  jsonb_build_object('ref', 'SA-8704', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 10)::text,
                     'total_sar', 20, 'customer_name', 'Made Up Group Co'),
  jsonb_build_object('ref', 'SA-8705', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 10)::text,
                     'total_sar', 15, 'customer_name', 'MU Group Trading')), now() - interval '1 day');

select set_config('t.q', api.match_queue()::text, true);
select test.eq((select jsonb_agg(jsonb_build_object('clue', e ->> 'clue', 'value', e ->> 'value', 'states', e -> 'states',
                                                    'rows', (e ->> 'rows')::int, 'amount_sar', (e ->> 'amount_sar')::numeric))
                from jsonb_array_elements(current_setting('t.q')::jsonb) e),
  '[{"clue": "client_id", "value": "87001", "states": ["unknown_client_id"], "rows": 2, "amount_sar": 150},
    {"clue": "name", "value": "Made Up Traveller", "states": ["none"], "rows": 1, "amount_sar": 30},
    {"clue": "name", "value": "Made Up Group Co", "states": ["none"], "rows": 1, "amount_sar": 20},
    {"clue": "name", "value": "MU Group Trading", "states": ["none"], "rows": 1, "amount_sar": 15}]'::jsonb,
  'rows wait grouped by customer, with the count and the riyals at stake; an organisation''s own name does not match');
select test.eq((select e -> 'suggestions' from jsonb_array_elements(current_setting('t.q')::jsonb) e
                where e ->> 'value' = 'Made Up Group Co'), jsonb_build_array(current_setting('t.x')),
  'it is only suggested');

-- This is client X: the client ID; a typed alias for a name; an individual
select api.match_decide((select e ->> 'key' from jsonb_array_elements(current_setting('t.q')::jsonb) e where e ->> 'clue' = 'client_id'),
                        'partner', current_setting('t.x')::uuid, 'made up: this is the group');
select api.match_decide((select e ->> 'key' from jsonb_array_elements(current_setting('t.q')::jsonb) e
                         where e ->> 'value' = 'MU Group Trading'), 'partner', current_setting('t.x')::uuid, 'made up: its trading name');
select api.match_decide((select e ->> 'key' from jsonb_array_elements(current_setting('t.q')::jsonb) e
                         where e ->> 'value' = 'Made Up Traveller'), 'individual', null, 'made up: a person');
select test.as_owner();
select test.eq((select jsonb_object_agg(f.ref, f.match_state || coalesce(':' || (f.partner_id = current_setting('t.x')::uuid)::text, ''))
                from finance.invoice_fact f where f.ref like 'SA-87%'),
  '{"SA-8701": "matched:true", "SA-8702": "matched:true", "SA-8703": "individual", "SA-8704": "none",
    "SA-8705": "matched:true"}'::jsonb,
  'one decision settles every row of the customer: the client ID matches, the alias matches, the person is an individual');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select jsonb_agg(e ->> 'value') from jsonb_array_elements(api.match_queue()) e), '["Made Up Group Co"]'::jsonb,
  'and they leave the queue');
select test.raises(format('select api.match_decide(%L, %L)',
                          (select e ->> 'key' from jsonb_array_elements(api.match_queue()) e), 'merge'),
  'P0001', 'an unknown decision is refused', 'match.unknown_decision');
