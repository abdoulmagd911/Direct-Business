-- SPD-01 — the Finance reads take the money rows once and answer fast (Landing 35; owner's live sweep, 21 Nov
-- 2026: the partner Finance tab, the Codes tab and the Finance page were cut at 8 s on about 150 invoices).
-- Two guards, so the cause cannot come back unseen:
--   1. A pin on the shape. finance.money_row is `select from finance.money_rows()` — one kept plan per
--      connection, worked out once per mention — and each read mentions it at most ONCE (it takes the rows in a
--      list at the top of its statement). A read that mentions the view twice works every invoice out twice.
--   2. A clock. At live-like made-up volume (40 organisations, 120 invoices with lines, expenses and receipts, a
--      merge rule and an exclusion rule) every partner-tab and Finance-page read answers in under 2 s — a
--      generous bound: they take a few hundredths of a second here; before Landing 35 the ledger alone took
--      half a second on this machine and four seconds on live.
-- And the answers did not move: the partner tab's totals are the hand count of the rows loaded below.
-- Every value is made up. Sabotages: supabase/tests/sabotage/the-money-rows-take-seconds.sql,
-- a-finance-read-works-the-money-rows-out-twice.sql, the-money-rows-are-planned-per-mention.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select set_config('t.y0', pg_catalog.date_trunc('year', core.riyadh_today() - 5)::date::text, true);
select set_config('t.y1', (pg_catalog.date_trunc('year', core.riyadh_today() - 5) + interval '1 year - 1 day')::date::text, true);

-- 40 made-up organisations, each with one client ID (990101 … 990140); every fourth holds a made-up code
select test.as_person(current_setting('t.head')::uuid);
do $$
declare
  i int; p uuid;
begin
  for i in 1..40 loop
    p := (api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Speed Org ' || i,
      'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                    'owner_id', current_setting('t.am'))))) ->> 'id')::uuid;
    perform api.identifier_add(p, 'payments_client_id', (990100 + i)::text, 'made up', 'postpaid');
    if i % 4 = 0 then
      perform api.identifier_add(p, 'discount_code', 'MADEUPSPD' || i, 'made up');
    end if;
    if i = 7 then perform set_config('t.p', p::text, true); end if;
    if i = 8 then perform set_config('t.q', p::text, true); end if;
  end loop;
end $$;
-- 120 invoices, three per organisation: 1000 + n riyals, the tenth of each ten not paid yet; two lines on every
-- eighth; an approved expense of 600 on two of every three
select api.finance_import('invoices', (
  select jsonb_agg(jsonb_build_object('ref', 'TX-SPD-' || n,
           'status', case when n % 10 = 0 then 'Published' else 'Fully Paid' end,
           'created_on', current_setting('t.d'), 'total_sar', 1000 + n,
           'client_id', (990100 + 1 + (n - 1) % 40)::text, 'customer_name', 'Made Up Speed Customer ' || n,
           'discount_code', case when (1 + (n - 1) % 40) % 4 = 0 and n % 3 = 0 then 'MADEUPSPD' || (1 + (n - 1) % 40) end,
           'lines', case when n % 8 = 0 then jsonb_build_array(
                      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Made up hotel night', 'total_sar', 700 + n),
                      jsonb_build_object('line_no', 2, 'product', 'Direct Visas', 'name', 'Made up visa', 'total_sar', 300))
                    else jsonb_build_array(
                      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Made up hotel night', 'total_sar', 1000 + n)) end))
  from generate_series(1, 120) n), now() - interval '1 day');
select api.finance_import('expenses', (
  select jsonb_agg(jsonb_build_object('ref', 'TX-SPD-' || n, 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 600,
                                      'created_at', '2026-01-01T10:00:00Z'))
  from generate_series(1, 120) n where n % 3 <> 0), now() - interval '1 day');
select api.finance_import('receipts', (
  select jsonb_agg(jsonb_build_object('ref', 'TX-SPD-' || n, 'method', 'Bank', 'amount_sar', 1000 + n, 'paid_on', current_setting('t.d')))
  from generate_series(1, 120) n where n % 10 <> 0), now() - interval '1 day');
-- one exclusion rule (organisation 9's client ID) and one merge rule (organisation 8's client ID counts under 7)
select test.as_person(current_setting('t.admin')::uuid);
select api.finance_exclusion_rule_save(null, jsonb_build_object('kind', 'client_id', 'value', '990109', 'reason', 'made up'), null, 'made up');
select api.finance_merge_rule_save(null, jsonb_build_object('kind', 'client_id', 'value', '990108',
  'partner_id', current_setting('t.p'), 'reason', 'made up'), null, 'made up');

-- ---------------------------------------------------------------- 1. the shape
select test.as_owner();
select test.ok(pg_catalog.pg_get_viewdef('finance.money_row'::regclass) ~ 'finance\.money_rows\(\)'
               and pg_catalog.pg_get_viewdef('finance.money_row'::regclass) !~ 'money_row_live|money_row_calc',
  'finance.money_row reads finance.money_rows(): one kept plan, worked out once per mention');
select test.eq((select l.lanname::text from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid = p.prolang
                where p.oid = 'finance.money_rows()'::regprocedure), 'plpgsql',
  'finance.money_rows keeps its plan (plpgsql)');
select test.eq(
  (select coalesce(pg_catalog.string_agg(p.oid::regproc::text, ', ' order by p.oid::regproc::text), '')
   from pg_catalog.pg_proc p
   where p.oid in ('finance.unified_ledger(date,date,uuid,text,text,text,text)'::regprocedure,
                   'finance.ledger(date,date,uuid,text,text,text,text)'::regprocedure,
                   'finance.company_not_counted(uuid,date,date)'::regprocedure,
                   'partner.company_summary(uuid)'::regprocedure,
                   'finance.period_figures(date,date)'::regprocedure,
                   'finance.counted_by_month(date,date)'::regprocedure,
                   'finance.health(date,date)'::regprocedure,
                   'finance.not_invoiced(date,date)'::regprocedure,
                   'finance.codes_list()'::regprocedure,
                   'finance.codes_by_company()'::regprocedure,
                   'finance.codes_detail(uuid)'::regprocedure)
     and (select pg_catalog.count(*) from pg_catalog.regexp_matches(p.prosrc, '(from|join)\s+finance\.money_row\M', 'gi')) > 1),
  '', 'each Finance read takes the money rows once: none mentions finance.money_row twice');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.regexp_matches(
     (select p.prosrc from pg_catalog.pg_proc p where p.oid = 'finance.income_by_service(date,date)'::regprocedure),
     '(from|join)\s+finance\.money_service_row\M', 'gi')), 1,
  'Income by service reads the service rows once');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.regexp_matches(
     pg_catalog.pg_get_viewdef('finance.money_service_row'::regclass), '(from|join)\s+finance\.money_row\M', 'gi')), 1,
  'the service rows take the money rows once');

