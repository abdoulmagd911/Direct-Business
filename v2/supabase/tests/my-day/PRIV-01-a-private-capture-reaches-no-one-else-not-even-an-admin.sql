-- PRIV-01 — a private capture stays its author's (V454; Productivity Stage 1): another member and an admin never see a
-- private note or idea, nor its title — not on My day (team or workspace), not in search, not by its id, not in a
-- wrap-up, not in the log of moves. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-private-note-reaches-an-admin.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am', test.person('Test Private Member', 'member')::text, true);
select set_config('t.am2', test.person('Test Private Colleague', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_priv', 'Test Private Desk', 'فريق الخصوصية');
update core.person set team_id = (select id from core.team where code = 'test_priv')
where id in (current_setting('t.am')::uuid, current_setting('t.am2')::uuid, current_setting('t.admin')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.i', api.note_capture('idea', jsonb_build_object('title', 'Zebracorn private plan')) ->> 'id', true);
select api.wrap_up(jsonb_build_array(jsonb_build_object('kind', 'note', 'id', current_setting('t.i'), 'choice', 'tomorrow')));

select test.as_owner();
select set_config('t.c', (select id from my.carry where entity_id = current_setting('t.i')::uuid limit 1)::text, true);
select test.as_person(current_setting('t.am2')::uuid);
select test.ok(position('Zebracorn' in api.my_day('team')::text || api.my_day('workspace')::text) = 0,
  'a colleague''s My day holds nothing of it');
select test.ok(position('Zebracorn' in api.search('Zebracorn')::text) = 0, 'nor their search');
select test.raises($$select api.my_note(current_setting('t.i')::uuid)$$, 'P0002', 'nor its id', 'common.not_found');

select test.as_person(current_setting('t.admin')::uuid);
select test.ok(position('Zebracorn' in api.my_day('team')::text || api.my_day('workspace')::text) = 0,
  'an admin''s My day holds nothing of it');
select test.ok(position('Zebracorn' in api.search('Zebracorn')::text) = 0, 'nor an admin''s search');
select test.raises($$select api.my_note(current_setting('t.i')::uuid)$$, 'P0002', 'nor its id for an admin', 'common.not_found');
select test.raises($$select api.wrap_up(jsonb_build_array(jsonb_build_object('kind', 'note', 'id', current_setting('t.i'),
  'choice', 'done')))$$, 'P0002', 'an admin cannot wrap it up', 'common.not_found');
select test.as_owner();
select test.ok(current_setting('t.c') <> '' and not authz.can_see_as(current_setting('t.admin')::uuid, 'my.carry',
                 current_setting('t.c')::uuid), 'nor see its moves');
