-- QUIET-02 — the four cards' figures come with the list read (Landing 31): `counts: true` adds
-- {all, active, prospect, stale, quiet}. They follow the search and every other filter, but not the cards' own choice
-- (status, stale, quiet) — pressing a card must not change the other cards' figures. They count only what the reader
-- may see: a person shut out of Clients is refused the Clients list, counts and all, and the list without a side
-- counts only the sides open to them; a person below View on Finance is told nothing of quiet — no flag, no figure
-- (null: not known, never 0), and the quiet filter finds nobody. Every value is made up.
-- Sabotage: tests/sabotage/landing-31-partners-list.mjs (partners-counts-*, partners-quiet-told-below-finance).
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
select set_config('t.nofin', test.person('Test No Finance', 'member')::text, true);
-- Landing 34b (the owner, 21 Nov 2026): a Team member starts at Full on Finance; this one is held at View — a reader,
-- not an editor — as an admin would in Settings
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am')::uuid, 'finance', 'view', 'made up: View on Finance'),
       (current_setting('t.am2')::uuid, 'finance', 'view', 'made up: View on Finance'),
       (current_setting('t.outsider')::uuid, 'finance', 'view', 'made up: View on Finance');
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'clients', 'none', 'made up: no clients'),
       (current_setting('t.nofin')::uuid, 'finance', 'none', 'made up: no Finance access');
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.' || k, api.partner_create(jsonb_build_object('trade_name_en', n,
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.' || o)))))
  ->> 'id', true)
from (values ('a', 'Made Up Alpha Quiet', 'am'), ('b', 'Made Up Alpha Busy', 'am'), ('c', 'Made Up Beta Quiet', 'am2'),
             ('d', 'Made Up Beta Plain', 'am2')) v (k, n, o);
select set_config('t.s', api.partner_create('{"trade_name_en": "Made Up Supplier", "sides": [{"side": "supplier_partner", "type": "supplier"}]}')
  ->> 'id', true);
select api.partner_status_set(current_setting('t.a')::uuid, 'client', 'active');
select api.partner_status_set(current_setting('t.b')::uuid, 'client', 'active');
select api.partner_status_set(current_setting('t.c')::uuid, 'client', 'prospect');
select api.identifier_add(current_setting('t.a')::uuid, 'payments_client_id', '87001', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.b')::uuid, 'payments_client_id', '87002', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.c')::uuid, 'payments_client_id', '87003', 'made up', 'postpaid');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8701', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 75)::text,
                     'paid_on', (current_setting('t.t')::date - 70)::text, 'total_sar', 100, 'client_id', '87001'),
  jsonb_build_object('ref', 'SA-8702', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 12)::text,
                     'paid_on', (current_setting('t.t')::date - 10)::text, 'total_sar', 100, 'client_id', '87002'),
  jsonb_build_object('ref', 'SA-8703', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 95)::text,
                     'paid_on', (current_setting('t.t')::date - 90)::text, 'total_sar', 100, 'client_id', '87003')),
  now() - interval '1 day');
-- one of them has gone stale too
select test.as_owner();
update partner.partner_side set since = core.riyadh_today() - 100 where partner_id = current_setting('t.d')::uuid;

select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.partners('{"side": "client", "counts": true}') -> 'counts',
  '{"all": 4, "active": 2, "prospect": 1, "stale": 1, "quiet": 2}'::jsonb, 'the four cards, and the whole list, in the one read');
select test.eq(api.partners('{"side": "client", "counts": true, "statuses": ["active"]}') -> 'counts',
  '{"all": 4, "active": 2, "prospect": 1, "stale": 1, "quiet": 2}'::jsonb, 'a status card pressed: the figures stay');
select test.eq((api.partners('{"side": "client", "counts": true, "statuses": ["active"]}') ->> 'total')::int, 2,
  'while the list itself is that card''s');
select test.eq(api.partners('{"side": "client", "counts": true, "quiet": true, "stale": true}') -> 'counts',
  '{"all": 4, "active": 2, "prospect": 1, "stale": 1, "quiet": 2}'::jsonb, 'nor do stale and quiet move them');
select test.eq(api.partners('{"side": "client", "counts": true, "q": "alpha"}') -> 'counts',
  '{"all": 2, "active": 2, "prospect": 0, "stale": 0, "quiet": 1}'::jsonb, 'the search does');
select test.eq(api.partners(jsonb_build_object('side', 'client', 'counts', true, 'quiet', true,
                                               'owners', jsonb_build_array(current_setting('t.am2')))) -> 'counts',
  '{"all": 2, "active": 0, "prospect": 1, "stale": 1, "quiet": 1}'::jsonb, 'and so does another filter (the owner)');
select test.eq(api.partners('{"side": "client", "counts": true}', 1) -> 'counts' ->> 'all', '4',
  'the figures count the whole list, however few rows are asked for');
select test.eq(api.partners('{"counts": true}') -> 'counts' ->> 'all', '5', 'without a side: every organisation the reader may see');

-- shut out of Clients: no list, no counts; and the list without a side counts only what is open
select test.as_person(current_setting('t.outsider')::uuid);
select test.raises($$select api.partners('{"side": "client", "counts": true}')$$, '42501',
  'a person shut out of Clients gets no counts of them', 'access.needs_level');
select test.eq(api.partners('{"counts": true}') -> 'counts',
  '{"all": 1, "active": 0, "prospect": 0, "stale": 0, "quiet": 0}'::jsonb,
  'and without a side counts the one supplier they may see — not the four clients, quiet or not');
select test.eq((api.partners('{"quiet": true}') ->> 'total')::int, 0, 'nor does the quiet filter find a client for them');

-- below View on Finance: nothing of quiet
select test.as_person(current_setting('t.nofin')::uuid);
select test.eq(api.partners('{"side": "client", "counts": true}') -> 'counts',
  '{"all": 4, "active": 2, "prospect": 1, "stale": 1, "quiet": null}'::jsonb,
  'a person below View on Finance gets the other figures, and quiet as not known');
select test.eq((select count(*)::int from jsonb_array_elements(api.partners('{"side": "client", "counts": true}') -> 'rows') r
                where r -> 'flags' ? 'quiet'), 0, 'no row is flagged quiet for them');
select test.eq((api.partners('{"side": "client", "quiet": true}') ->> 'total')::int, 0, 'and the quiet filter finds nobody');
