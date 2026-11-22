-- FNC-03 — the New invoice form reads back the invoice the reader saved last (Landing 37, Finance F-C, F185).
-- api.finance_last_saved answers the newest invoice the reader recorded here — its number, status, created and paid
-- days and total, as the table holds them — so the form shows the saved record after a save and when it is opened
-- again, never a blank. It is the reader's own last save, not a colleague's; an invoice taken back by Undo is no
-- longer it; a reader who has saved none is answered nothing; below Full on Finance it is refused. Every value is
-- made up.
-- Sabotage: supabase/tests/sabotage/the-last-saved-invoice-is-anybodys.sql,
--           supabase/tests/sabotage/the-last-saved-invoice-keeps-an-undone-one.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.head2', test.person('Test Second Finance Head', 'head')::text, true);
select set_config('t.view', test.person('Test Finance Reader', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.view')::uuid, 'finance', 'view', 'made up: View on Finance');
select set_config('t.d', (core.riyadh_today() - 5)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.finance_last_saved(), null::jsonb, 'a reader who has saved no invoice is answered nothing');
select api.finance_row_add('invoice', jsonb_build_object('ref', 'FC-LAST-1', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'), 'total_sar', 250), 'made up');
select set_config('t.r2', api.finance_row_add('invoice', jsonb_build_object('ref', 'FC-LAST-2', 'kind', 'transaction',
  'status', 'Pending', 'created_on', current_setting('t.d'), 'total_sar', 100), 'made up')::text, true);
select test.eq(api.finance_last_saved() - 'invoice_id' - 'saved_at',
               pg_catalog.jsonb_build_object('ref', 'FC-LAST-2', 'kind', 'transaction', 'status', 'Pending',
                 'pay_state', 'pending', 'created_on', current_setting('t.d'), 'paid_on', null, 'total_sar', 100.00),
  'the form reads back the invoice saved last: its number, status, created and paid days and total');
select test.eq(api.finance_last_saved() ->> 'invoice_id', current_setting('t.r2')::jsonb ->> 'id',
  'it is that very record');
select test.eq((api.finance_last_saved() ->> 'saved_at') is not null, true, 'it says when it was saved');

-- a colleague's save is theirs, not mine
select test.as_person(current_setting('t.head2')::uuid);
select test.eq(api.finance_last_saved(), null::jsonb, 'a colleague who has saved none is answered nothing');
select api.finance_row_add('invoice', jsonb_build_object('ref', 'FC-LAST-3', 'kind', 'transaction',
  'status', 'Draft', 'created_on', current_setting('t.d'), 'total_sar', 70), 'made up');
select test.eq(api.finance_last_saved() ->> 'ref', 'FC-LAST-3', 'the colleague reads back their own');
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.finance_last_saved() ->> 'ref', 'FC-LAST-2', 'my last save is still mine, not the colleague''s');

-- taken back by Undo: the one before it is the last again
select api.undo((current_setting('t.r2')::jsonb ->> 'request_id')::uuid);
select test.eq(api.finance_last_saved() - 'invoice_id' - 'saved_at',
               pg_catalog.jsonb_build_object('ref', 'FC-LAST-1', 'kind', 'transaction', 'status', 'Fully Paid',
                 'pay_state', 'paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'), 'total_sar', 250.00),
  'an invoice taken back by Undo is no longer the last saved');

-- below Full on Finance: refused
select test.as_person(current_setting('t.view')::uuid);
select test.raises($$select api.finance_last_saved()$$, '42501',
  'View on Finance reads no last-saved invoice', 'access.needs_level');
