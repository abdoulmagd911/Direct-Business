-- D24-01 — income by service (D24, spec §3.6; V483). Each line goes to one service: the line's own (a person's), else
-- the item map on the first part of its name, else its product's, else No service yet. A "not income" service sits on
-- its own row; a wallet top-up line is not revenue; what the lines do not cover is Not split by line. The rows add up to
-- the revenue tile with no gap, and each unit's cost split by share adds up to its cost. Every value is made up.
-- Sabotage: supabase/tests/sabotage/income-by-service-drops-what-the-lines-do-not-cover.sql.
select set_config('t.adm', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month' + interval '9 days')::date::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-6101', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
    'total_sar', 1000, 'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Flights', 'name', 'Flight ticket', 'total_sar', 600),
      jsonb_build_object('line_no', 2, 'product', 'Direct Hotels', 'name', 'Chauffeur Service - Partner Fee', 'total_sar', 300),
      jsonb_build_object('line_no', 3, 'name', 'Made up item', 'total_sar', 100))),
  jsonb_build_object('ref', 'TX-6102', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
    'total_sar', 500, 'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel night', 'total_sar', 400),
      jsonb_build_object('line_no', 2, 'product', 'Direct Insurance', 'name', 'Travel cover', 'total_sar', 50))),
  jsonb_build_object('ref', 'TX-6103', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
    'total_sar', 200, 'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Wallet Top-up', 'name', 'Wallet', 'total_sar', 80),
      jsonb_build_object('line_no', 2, 'product', 'Direct Visas', 'name', 'Visa', 'total_sar', 120))),
  jsonb_build_object('ref', 'TX-6104', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
    'total_sar', 70)),
  now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-6101', 'expense_type', 'Flight', 'status', 'Approved', 'amount_sar', 100,
                     'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '1 day');

-- an admin marks a service not income and maps an item; a person sets one line's service
select test.as_owner();
select set_config('t.ins', (select id from finance.service where key = 'insurance')::text, true);
select set_config('t.insv', (select version from finance.service where key = 'insurance')::text, true);
select set_config('t.tr', (select id from finance.service where key = 'transport')::text, true);
select set_config('t.ho', (select id from finance.service where key = 'hotels')::text, true);
select set_config('t.l', (select l.id from finance.invoice_line l join finance.invoice i on i.id = l.invoice_id
                          where i.ref = 'TX-6102' and l.line_no = 1)::text, true);
select set_config('t.lv', (select version from finance.invoice_line where id = current_setting('t.l')::uuid)::text, true);
select test.as_person(current_setting('t.adm')::uuid);
select api.list_save('service', current_setting('t.ins')::uuid, '{"counts_as_income": false}', current_setting('t.insv')::int,
                     'made up: not income');
select api.list_save('item_service', null, jsonb_build_object('name_en', 'Chauffeur Service', 'name_ar', 'خدمة سائق',
                     'service_id', current_setting('t.tr')), null, 'made up: an item map');
select test.raises(format('select api.list_save(%L, null, %L)', 'item_service',
  jsonb_build_object('name_en', 'chauffeur  service - other', 'name_ar', 'سائق', 'service_id', current_setting('t.ho'))),
  '23505', 'an item is mapped once, its first part compared folded', 'list.key_taken');
select test.as_person(current_setting('t.head')::uuid);
select api.finance_row_edit('invoice_line', current_setting('t.l')::uuid, '{"service": "packages"}', current_setting('t.lv')::int);

select test.as_owner();
select test.eq((select jsonb_agg(jsonb_build_object('ref', i.ref, 'line', x.line_no, 'by', x.mapped_by) order by i.ref, x.line_no)
                from finance.line_service x join finance.invoice i on i.id = x.invoice_id
                where i.ref in ('TX-6101', 'TX-6102')),
  '[{"ref": "TX-6101", "line": 1, "by": "product"}, {"ref": "TX-6101", "line": 2, "by": "item"},
    {"ref": "TX-6101", "line": 3, "by": null}, {"ref": "TX-6102", "line": 1, "by": "line"},
    {"ref": "TX-6102", "line": 2, "by": "product"}]'::jsonb,
  'a line''s own service wins, then the item map on its first part, then its product''s; else none');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r', api.finance_income_by_service(current_setting('t.d')::date, current_setting('t.d')::date)::text, true);
select test.eq((select jsonb_agg(jsonb_build_object('part', e ->> 'part', 'service', e ->> 'service_key',
                                                    'revenue', (e ->> 'revenue')::numeric, 'cost', (e ->> 'cost')::numeric,
                                                    'units', (e ->> 'units')::int))
                from jsonb_array_elements(current_setting('t.r')::jsonb -> 'rows') e),
  '[{"part": "service", "service": "flights", "revenue": 600, "cost": 60, "units": 1},
    {"part": "service", "service": "visas", "revenue": 120, "cost": 0, "units": 1},
    {"part": "service", "service": "transport", "revenue": 300, "cost": 30, "units": 1},
    {"part": "service", "service": "packages", "revenue": 400, "cost": 0, "units": 1},
    {"part": "not_income", "service": "insurance", "revenue": 50, "cost": 0, "units": 1},
    {"part": "no_service", "service": null, "revenue": 100, "cost": 10, "units": 1},
    {"part": "not_split", "service": null, "revenue": 120, "cost": 0, "units": 2}]'::jsonb,
  'each line to one service; not income on its own row; the wallet line left out; the rest Not split by line');
select test.eq((current_setting('t.r')::jsonb ->> 'revenue')::numeric,
  (api.finance_period(current_setting('t.d')::date, current_setting('t.d')::date) ->> 'revenue')::numeric,
  'the page''s revenue is the revenue tile');
select test.eq((current_setting('t.r')::jsonb ->> 'gap')::numeric, 0::numeric, 'and the rows add up to it, nothing hidden');

select test.as_owner();
select test.eq((select count(*)::int from (
                  select x.invoice_id, x.unit_kind, sum(x.revenue) as rv, sum(x.cost) as cs
                  from finance.money_service_row x group by x.invoice_id, x.unit_kind) s
                join finance.money_row r on r.invoice_id = s.invoice_id and r.unit_kind = s.unit_kind
                where s.rv <> r.revenue or s.cs is distinct from r.cost), 0,
  'every unit''s parts add up to its revenue and its cost');
