-- IDN-06 — a client ID's lifecycle (V411, V421, V422, V434; OLD-029). An organisation holds one open prepaid and one
-- open postpaid client ID (partner.open_client_ids); tender IDs are unlimited. Closed, an ID still matches rows dated on
-- or before its close date and only later rows stop; given a close date, it frees its place for its successor; it
-- reopens only while its kind is under the limit. Names only suggest a money match; a typed alias matches. A merge that
-- would leave two open postpaid IDs closes the moved one with a note, and its Undo brings it back open. Made up.
-- Sabotages: supabase/tests/sabotage/a-second-open-prepaid-id.sql, a-closed-id-matches-later-rows.sql,
-- a-name-matches-money.sql, tender-ids-are-limited.sql, a-merge-keeps-two-open-ids.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.d0', core.riyadh_today()::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ledger Co',
  'official_name_en', 'Made Up Ledger Trading LLC',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.a', api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', 'MU-P-1001',
  'Made-up: prepaid', 'prepaid') ->> 'id', true);
select test.raises(format('select api.identifier_add(%L, %L, %L, %L, %L)', current_setting('t.p'), 'payments_client_id',
  'MU-P-1002', 'Made-up: a second', 'prepaid'), 'P0001', 'a second open prepaid ID is refused',
  'identifier.open_client_id_limit');
select set_config('t.c', api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', 'MU-Q-2001',
  'Made-up: postpaid', 'postpaid') ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', 'MU-T-' || n, 'Made-up: tender', 'tender')
from generate_series(1, 2) n;
select test.runs(format('select api.identifier_add(%L, %L, %L, %L, %L)', current_setting('t.p'), 'payments_client_id',
  'MU-T-3', 'Made-up: tender', 'tender'), 'a third tender ID is not refused');

-- closed ten days ago: rows up to that day still match, later rows stop; its successor may now be added
select api.client_id_close(current_setting('t.a')::uuid, current_setting('t.d0')::date - 10, 'Made-up: account moved');
select test.as_owner();
select test.eq((select array[partner.money_match(i, current_setting('t.d0')::date - 11),
                             partner.money_match(i, current_setting('t.d0')::date - 10),
                             partner.money_match(i, current_setting('t.d0')::date - 9)]
                from partner.identifier i where i.id = current_setting('t.a')::uuid),
  array['match', 'match', null], 'a row dated after the close date no longer matches and one dated before still does');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.b', api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', 'MU-P-1002',
  'Made-up: the new prepaid', 'prepaid') ->> 'id', true);
select test.raises(format('select api.client_id_reopen(%L, %L)', current_setting('t.a'), 'Made-up: back'), 'P0001',
  'reopening is refused while its kind is at the limit', 'identifier.open_client_id_limit');
select test.raises(format('select api.client_id_close(%L, null, %L)', current_setting('t.a'), 'Made-up: no date'), 'P0001',
  'a close needs its date', 'identifier.close_date_required');
select test.eq((select x ->> 'closed_on' from jsonb_array_elements(api.partner(current_setting('t.p')::uuid) -> 'identifiers') x
                where x ->> 'id' = current_setting('t.a')), (current_setting('t.d0')::date - 10)::text,
  'the card shows the close date');

-- names only suggest a money match; a typed alias matches
select set_config('t.al', api.identifier_add(current_setting('t.p')::uuid, 'name', 'Made Up Ledger Group',
  'Made-up: how they sign', 'alias') ->> 'id', true);
select test.raises(format('select api.client_id_close(%L, %L, %L)', current_setting('t.al'), current_setting('t.d0'),
  'Made-up: wrong kind'), 'P0001', 'only a client ID has a close date', 'identifier.not_client_id');
select test.as_owner();
select test.eq((select array_agg(partner.money_match(i, current_setting('t.d0')::date) order by i.subkind)
                from partner.identifier i where i.partner_id = current_setting('t.p')::uuid and i.kind = 'name'
                  and i.deleted_at is null),
  array['match', 'suggest', 'suggest'], 'an official name only suggests; a trade name too; a typed alias matches');

-- an admin allowing two open prepaid IDs: A reopens
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('partner.open_client_ids', null, '{"prepaid": 2, "postpaid": 1}', null,
  'Made-up: two accounts for a while');
select test.as_person(current_setting('t.head')::uuid);
select test.runs(format('select api.client_id_reopen(%L, %L)', current_setting('t.a'), 'Made-up: still in use'),
  'with two allowed, A reopens');

-- a merge: the merged organisation's open postpaid ID arrives closed with a note; Undo brings it back open
select set_config('t.p2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ledger Branch',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.d', api.identifier_add(current_setting('t.p2')::uuid, 'payments_client_id', 'MU-Q-2002',
  'Made-up: the branch account', 'postpaid') ->> 'id', true);
select set_config('t.m', api.partner_merge(current_setting('t.p')::uuid, current_setting('t.p2')::uuid,
  'Made-up: one organisation') ->> 'request_id', true);
select test.as_owner();
select test.eq((select row(closed_on, note like '%closed on merging into%')::text from partner.identifier
                where partner_id = current_setting('t.p')::uuid and value_raw = 'MU-Q-2002' and deleted_at is null),
  row(current_setting('t.d0')::date, true)::text, 'the merged organisation''s open postpaid ID is closed, with a note');
select test.as_person(current_setting('t.head')::uuid);
select api.undo(current_setting('t.m')::uuid);
select test.as_owner();
select test.eq((select row(closed_on is null, deleted_at is null)::text from partner.identifier
                where id = current_setting('t.d')::uuid), row(true, true)::text, 'Undo brings it back open');
