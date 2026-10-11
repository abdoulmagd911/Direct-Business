-- FCL-01 — a closed month never reopens (QA-527; V620). Undo of the close is refused and the month stays closed with
-- its snapshot, so a second close can never take a new one; a closed month is never deleted either. Every value is
-- made up.
-- Sabotage: supabase/tests/sabotage/undo-reopens-a-closed-month.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-C1', 'status', 'Fully Paid', 'created_on', (current_setting('t.m')::date + 3)::text,
                     'total_sar', 400)), now() - interval '1 day');
select api.finance_month_close(current_setting('t.m')::date, 'made up: closed');
select test.as_owner();
select set_config('t.req', (select c.request_id::text from audit.change c
                            where c.table_name = 'finance.month_close' order by c.id desc limit 1), true);

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.req')), 'P0001',
  'Undo of a close is refused', 'finance.month_never_reopens');
select test.as_owner();
select test.eq((select count(*)::int from finance.month_close where month = current_setting('t.m')::date and deleted_at is null),
  1, 'and the month stays closed');
select test.raises(format('delete from finance.month_close where month = %L', current_setting('t.m')), 'P0001',
  'a closed month is never deleted', 'finance.month_never_reopens');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.finance_month_close(%L)', current_setting('t.m')), 'P0001',
  'and is never closed a second time', 'finance.month_closed');
