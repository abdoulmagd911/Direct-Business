-- MATCH-01 — the money match (§3.5; V65, V411, V412, V420, V421). A client ID nobody holds stops the match even when
-- another organisation holds the row's email (V420); a closed client ID still matches the rows booked before it closed
-- and stops the ones after (V411); the levels run in the order of partner.match_order and the first that finds anyone
-- decides; a phone matches; two holders are a conflict listing both, in Needs a decision as well; a live campaign code
-- is credited to nobody and never waits in Needs a decision (V65); a blocked value matches nothing. Every value is made
-- up.
-- Sabotages: supabase/tests/sabotage/an-unknown-client-id-falls-through.sql,
-- supabase/tests/sabotage/the-match-order-is-fixed.sql, supabase/tests/sabotage/a-campaign-code-waits-for-a-decision.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.d', (core.riyadh_today() - 20)::text, true);
select set_config('t.late', (core.riyadh_today() - 2)::text, true);

select test.as_person(current_setting('t.admin')::uuid);
create temporary table orgs (k text primary key, id uuid) on commit drop;
grant all on orgs to public;
insert into orgs select k, (api.partner_create(jsonb_build_object('trade_name_en', 'Made Up ' || k || ' Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id')::uuid
from unnest(array['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) k;
select api.identifier_add((select id from orgs where k = 'a'), 'email', 'buyer@made-up-a.test', 'made up');
select api.identifier_add((select id from orgs where k = 'b'), 'payments_client_id', '91011', 'made up', 'postpaid');
select api.identifier_add((select id from orgs where k = 'c'), 'vat', '300000000000013', 'made up');
select api.identifier_add((select id from orgs where k = 'd'), 'email', 'office@made-up-d.test', 'made up');
select api.identifier_add((select id from orgs where k = 'e'), 'phone', '+966 50 000 0001', 'made up');
select api.identifier_add((select id from orgs where k = 'f'), 'vat', '300000000000023', 'made up');
select api.identifier_add((select id from orgs where k = 'g'), 'cr', '300000000000023', 'made up');
select api.identifier_add((select id from orgs where k = 'h'), 'email', 'staff@made-up-h.test', 'made up');
select api.identifier_block_add('email', 'exact', 'staff@made-up-h.test', 'made up: a staff address');
select api.campaign_code_add('MADEUPSUMMER', 'Made-up summer campaign', current_setting('t.d')::date - 30, null, null,
                             'made up: a public campaign');
select test.as_owner();
select set_config('t.cid', (select d.id::text from partner.identifier d where d.value_raw = '91011'), true);
select test.as_person(current_setting('t.admin')::uuid);
select api.client_id_close(current_setting('t.cid')::uuid,
                           current_setting('t.d')::date + 5, 'made up: the account moved');

select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-H1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 10,
                     'client_id', '91099', 'customer_email', 'buyer@made-up-a.test'),
  jsonb_build_object('ref', 'TX-H2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 10,
                     'client_id', '91011'),
  jsonb_build_object('ref', 'TX-H3', 'status', 'Fully Paid', 'created_on', current_setting('t.late'), 'total_sar', 10,
                     'client_id', '91011'),
  jsonb_build_object('ref', 'TX-H4', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 10,
                     'tax_no', '300000000000013', 'customer_email', 'office@made-up-d.test'),
  jsonb_build_object('ref', 'TX-H5', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 10,
                     'customer_phone', '0500000001'),
  jsonb_build_object('ref', 'TX-H6', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 10,
                     'tax_no', '300000000000023'),
  jsonb_build_object('ref', 'TX-H7', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 10,
                     'discount_code', 'madeup-summer'),
  jsonb_build_object('ref', 'TX-H8', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 10,
                     'customer_email', 'staff@made-up-h.test')),
  now() - interval '1 day');

select test.as_owner();
select test.eq((select jsonb_object_agg(i.ref, jsonb_build_object('state', d.state, 'level', d.level,
                  'who', (select o.k from orgs o where o.id = d.partner_id)))
                from finance.invoice i cross join lateral finance.match_detail(i.id) d where i.ref like 'TX-H%'),
  '{"TX-H1": {"state": "unknown_client_id", "level": "client_id", "who": null},
    "TX-H2": {"state": "matched", "level": "client_id", "who": "b"},
    "TX-H3": {"state": "unknown_client_id", "level": "client_id", "who": null},
    "TX-H4": {"state": "matched", "level": "tax_no", "who": "c"},
    "TX-H5": {"state": "matched", "level": "phone", "who": "e"},
    "TX-H6": {"state": "conflict", "level": "tax_no", "who": null},
    "TX-H7": {"state": "campaign", "level": "code", "who": null},
    "TX-H8": {"state": "none", "level": null, "who": null}}'::jsonb,
  'each row matches by its first level: an unknown client ID stops, a closed one stops only after its day, a phone '
  'matches, two holders conflict, a campaign code is nobody''s, a blocked value matches nothing');
select test.eq((select (select array_agg(o.k order by o.k) from orgs o where o.id = any (d.candidates))
                from finance.invoice i cross join lateral finance.match_detail(i.id) d where i.ref = 'TX-H6'),
  array['f', 'g'], 'a conflict lists every candidate');
select test.ok((select d.campaign_code_id is not null from finance.invoice i cross join lateral finance.match_detail(i.id) d
                where i.ref = 'TX-H7'), 'and names its campaign code');
select test.eq((select c.person_id from finance.credit_row c join finance.invoice i on i.id = c.invoice_id where i.ref = 'TX-H7'),
  null::uuid, 'a campaign code''s unit is credited to nobody');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select jsonb_agg(g ->> 'value' order by g ->> 'value') from jsonb_array_elements(api.match_queue()) g
                where g ->> 'value' in ('madeup-summer', '300000000000023', '91099', '91011')),
  '["300000000000023", "91011", "91099"]'::jsonb, 'Needs a decision holds the stops and the conflict, never the campaign');
select test.eq((select jsonb_array_length(g -> 'candidates') from jsonb_array_elements(api.match_queue()) g
                where g ->> 'value' = '300000000000023'), 2, 'and lists both candidates of the conflict');

-- the order is a setting: email before VAT makes the email's holder win
select test.as_owner();
insert into core.setting (key, department_id, value, valid_from, reason)
values ('partner.match_order', null, '["client_id", "email", "tax_no", "code", "phone", "alias"]',
        current_setting('t.d')::date - 1, 'made up: email first');
select test.eq((select (select o.k from orgs o where o.id = d.partner_id)
                from finance.invoice i cross join lateral finance.match_detail(i.id) d where i.ref = 'TX-H4'),
  'd', 'with email before VAT in the order, the email''s holder wins');
