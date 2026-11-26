-- OWN-02 — Landing 56, "Own clients only" on Finance (the owner, 26 Nov 2026; the per-member design of 22 Nov:
-- "Member: sees Finance, adds and edits Finance for their OWN clients"). A team member starts at Own on Finance and
-- on an organisation's Finance tab, and still reads all of it. They type an invoice for a client whose Client side
-- they own, with its expense and its commission, set its deal type, edit it and remove it; for a colleague's client
-- each of those is refused in words and nothing is kept; an invoice that matches no organisation is nobody's own.
-- "Edit someone else's work — Allowed" opens a colleague's client to that one person only. Importing keeps its own
-- extra: a member set to Allowed imports at Own; a member without it does not. What asks for Full stays a manager's:
-- the month close. A manager changes every entry; a Viewer none. No figure of the Ledger moves by a refusal.
-- Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-team-member-starts-at-full-on-finance.sql,
--            supabase/tests/sabotage/own-on-finance-changes-any-clients-entry.sql,
--            supabase/tests/sabotage/own-on-finance-changes-no-entry-at-all.sql,
--            supabase/tests/sabotage/a-new-invoice-is-not-asked-whose-it-is.sql,
--            supabase/tests/sabotage/an-edit-is-not-asked-whose-it-is.sql,
--            supabase/tests/sabotage/a-removal-is-not-asked-whose-it-is.sql,
--            supabase/tests/sabotage/a-deal-type-is-not-asked-whose-it-is.sql,
--            supabase/tests/sabotage/allowed-does-not-reach-a-colleagues-finance-entry.sql,
--            supabase/tests/sabotage/importing-asks-for-full-on-finance-again.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.b', test.person('Test Member B', 'member')::text, true);
select set_config('t.c', test.person('Test Member C', 'member')::text, true);
select set_config('t.v', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
create function pg_temp.totals() returns jsonb language sql as
$$ select api.finance_unified_ledger('2000-01-01'::date, '2100-01-01'::date) -> 'totals' $$;
grant execute on function pg_temp.totals() to public;

-- two clients, each with its client ID: A's and B's
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.pa', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Own02 A Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.a'))))) ->> 'id', true);
select set_config('t.pb', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Own02 B Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.b'))))) ->> 'id', true);
select test.as_person(current_setting('t.admin')::uuid);
select api.identifier_add(current_setting('t.pa')::uuid, 'payments_client_id', '990561', 'made up', 'prepaid');
select api.identifier_add(current_setting('t.pb')::uuid, 'payments_client_id', '990562', 'made up', 'prepaid');

-- the role: Own, and all of Finance is still read
select test.as_person(current_setting('t.a')::uuid);
select test.eq(api.me() -> 'levels' ->> 'finance', 'own', 'a team member starts at Own on Finance');
select test.eq(api.me() -> 'levels' ->> 'partner_finance', 'own', 'and on an organisation''s Finance tab');
select test.runs($$select api.finance_period(current_date - 30, current_date)$$, 'a team member still reads the figures');
select test.runs($$select api.finance_unified_ledger(current_date - 30, current_date)$$, 'and the ledger');
select test.eq(api.finance_my_clients(), jsonb_build_object('all', false, 'partners', jsonb_build_array(current_setting('t.pa'))),
  'the screen is told which clients are theirs');

-- their own client: an invoice, its expense, its commission, its deal type, an edit
select set_config('t.i', api.finance_row_add('invoice', jsonb_build_object('ref', 'OWN2-A1', 'kind', 'standalone',
  'client_id', '990561', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 5000), 'made up: typed') ->> 'id', true);
select test.ok(current_setting('t.i') <> '', 'a team member types an invoice for their own client');
select test.ok(api.finance_row_add('expense_line', jsonb_build_object('invoice_id', current_setting('t.i'), 'amount_sar', 3000,
  'expense_type', 'Hotel', 'status', 'Approved', 'merchant', 'Made Up Supplier'), 'made up: typed') ->> 'id' <> '', 'and its expense');
select test.runs(format('select api.finance_commission_set(%L, %L, %L, %L)', current_setting('t.i'), 'airlines', 'made up: statement', 'made up'),
  'names its commission');
select test.runs(format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.pa'), 'OWN2-A1', 'postpaid', 'made up'),
  'sets its deal type');
select test.as_owner();
select set_config('t.ver', (select version::text from finance.invoice where id = current_setting('t.i')::uuid), true);
select test.as_person(current_setting('t.a')::uuid);
select test.runs(format('select api.finance_row_edit(%L, %L, %L::jsonb, %s, %L)', 'invoice', current_setting('t.i'), '{"total_sar": 5200}', current_setting('t.ver'), 'made up: corrected'),
  'and edits it');
select set_config('t.before', pg_temp.totals()::text, true);

-- a colleague's client, and no client at all: refused in words, and nothing is kept
select test.raises(format('select api.finance_row_add(%L, %L::jsonb, %L)', 'invoice', jsonb_build_object('ref', 'OWN2-B9', 'kind', 'standalone',
  'client_id', '990562', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900), 'made up'),
  '42501', 'a team member types no invoice for a colleague''s client', 'finance.own_clients_only');
select test.raises(format('select api.finance_row_add(%L, %L::jsonb, %L)', 'invoice', jsonb_build_object('ref', 'OWN2-N9', 'kind', 'standalone',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900, 'customer_name', 'Made Up Nobody'), 'made up'),
  '42501', 'nor one that matches no organisation', 'finance.own_clients_only');
select test.as_owner();
select set_config('t.ver', (select version::text from finance.invoice where id = current_setting('t.i')::uuid), true);
select test.as_person(current_setting('t.a')::uuid);
select test.raises(format('select api.finance_row_edit(%L, %L, %L::jsonb, %s, %L)', 'invoice', current_setting('t.i'), '{"client_id": "990562"}', current_setting('t.ver'), 'made up'),
  '42501', 'nor moves their own invoice onto a colleague''s client', 'finance.own_clients_only');
select test.as_owner();
select test.eq((select count(*)::int from finance.invoice where ref in ('OWN2-B9', 'OWN2-N9')), 0, 'nothing of a refused invoice is kept');
select test.eq((select client_id_raw from finance.invoice where id = current_setting('t.i')::uuid), '990561', 'and the refused edit changed nothing');

-- B on A's entry: every change refused
select test.as_person(current_setting('t.b')::uuid);
create temporary table own02_try (what text, sql text) on commit drop;
grant select on own02_try to public;
insert into own02_try values
  ('edit the invoice', format('select api.finance_row_edit(%L, %L, %L::jsonb, null, %L)', 'invoice', current_setting('t.i'), '{"total_sar": 1}', 'made up')),
  ('add an expense to it', format('select api.finance_row_add(%L, %L::jsonb, %L)', 'expense_line', jsonb_build_object('invoice_id', current_setting('t.i'), 'amount_sar', 1, 'expense_type', 'Hotel', 'status', 'Approved'), 'made up')),
  ('add a receipt to it', format('select api.finance_row_add(%L, %L::jsonb, %L)', 'receipt', jsonb_build_object('invoice_id', current_setting('t.i'), 'amount_sar', 1, 'paid_on', current_setting('t.d')), 'made up')),
  ('name its commission', format('select api.finance_commission_set(%L, %L, %L, %L)', current_setting('t.i'), 'other', 'made up: p', 'made up')),
  ('set its deal type', format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.pa'), 'OWN2-A1', 'prepaid', 'made up')),
  ('remove it', format('select api.finance_rows_remove(%L, array[%L]::uuid[], %L)', 'invoice', current_setting('t.i'), 'made up'));
select test.raises(x.sql, '42501', 'a colleague cannot ' || x.what, 'finance.own_clients_only') from own02_try x;
select test.eq(pg_temp.totals()::text, current_setting('t.before'), 'a colleague still reads the Ledger, and no figure moved');

-- a Viewer changes nothing
select test.as_person(current_setting('t.v')::uuid);
select test.raises(x.sql, '42501', 'a Viewer cannot ' || x.what, 'access.needs_level') from own02_try x;

-- "Edit someone else's work — Allowed": that one person changes a colleague's client's entry
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_capability(current_setting('t.b')::uuid, 'records.edit_others', true, 'made up: covers for A');
select test.as_person(current_setting('t.b')::uuid);
select test.eq(api.finance_my_clients() -> 'all', 'true'::jsonb, 'Allowed: the screen is told every client is open to them');
select test.runs(format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.pa'), 'OWN2-A1', 'prepaid', 'made up: covering'),
  'Allowed: they set the deal type on a colleague''s client');
select test.as_person(current_setting('t.c')::uuid);
select test.raises(format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.pa'), 'OWN2-A1', 'tender', 'made up'),
  '42501', 'the setting changed that one person only', 'finance.own_clients_only');
select test.as_person(current_setting('t.admin')::uuid);
select api.access_clear_person_capability(current_setting('t.b')::uuid, 'records.edit_others', 'made up: A is back');

-- importing keeps its own extra, at Own
select api.access_set_person_capability(current_setting('t.c')::uuid, 'finance.import', true, 'made up: she does the monthly review');
select test.as_person(current_setting('t.c')::uuid);
select test.runs(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.pb'), 'invoice_export', 'made-up.csv'),
  'a team member set to Allowed on Import imports at Own — for any organisation');
select test.as_person(current_setting('t.a')::uuid);
select test.raises(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.pa'), 'invoice_export', 'made-up.csv'),
  '42501', 'a team member without the Import extra imports nothing, even for their own client', 'access.needs_capability');

-- what asks for Full stays a manager's
select test.raises($$select api.finance_month_close(date '2001-01-01', 'made up')$$, '42501',
  'a team member at Own closes no month', 'access.needs_level');

-- the owner removes their own; a manager changes every entry
select test.runs(format('select api.finance_rows_remove(%L, array[%L]::uuid[], %L)', 'invoice', current_setting('t.i'), 'made up: typed twice'),
  'a team member removes their own client''s invoice');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(api.me() -> 'levels' ->> 'finance', 'full', 'a manager keeps Full on Finance');
select test.eq(api.finance_my_clients() -> 'all', 'true'::jsonb, 'and every client is open to them');
select test.ok(api.finance_row_add('invoice', jsonb_build_object('ref', 'OWN2-B1', 'kind', 'standalone',
  'client_id', '990562', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900), 'made up: typed') ->> 'id' <> '',
  'so they type an invoice for any client');
select test.ok(api.finance_row_add('invoice', jsonb_build_object('ref', 'OWN2-N1', 'kind', 'standalone',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900, 'customer_name', 'Made Up Nobody'), 'made up: typed') ->> 'id' <> '',
  'and one that matches no organisation');
