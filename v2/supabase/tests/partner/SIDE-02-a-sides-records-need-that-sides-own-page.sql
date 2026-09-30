-- SIDE-02 — a side's records need that side's own page (V147, V167; the QA review of #94 and #96): a manager who holds
-- the Clients capabilities (assign, identify) but not the Clients page sets no Client status, names no Client owner and
-- adds or removes no client ID; named the Client side's owner all the same, they read none of its contracts or files
-- and no alert of its contracts reaches them; the card and the hover card name no owner of a side they cannot see. An
-- agreement is restricted whatever the upload asks (D10). Every value is made up.
-- Sabotages: supabase/tests/sabotage/side-writes-by-capability-alone.sql,
--            supabase/tests/sabotage/a-side-owner-without-its-page.sql,
--            supabase/tests/sabotage/owners-see-their-side-without-the-page.sql,
--            supabase/tests/sabotage/owners-of-unseen-sides-shown.sql,
--            supabase/tests/sabotage/agreements-uploaded-as-normal.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.mgr', test.person('Test Supplier Manager', 'manager')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.mgr')::uuid, 'clients', 'none', 'made up: suppliers only');
select test.ok(authz.can_of(current_setting('t.mgr')::uuid, 'clients.assign')
               and authz.can_of(current_setting('t.mgr')::uuid, 'clients.identify'),
  'the manager holds the Clients capabilities, as every manager does');
select set_config('v2.test_now', now()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Two Sides',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.head')),
                             jsonb_build_object('side', 'supplier_partner', 'type', 'supplier')))) ->> 'id', true);
select set_config('t.cid', api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', 'C-000456', 'made up',
  'postpaid') ->> 'id', true);
select api.partner_owner_set(current_setting('t.p')::uuid, 'supplier_partner', null);  -- the head owns the Client side alone

-- the Clients capabilities without the Clients page change nothing on the Client side
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.partner_status_set(%L, %L, %L)', current_setting('t.p'), 'client', 'active'),
  '42501', 'the Clients capability sets no Client status without the Clients page', 'access.needs_level');
select test.raises(format('select api.partner_owner_set(%L, %L, %L)', current_setting('t.p'), 'client',
  current_setting('t.mgr')), '42501', 'nor names a Client owner', 'access.needs_level');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L, %L)', current_setting('t.p'), 'payments_client_id',
  'C-000789', 'made up', 'postpaid'), '42501', 'nor adds a client ID', 'access.needs_level');
select test.raises(format('select api.identifier_remove(%L, %L)', current_setting('t.cid'), 'made up'), '42501',
  'nor removes one', 'access.needs_level');
select test.ok((api.partner_status_set(current_setting('t.p')::uuid, 'supplier_partner', 'active') ->> 'id') is not null,
  'the Supplier & partner side is theirs to set');
-- and the page without the capability: a member with Full on Clients sets no status on a Client side they do not own
select test.as_person(test.person('Test Member', 'member'));
select test.raises(format('select api.partner_status_set(%L, %L, %L)', current_setting('t.p'), 'client', 'active'),
  '42501', 'the Clients page without its assign capability sets no one else''s Client status', 'access.needs_capability');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'owner_id', null::text,
  'the card names no owner of a side they cannot see');
select test.eq(api.hover_partner(current_setting('t.p')::uuid) ->> 'owner_id', null::text, 'nor does the hover card');

-- named the Client side's owner, still nothing of that side without its page
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'owner_id', current_setting('t.head'),
  'who sees the Client side sees its owner');
select api.partner_owner_set(current_setting('t.p')::uuid, 'client', current_setting('t.mgr')::uuid);
select set_config('t.k', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up corporate rates', 'start_on', core.riyadh_today() - 300, 'end_on', core.riyadh_today() + 30)) ->> 'id', true);
select api.follow('contract', current_setting('t.k')::uuid, true);
select set_config('t.f', api.file_begin('partner', current_setting('t.p')::uuid, 'rate_sheet', 'attachment', 'rates.pdf',
  1000, 'application/pdf', null, 'client') ->> 'id', true);
select test.as_owner();
insert into storage.objects (bucket_id, name) select 'files', path from core.file where id = current_setting('t.f')::uuid;
select test.as_person(current_setting('t.head')::uuid);
select api.file_finish(current_setting('t.f')::uuid, repeat('1', 64));
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(jsonb_array_length(api.contracts(current_setting('t.p')::uuid)), 0,
  'named the Client side''s owner, they still read none of its contracts');
select test.as_owner();
select test.ok(not core.file_visible_as(current_setting('t.f')::uuid, current_setting('t.mgr')::uuid),
  'nor its files');
select notify.generate_alerts();
select test.eq((select string_agg(p.full_name_en, ', ' order by p.full_name_en) from notify.notification n
                join core.person p on p.id = n.person_id
                where n.kind = 'alert_contract_expiring' and n.entity_id = current_setting('t.k')::uuid),
  'Test Head', 'the contract''s alert reaches its follower who sees it, not its owner who cannot');

-- an agreement is restricted whatever the upload asks (D10)
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ag', api.file_begin('partner', current_setting('t.p')::uuid, 'agreement', 'agreement', 'a.pdf',
  1000, 'application/pdf', 'normal', 'client') ->> 'id', true);
select set_config('t.ag2', api.file_begin('partner', current_setting('t.p')::uuid, 'other', 'agreement', 'b.pdf',
  1000, 'application/pdf', 'normal', 'client') ->> 'id', true);
select test.as_owner();
select test.eq((select string_agg(sensitivity, ', ') from core.file
                where id in (current_setting('t.ag')::uuid, current_setting('t.ag2')::uuid)),
  'restricted, restricted', 'an agreement is restricted whatever the upload asks, by its kind or its purpose');
