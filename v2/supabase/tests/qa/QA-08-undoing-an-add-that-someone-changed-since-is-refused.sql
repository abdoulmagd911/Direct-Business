-- QA-08 — Undoing an add that someone changed since is refused, naming them (V128, D7): the colleague's later edit is
-- never thrown away with the row. On v2/main at 72577fa audit.revert_change refuses it, but deleting that check leaves
-- all 79 tests green (the QA auditor's mutation run, docs/v2/QA-LOG.md, 2026-09-29, QA-08) — the Undo then soft-removes
-- the contact with the colleague's edit inside it. Passes on v2/main; fails when the check goes. Made-up values only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA8'), 'made up')
  ->> 'id', true);
select set_config('t.add', api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Test Contact"}')::text,
  true);

select test.as_person(current_setting('t.mem')::uuid);
select api.contact_save(current_setting('t.p')::uuid, (current_setting('t.add')::jsonb ->> 'id')::uuid,
  '{"job_title": "Made-up Title"}', 1);

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.add')::jsonb ->> 'request_id'), '40001',
  'the Undo of the add is refused once a colleague changed the contact', 'undo.changed_since');
select test.as_owner();
select test.eq((select deleted_at from partner.contact where id = (current_setting('t.add')::jsonb ->> 'id')::uuid),
  null::timestamptz, 'and the contact, with the colleague''s edit, stays');
