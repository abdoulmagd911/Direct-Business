-- ROW-05 — New invoice saves its channel and the person it credits with the invoice, in one request (QA-548, V613): an
-- individual's invoice typed with Commercial and a person is credited to that person; Commercial with no person is
-- refused and nothing is saved; a channel unknown to the list is refused; one Undo removes the invoice, its channel and
-- its credit together; and Channel set on its own returns a request id that Undo takes back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-new-invoices-channel-is-a-second-request.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);

select test.as_person(current_setting('t.head')::uuid);
-- an individual's invoice, Commercial, credited to the account manager: one request
select set_config('t.r1', api.finance_row_add('invoice', jsonb_build_object('ref', 'MN-51', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300,
  'customer_name', 'Made-up Walk-in Traveller', 'channel', 'commercial', 'credit_to', current_setting('t.am')),
  'made up: typed')::text, true);
select set_config('t.i1', current_setting('t.r1')::jsonb ->> 'id', true);

select test.as_owner();
select test.eq((select c.key from finance.invoice i join finance.channel c on c.id = i.channel_id
                where i.id = current_setting('t.i1')::uuid), 'commercial', 'the new invoice carries its channel');
select test.eq((select coalesce(person_id::text, 'nobody') from finance.credit_row where ref = 'MN-51'),
  current_setting('t.am'), 'and is credited to the person named with it');
select test.eq((select count(distinct x.request_id)::int from (
                  select s.request_id from audit.change s where s.row_id = current_setting('t.i1')::uuid
                  union all
                  select s.request_id from audit.change s join finance.credit_split c on c.id = s.row_id
                  where c.invoice_id = current_setting('t.i1')::uuid) x),
  1, 'the invoice and its credit are written by one request');

-- refused, and nothing saved
select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.finance_row_add('invoice', jsonb_build_object('ref', 'MN-52', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', core.riyadh_today()::text, 'total_sar', 100,
  'customer_name', 'Another Made-up Traveller', 'channel', 'commercial'), 'made up')$$, 'P0001',
  'Commercial on an individual''s new invoice must name the person', 'finance.commercial_names_the_person');
select test.raises($$select api.finance_row_add('invoice', jsonb_build_object('ref', 'MN-53', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', core.riyadh_today()::text, 'total_sar', 100, 'channel', 'no-such-channel'),
  'made up')$$, 'P0002', 'a channel the list does not hold is refused', 'finance.unknown_entry');
select test.as_owner();
select test.eq((select count(*)::int from finance.invoice where ref in ('MN-52', 'MN-53')), 0,
  'a refused new invoice leaves nothing behind');

-- one Undo removes the invoice, its channel and its credit together
select test.as_person(current_setting('t.head')::uuid);
select api.undo((current_setting('t.r1')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from finance.invoice where ref = 'MN-51' and deleted_at is null), 0,
  'Undo removes the new invoice');
select test.eq((select count(*)::int from finance.credit_split
                where invoice_id = current_setting('t.i1')::uuid and deleted_at is null), 0,
  'and its credit with it');

-- Channel set on its own gives Undo its request
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r2', api.finance_row_add('invoice', jsonb_build_object('ref', 'MN-54', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200,
  'customer_name', 'Third Made-up Traveller'), 'made up: typed')::text, true);
select set_config('t.c2', api.finance_channel_set((current_setting('t.r2')::jsonb ->> 'id')::uuid, 'commercial',
  current_setting('t.am')::uuid, 'made up')::text, true);
select test.ok(current_setting('t.c2')::jsonb ? 'request_id', 'Channel set returns its request id');
select api.undo((current_setting('t.c2')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select channel_id::text from finance.invoice where ref = 'MN-54'), null,
  'Undo of Channel set takes the channel back');
select test.eq((select count(*)::int from finance.credit_split s join finance.invoice i on i.id = s.invoice_id
                where i.ref = 'MN-54' and s.deleted_at is null), 0, 'and the credit with it');
