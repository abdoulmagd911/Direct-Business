-- QA 2 repro: V621/V627 — a finance head (Full on Finance, not admin) keeps the no-supplier-cost list; the rest of the
-- product list (commission, service, retiring a product) stays admins' (V97/V138).
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select test.as_owner();
select set_config('t.p', (select id from finance.product where word = 'Direct Visas')::text, true);
select set_config('t.pv', (select version from finance.product where id = current_setting('t.p')::uuid)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format($$select api.list_save('product', %L, '{"commission": true}', %s, 'made up')$$,
  current_setting('t.p'), current_setting('t.pv')), '42501', 'a non-admin cannot reclassify a product as commission');
