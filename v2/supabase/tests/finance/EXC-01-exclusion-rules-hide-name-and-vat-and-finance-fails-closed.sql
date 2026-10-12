-- EXC-01 — the exclusion rules (D16, V412, V413; P4-2 E-*) and Finance failing closed (OLD-035, M27). A hide rule
-- takes its row out of every figure and list; a name rule leaves alone a row that carries a client ID; a VAT rule
-- catches a row matched to the organisation through its alias, though the row carries no VAT number. No Finance read
-- swallows an error, so a rule that cannot be read stops the figures instead of showing a total that ignored it. Every
-- value is made up.
-- Sabotages: supabase/tests/sabotage/a-name-rule-catches-a-client-id-row.sql,
-- supabase/tests/sabotage/a-vat-rule-misses-the-alias-row.sql, supabase/tests/sabotage/a-hidden-row-is-found-by-search.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Group',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'vat', '300000000000003', 'made up');
select api.identifier_add(current_setting('t.p')::uuid, 'name', 'Made Up Alias Trading', 'made up', 'alias');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-E1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                     'customer_name', 'Made Up Alias Trading'),
  jsonb_build_object('ref', 'TX-E2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200,
                     'customer_name', 'Made Up Staff Member', 'client_id', '83501'),
  jsonb_build_object('ref', 'TX-E3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300,
                     'customer_name', 'Made Up Staff Member'),
  jsonb_build_object('ref', 'TX-E4', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400,
                     'customer_name', 'Made Up Verification')),
  now() - interval '1 day');

select test.act(current_setting('t.head')::uuid);
insert into finance.exclusion_rule (kind, value_raw, mode, reason, created_by) values
  ('tax_no', '300000000000003', 'exclude', 'made up: the group is not a client', current_setting('t.head')::uuid),
  ('name', 'Made Up Staff Member', 'exclude', 'made up: staff travel', current_setting('t.head')::uuid),
  ('name', 'Made Up Verification', 'hide', 'made up: a verification charge', current_setting('t.head')::uuid);
select test.done();

select test.as_owner();
select test.eq((select jsonb_object_agg(r.ref, r.counted) from finance.money_row r where r.ref like 'TX-E%'),
  '{"TX-E1": false, "TX-E2": true, "TX-E3": false}'::jsonb,
  'the VAT rule catches the alias row; the name rule leaves the client-ID row alone; the hidden row is not there');
select test.eq((select r.excluded_by from finance.money_row r where r.ref = 'TX-E1'), 'tax_no',
  'the alias row is excluded by the VAT rule');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((api.finance_period(current_setting('t.d')::date, current_setting('t.d')::date) ->> 'revenue')::numeric,
  200::numeric, 'the period counts only the row no rule catches');
select test.eq((select count(*)::int from jsonb_array_elements(api.finance_search('TX-E4')) x), 0,
  'a hidden row is found by no search');

-- failing closed: no Finance read swallows an error (an import row may be held; a figure may never be guessed)
select test.as_owner();
select test.eq((select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname)
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname in ('finance', 'api', 'measure') and p.proname not like '%import%'
                  -- the import's row readers hold a bad row; they read no figure
                  and p.proname not like 'row\_%'
                  and (n.nspname <> 'api' or p.proname like 'finance%')
                  and (n.nspname <> 'measure' or p.proname like 'finance%')
                  and p.prosrc ~* 'exception\s+when\s+others'),
  null::text, 'no Finance read catches every error, so a rule that cannot be read stops the figures');
