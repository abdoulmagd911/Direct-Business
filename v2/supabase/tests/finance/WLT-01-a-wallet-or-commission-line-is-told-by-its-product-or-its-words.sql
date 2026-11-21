-- WLT-01 — a wallet line is told by its product or by its words, a commission line by its words, in either
-- language and however the name is typed (V617; Landing 35).
-- Landing 35 made the money rows read the wallet and commission words ONCE per read (finance.wallet_words,
-- finance.wallet_product_ids, finance.commission_words) instead of folding every word again for every invoice
-- line. This file pins that the fast path and finance.is_wallet_line agree line by line — there is one meaning of
-- "a wallet line" — and that the answers are the ones the rule gives: the wallet part is never revenue, a
-- commission line marks its unit, a switched-off or removed rule stops counting at once.
-- Every value is made up. Sabotages: supabase/tests/sabotage/a-wallet-word-is-read-in-english-only.sql,
-- a-switched-off-wallet-rule-still-counts.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  -- the wallet product
  jsonb_build_object('ref', 'TX-W1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
    'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Made up hotel night', 'total_sar', 700),
      jsonb_build_object('line_no', 2, 'product', 'Wallet Top-up', 'name', 'Made up credit', 'total_sar', 300))),
  -- the English word, typed in capitals, on another product
  jsonb_build_object('ref', 'TX-W2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
    'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Made up hotel night', 'total_sar', 800),
      jsonb_build_object('line_no', 2, 'product', 'Direct Hotels', 'name', 'Made-up WALLET refill', 'total_sar', 200))),
  -- the Arabic word, typed with a stretch mark inside it
  jsonb_build_object('ref', 'TX-W3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
    'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Made up hotel night', 'total_sar', 850),
      jsonb_build_object('line_no', 2, 'product', 'Direct Hotels', 'name', 'شحن محـفظة العميل', 'total_sar', 150))),
  -- no wallet line at all
  jsonb_build_object('ref', 'TX-W4', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
    'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Visas', 'name', 'Made up visa', 'total_sar', 500))),
  -- a commission line, in English and in Arabic
  jsonb_build_object('ref', 'TX-W5', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400,
    'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Made up COMMISSION on a booking', 'total_sar', 400))),
  jsonb_build_object('ref', 'TX-W6', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 600,
    'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'عمولة حجز', 'total_sar', 600))),
  -- a word no rule knows yet
  jsonb_build_object('ref', 'TX-W7', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900,
    'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Made up hotel night', 'total_sar', 650),
      jsonb_build_object('line_no', 2, 'product', 'Direct Hotels', 'name', 'Made up purse refill', 'total_sar', 250)))),
  now() - interval '1 day');

select test.as_owner();
-- line by line: the fast path (the line's service row) says what finance.is_wallet_line says
select test.eq(
  (select pg_catalog.count(*)::int from finance.line_service s
   join finance.invoice_line l on l.id = s.line_id
   where s.wallet is distinct from finance.is_wallet_line(l.product_id, l.name)),
  0, 'every line: the list read and finance.is_wallet_line agree');
select test.eq((select s.wallet from finance.line_service s join finance.invoice i on i.id = s.invoice_id
                where i.ref = 'TX-W1' and s.line_no = 2), true, 'the wallet product marks its line');
select test.eq((select s.wallet from finance.line_service s join finance.invoice i on i.id = s.invoice_id
                where i.ref = 'TX-W2' and s.line_no = 2), true, 'the English wallet word marks its line, however it is typed');
select test.eq((select s.wallet from finance.line_service s join finance.invoice i on i.id = s.invoice_id
                where i.ref = 'TX-W3' and s.line_no = 2), true, 'an Arabic wallet word marks its line');
select test.eq((select pg_catalog.count(*)::int from finance.line_service s join finance.invoice i on i.id = s.invoice_id
                where i.ref in ('TX-W1', 'TX-W2', 'TX-W3', 'TX-W7') and s.line_no = 1 and s.wallet), 0,
  'a hotel night is no wallet line');
-- the wallet part is never revenue; a commission line marks its unit
select test.eq((select jsonb_object_agg(f.ref, jsonb_build_object('wallet', f.wallet_sar, 'commission', f.commission) order by f.ref)
                from finance.invoice_fact f where f.ref like 'TX-W%'),
  '{"TX-W1": {"wallet": 300.00, "commission": false}, "TX-W2": {"wallet": 200.00, "commission": false},
    "TX-W3": {"wallet": 150.00, "commission": false}, "TX-W4": {"wallet": 0, "commission": false},
    "TX-W5": {"wallet": 0, "commission": true}, "TX-W6": {"wallet": 0, "commission": true},
    "TX-W7": {"wallet": 0, "commission": false}}'::jsonb,
  'each invoice: its wallet part, and whether a line is commission — English or Arabic');
select test.eq((select jsonb_object_agg(r.ref, r.revenue order by r.ref) from finance.money_row r where r.ref like 'TX-W%'),
  '{"TX-W1": 700.00, "TX-W2": 800.00, "TX-W3": 850.00, "TX-W4": 500.00, "TX-W5": 400.00, "TX-W6": 600.00, "TX-W7": 900.00}'::jsonb,
  'revenue is the total less its wallet part');
select test.eq((select r.cost_status from finance.money_row r where r.ref = 'TX-W5'), 'provisional',
  'a commission unit with no expense status yet waits like any other');

-- a new rule applies to past rows at once; switched off, or removed, it stops at once
select test.act(current_setting('t.head')::uuid);
insert into finance.wallet_rule (key, name_en, name_ar, kind, created_by)
values ('made_up_purse', 'Made Up Purse', 'حافظة مختلقة', 'name_contains', current_setting('t.head')::uuid);
select test.done();
select test.eq((select f.wallet_sar from finance.invoice_fact f where f.ref = 'TX-W7'), 250.00, 'a new wallet word marks the past line at once');
select test.eq((select r.revenue from finance.money_row r where r.ref = 'TX-W7'), 650.00, 'and its part leaves revenue');
select test.act(current_setting('t.head')::uuid);
update finance.wallet_rule set active = false where key = 'made_up_purse';
select test.done();
select test.eq((select r.revenue from finance.money_row r where r.ref = 'TX-W7'), 900.00, 'a switched-off wallet rule stops counting at once');
select test.eq(finance.is_wallet_line(null, 'Made up purse refill'), false, 'and finance.is_wallet_line says the same');
select test.act(current_setting('t.head')::uuid);
update finance.wallet_rule set active = true where key = 'made_up_purse';
update finance.wallet_rule set deleted_at = now(), deleted_by = current_setting('t.head')::uuid, delete_reason = 'made up'
where key = 'made_up_purse';
select test.done();
select test.eq((select r.revenue from finance.money_row r where r.ref = 'TX-W7'), 900.00, 'a removed wallet rule counts nowhere');
-- a line with no name and no product is no wallet line, never an error
select test.eq(finance.is_wallet_line(null, null), false, 'a line with no name and no product is no wallet line');
