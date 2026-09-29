-- UNDO-04 — an insert is undone by removing the row, never deleting it; a removal by restoring it, whatever time zone
-- the two ran in; a restore that a uniqueness rule now blocks is refused and names what holds the value (§3.3). A record
-- that cannot be removed (a profile) and a stray hard delete are not undone.
-- Sabotages: supabase/tests/sabotage/undo-deletes-an-insert.sql, supabase/tests/sabotage/capture-writes-local-times.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r1', api.access_set_person_level(current_setting('t.am1')::uuid, 'kpis', 'view',
  'made up: an override') ->> 'request_id', true);
select test.as_owner();
select set_config('t.row1', (select row_id::text from audit.change where request_id = current_setting('t.r1')::uuid),
  true);
select test.as_person(current_setting('t.admin')::uuid);
select api.undo(current_setting('t.r1')::uuid);
select test.as_owner();
select test.ok(exists (select 1 from core.person_page_level where id = current_setting('t.row1')::uuid
                       and deleted_at is not null and deleted_by = current_setting('t.admin')::uuid
                       and delete_reason = 'undo'),
  'an insert undone is removed, not deleted: the row stays, marked removed by whoever undid it');
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'kpis'), 'own'::core.level,
  'and the person is back on their role''s level');

-- a removal made in Riyadh time, undone in UTC
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_level(current_setting('t.am1')::uuid, 'kpis', 'view', 'made up: set again');
set local timezone = 'Asia/Riyadh';
select set_config('t.r3', api.access_clear_person_level(current_setting('t.am1')::uuid, 'kpis',
  'made up: cleared') ->> 'request_id', true);
set local timezone = 'UTC';
select test.runs(format('select api.undo(%L)', current_setting('t.r3')),
  'a removal undone restores the row, whatever the time zone');
select test.as_owner();
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'kpis'), 'view'::core.level,
  'a removal undone restores the row, whatever the time zone');

-- a restore blocked by the row that holds the value now
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r4', api.access_clear_person_level(current_setting('t.am1')::uuid, 'kpis',
  'made up: cleared again') ->> 'request_id', true);
select api.access_set_person_level(current_setting('t.am1')::uuid, 'kpis', 'full', 'made up: a new override');
select test.raises(format('select api.undo(%L)', current_setting('t.r4')), '23505',
  'a restore that a uniqueness rule blocks is refused', 'undo.blocked_by_duplicate');
do $$
declare
  d text;
begin
  perform api.undo(current_setting('t.r4')::uuid);
exception when unique_violation then
  get stacked diagnostics d = pg_exception_detail;
  perform set_config('t.detail', d, true);
end $$;
select test.ok(current_setting('t.detail') like '%' || current_setting('t.am1') || '%kpis%',
  'and names what holds the value now: ' || current_setting('t.detail'));

-- what cannot be undone
select set_config('t.r6', test.act(current_setting('t.am1')::uuid)::text, true);
insert into core.person_profile (person_id, theme) values (current_setting('t.am1')::uuid, 'dark');
select test.done();
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r6')), 'P0001',
  'a profile, which is never removed, is not undone by removing it', 'undo.cannot_remove');
select test.as_owner();
select set_config('t.r7', test.act(current_setting('t.admin')::uuid)::text, true);
delete from core.person_profile where person_id = current_setting('t.am1')::uuid;
select test.done();
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r7')), 'P0001',
  'a stray hard delete is not undone', 'undo.cannot_undo_delete');
