-- CNT-04 — a month's close (V610, V500): a person with Full on Finance closes a past month; its snapshot — each counted
-- unit as it stood — never changes; a unit paid after the close is listed as late-paid against that month, one voided
-- after it as dropped, and a cost that changed as cost changed, with the riyals — never folded in silently. The current
-- month cannot be closed, nor a month twice; a member cannot close one. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-late-payment-is-folded-in-silently.sql, a-closed-snapshot-changes.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.m', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month')::date::text, true);
select set_config('t.d', (current_setting('t.m')::date + 5)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-41', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 700),
  jsonb_build_object('ref', 'TX-42', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300),
  jsonb_build_object('ref', 'TX-43', 'status', 'Pending Payment', 'created_on', current_setting('t.d'), 'total_sar', 450)),
  now() - interval '3 days');

select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format($$select api.finance_month_close(%L)$$, current_setting('t.m')), '42501', 'a member cannot close a month');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format($$select api.finance_month_close(%L)$$, core.riyadh_today()), 'P0001',
  'the current month is not over', 'finance.month_not_over');
select test.eq((api.finance_month_close(current_setting('t.m')::date, 'made up: closed by hand') ->> 'units')::int, 2,
  'closed with its two counted units');
select test.raises(format($$select api.finance_month_close(%L)$$, current_setting('t.m')), 'P0001', 'not twice', 'finance.month_closed');

-- after the close: TX-43 is paid, TX-42 is voided, TX-41's expense is approved — each by a newer export
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-42', 'status', 'Voided', 'created_on', current_setting('t.d'), 'total_sar', 300),
  jsonb_build_object('ref', 'TX-43', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 450)),
  now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-41', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 250,
                     'created_at', '2026-01-01T10:00:00Z')), now() - interval '1 day');

select test.as_owner();
select test.eq((select jsonb_object_agg(ref, jsonb_build_object('change', change, 'revenue', revenue_change, 'cost', cost_change))
                from finance.late_change where month = current_setting('t.m')::date),
  '{"TX-43": {"change": "late_paid", "revenue": 450.00, "cost": 0},
    "TX-42": {"change": "dropped", "revenue": -300.00, "cost": 0},
    "TX-41": {"change": "cost_changed", "revenue": 0.00, "cost": 250.00}}'::jsonb,
  'late-paid, dropped and cost changed, each with its riyals, against the closed month');
select test.eq((select jsonb_array_length(snapshot) from finance.month_close where month = current_setting('t.m')::date), 2,
  'the snapshot still holds what was counted at close');
select test.raises($$update finance.month_close set snapshot = '[]'::jsonb$$, 'P0001', 'a snapshot never changes',
  'finance.snapshot_never_changes');
