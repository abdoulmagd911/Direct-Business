-- QUIET-01 — the Partners list's Quiet (Landing 31) is the alert's quiet, not a second rule: a client with no fully
-- paid invoice for finance.quiet_client_days (60). The list flags it and filters by it for exactly the partners
-- notify.alert_quiet_client() tells of — on the 60th day, not the 59th; a client paid lately, one never invoiced, one
-- whose only invoice is unpaid, and an archived one are not quiet; the setting moves both together. The rule is read
-- only when asked for (`counts` or `quiet`), so the other callers of the list are answered exactly as before. Every
-- value is made up.
-- Sabotage: tests/sabotage/landing-31-partners-list.mjs (partners-quiet-*).
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.' || k, api.partner_create(jsonb_build_object('trade_name_en', n,
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true)
from (values ('q', 'Made Up Quiet Co'), ('e', 'Made Up Edge Co'), ('b', 'Made Up Busy Co'), ('n', 'Made Up Never Co'),
             ('u', 'Made Up Unpaid Co'), ('x', 'Made Up Archived Co')) v (k, n);
select api.identifier_add(current_setting('t.q')::uuid, 'payments_client_id', '86001', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.e')::uuid, 'payments_client_id', '86002', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.b')::uuid, 'payments_client_id', '86003', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.u')::uuid, 'payments_client_id', '86005', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.x')::uuid, 'payments_client_id', '86006', 'made up', 'postpaid');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 200 where person_id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8601', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 75)::text,
                     'paid_on', (current_setting('t.t')::date - 70)::text, 'total_sar', 100, 'client_id', '86001'),
  -- paid 59 days ago: quiet tomorrow, not today
  jsonb_build_object('ref', 'SA-8602', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 62)::text,
                     'paid_on', (current_setting('t.t')::date - 59)::text, 'total_sar', 100, 'client_id', '86002'),
  -- an old paid invoice and a recent one: the latest counts
  jsonb_build_object('ref', 'SA-8603', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 95)::text,
                     'paid_on', (current_setting('t.t')::date - 90)::text, 'total_sar', 100, 'client_id', '86003'),
  jsonb_build_object('ref', 'SA-8604', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 12)::text,
                     'paid_on', (current_setting('t.t')::date - 10)::text, 'total_sar', 100, 'client_id', '86003'),
  -- issued long ago and never paid: nothing paid to go quiet from
  jsonb_build_object('ref', 'SA-8605', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 80)::text,
                     'total_sar', 300, 'client_id', '86005'),
  jsonb_build_object('ref', 'SA-8606', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 75)::text,
                     'paid_on', (current_setting('t.t')::date - 70)::text, 'total_sar', 100, 'client_id', '86006')),
  now() - interval '1 day');
select api.partner_archive(current_setting('t.x')::uuid, 'made up: archived');

-- the alert's own answer is the yardstick
select test.as_owner();
select test.eq((select jsonb_agg(a.entity_id order by a.entity_id) from notify.alert_quiet_client() a),
  jsonb_build_array(current_setting('t.q')), 'the alert tells of the one quiet client');

select test.as_person(current_setting('t.head')::uuid);
select test.eq((select jsonb_agg(r ->> 'id') from jsonb_array_elements(api.partners('{"side": "client", "quiet": true}') -> 'rows') r),
  jsonb_build_array(current_setting('t.q')), 'the list filtered to quiet shows exactly the client the alert tells of');
select test.eq(api.partners('{"side": "client", "quiet": true}') -> 'rows' -> 0 -> 'flags', '["quiet"]'::jsonb,
  'and flags it quiet');
select test.eq((api.partners('{"side": "client", "quiet": false}') ->> 'total')::int, 4,
  'not quiet: paid lately, paid 59 days ago, never invoiced, only an unpaid invoice (the archived one is not listed)');
select test.eq((select jsonb_agg(r ->> 'trade_name_en' order by r ->> 'trade_name_en')
                from jsonb_array_elements(api.partners('{"side": "client", "counts": true}') -> 'rows') r
                where r -> 'flags' ? 'quiet'),
  '["Made Up Quiet Co"]'::jsonb, 'the whole list, asked with its counts, flags the same one');
select test.eq(api.partners('{"side": "client", "counts": true}') -> 'counts' ->> 'quiet', '1', 'and counts it');
select test.eq((api.partners('{"side": "client", "archived_only": true, "quiet": true}') ->> 'total')::int, 0,
  'an archived client is never quiet, as the alert has it');
select test.eq((select count(*)::int from jsonb_array_elements(api.partners('{"side": "client"}') -> 'rows') r
                where r -> 'flags' ? 'quiet'), 0, 'a read that asks for neither is answered without the quiet rule');
select test.eq(api.partners('{"side": "client"}') ? 'counts', false, 'and without counts');

-- a stale quiet client carries both flags, the more urgent first
select test.as_owner();
update partner.partner_side set since = core.riyadh_today() - 100 where partner_id = current_setting('t.q')::uuid;
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.partners('{"side": "client", "quiet": true}') -> 'rows' -> 0 -> 'flags', '["stale", "quiet"]'::jsonb,
  'stale and quiet together: stale first');
select test.eq((api.partners('{"side": "client", "quiet": true, "stale": false}') ->> 'total')::int, 0,
  'the quiet filter combines with the stale one');

-- the setting moves the list and the alert together
select test.as_owner();
insert into core.setting (key, department_id, value, valid_from, reason)
values ('finance.quiet_client_days', null, '59', core.riyadh_today(), 'made up for a test');
select test.eq((select count(*)::int from notify.alert_quiet_client()), 2, 'at 59 days the alert tells of two');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select jsonb_agg(r ->> 'trade_name_en' order by r ->> 'trade_name_en')
                from jsonb_array_elements(api.partners('{"side": "client", "quiet": true}') -> 'rows') r),
  '["Made Up Edge Co", "Made Up Quiet Co"]'::jsonb, 'and the list shows the same two');
