-- Sabotage: the-test-removal-takes-only-the-seeded-rows
-- Breaks: sql:TESTUSERS-02
-- Expect: the extra task a TEST user made is removed
-- The removal goes back to the first version's reach: only the ten seeded tasks and the six seeded notes.
create or replace function core.test_users_remove() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.system_person_id();
begin
  perform audit.begin('system', 'test_users.removed');
  update work.task set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'TEST rows removed'
    where id in (select core.test_id('task', n) from pg_catalog.generate_series(1, 10) n) and deleted_at is null;
  update my.note set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'TEST rows removed'
    where id in (select core.test_id('note', n) from pg_catalog.generate_series(1, 6) n) and deleted_at is null;
  perform audit.end();
  return '{}'::jsonb;
end
$$;
