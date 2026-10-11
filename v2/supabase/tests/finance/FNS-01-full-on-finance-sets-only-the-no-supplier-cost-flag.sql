-- FNS-01 — the no-supplier-cost list (QA-534; V621, V627). A head with Full on Finance marks a product as having no
-- supplier cost — the one field, logged, and one Undo takes it back (Undo of a product change is judged on its Settings
-- page, an admin's; the head sets the flag back through the same door); the same head cannot change the product's
-- commission flag, service or name, nor retire it — the product list stays admins' in Settings → Finance; a member
-- cannot set the flag. Every value is made up.
-- Sabotage: supabase/tests/sabotage/full-on-finance-edits-the-whole-product.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Member', 'member')::text, true);
select test.as_owner();
select set_config('t.p', (select id from finance.product where word = 'Direct Visas')::text, true);
select set_config('t.pv', (select version from finance.product where id = current_setting('t.p')::uuid)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r', api.finance_no_supplier_cost_set(current_setting('t.p')::uuid, true, current_setting('t.pv')::int,
                                                          'made up: visas carry no supplier cost')::text, true);
select test.as_owner();
select test.eq((select no_supplier_cost from finance.product where id = current_setting('t.p')::uuid), true,
  'a head with Full on Finance marks a product as having no supplier cost');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.list_save(%L, %L, %L)', 'product', current_setting('t.p'), '{"commission": true}'),
  '42501', 'but cannot change its commission flag, service or name, nor retire it', 'access.needs_level');
select test.as_owner();
select test.ok(exists (select 1 from audit.change c where c.request_id = (current_setting('t.r')::jsonb ->> 'request_id')::uuid
                       and c.table_name = 'finance.product' and c.fields = array['no_supplier_cost']),
  'the change is logged, the one field');
select set_config('t.adm', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.adm')::uuid);
select api.undo((current_setting('t.r')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select no_supplier_cost from finance.product where id = current_setting('t.p')::uuid), false,
  'one Undo (an admin''s, as for any product change) takes the flag back');
select set_config('t.pv', (select version from finance.product where id = current_setting('t.p')::uuid)::text, true);
select test.as_person(current_setting('t.am')::uuid);
select test.raises(format('select api.finance_no_supplier_cost_set(%L, true, %s)', current_setting('t.p'), current_setting('t.pv')),
  '42501', 'a member cannot set the flag', 'access.needs_level');