-- ---------------------------------------------------------------- 2. the clock
select test.as_person(current_setting('t.head')::uuid);
create temp table spd_time (read text primary key, ms numeric, answer jsonb) on commit drop;
do $$
declare
  r record; t0 timestamptz; a jsonb;
begin
  for r in select * from (values
      ('the partner ledger', format('api.finance_unified_ledger(%L, %L, %L)', current_setting('t.y0'), current_setting('t.y1'), current_setting('t.p'))),
      ('the payments as-of day', 'to_jsonb(api.finance_payments_as_of())'),
      ('the partner not-yet-counted gap', format('api.finance_company_not_counted(%L, %L, %L)', current_setting('t.p'), current_setting('t.y0'), current_setting('t.y1'))),
      ('the organisation summary', format('api.company_summary(%L)', current_setting('t.p'))),
      ('the whole ledger', format('api.finance_unified_ledger(%L, %L)', current_setting('t.y0'), current_setting('t.y1'))),
      ('income by service', format('api.finance_income_by_service(%L, %L)', current_setting('t.y0'), current_setting('t.y1'))),
      ('the period figures', format('api.finance_period(%L, %L)', current_setting('t.y0'), current_setting('t.y1'))),
      ('counted by month', format('api.finance_counted_by_month(%L, %L)', current_setting('t.y0'), current_setting('t.y1'))),
      ('finance health', format('api.finance_health(%L, %L)', current_setting('t.y0'), current_setting('t.y1'))),
      ('not invoiced', format('api.finance_not_invoiced(%L, %L)', current_setting('t.y0'), current_setting('t.y1'))),
      ('the closed months', 'api.finance_closed_months()'),
      ('the codes list', 'api.codes_list()'),
      ('codes by organisation', 'api.codes_by_company()')) v(read, call) loop
    t0 := pg_catalog.clock_timestamp();
    execute 'select ' || r.call into a;
    insert into spd_time values (r.read, extract(epoch from pg_catalog.clock_timestamp() - t0) * 1000, a);
  end loop;
end $$;
select test.eq((select coalesce(pg_catalog.string_agg(read || ' (' || pg_catalog.round(ms) || ' ms)', ', ' order by ms desc), '')
                from spd_time where ms >= 2000),
  '', 'every partner-tab and Finance-page read answers in under 2 s at live-like volume');

-- ---------------------------------------------------------------- the answers did not move
-- organisation 7's tab: its own TX-SPD-7, -47, -87 and, by the merge rule, organisation 8's TX-SPD-8, -48, -88:
-- six units, revenue 1007 + 1047 + 1087 + 1008 + 1048 + 1088 = 6285; an approved cost of 600 on the four that have
-- one (7, 47, 8, 88), profit 407 + 447 + 408 + 488 = 1750; two still without a cost (87, 48)
select set_config('t.tab', (select answer::text from spd_time where read = 'the partner ledger'), true);
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'units')::int, 6, 'the partner tab counts six units');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'revenue')::numeric, 6285.00, 'the partner tab revenue is 6285');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'cost')::numeric, 2400.00, 'the partner tab cost is 2400 — approved expenses only');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'profit')::numeric, 1750.00, 'the partner tab profit is 1750 — the costed units only');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'without_cost')::int, 2, 'two units still without a cost — empty, never 0');
-- the whole ledger: 120 invoices, 12 not paid, 3 excluded by the rule (organisation 9's 9, 49, 89) — 105 counted
select set_config('t.all', (select answer::text from spd_time where read = 'the whole ledger'), true);
select test.eq((current_setting('t.all')::jsonb -> 'totals' ->> 'units')::int, 105, 'the whole ledger counts 105 units');
select test.eq((current_setting('t.all')::jsonb -> 'totals' ->> 'excluded_units')::int, 3, 'and lists the three excluded ones apart');
select test.eq((select (answer ->> 'units')::int from spd_time where read = 'the period figures'), 105,
  'the period figures count the same 105 units');
select test.eq((select (answer ->> 'revenue')::numeric from spd_time where read = 'the period figures'),
  (current_setting('t.all')::jsonb -> 'totals' ->> 'revenue')::numeric, 'and the same revenue as the ledger');
select test.eq((select (answer ->> 'excluded_units')::int from spd_time where read = 'the partner not-yet-counted gap'), 0,
  'organisation 7 has nothing excluded');
select test.eq((select (answer -> 'finance' ->> 'units')::int from spd_time where read = 'the organisation summary'), 3,
  'the summary counts organisation 7''s own three units');
