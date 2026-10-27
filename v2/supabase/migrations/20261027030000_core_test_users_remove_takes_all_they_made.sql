-- QA-599 (V656 part 1): the removal before go-live also takes everything the six TEST people own or made, not only the
-- rows the seed wrote: every task one of them owns or made, the helper links on those tasks and the links they hold on
-- any task, and every note one of them wrote. It still takes only rows tied to the six TEST ids: nothing a real person
-- owns or made goes with them, except the tasks a TEST person owns or made themselves. Replaces the first version.
create or replace function core.test_users_remove() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.system_person_id();
  ppl uuid[] := array(select core.test_id('person', n) from pg_catalog.generate_series(1, 6) n);
  tms uuid[] := array(select core.test_id('team', n) from pg_catalog.generate_series(1, 5) n);
  tks uuid[];
  c_t int;
  c_n int;
  c_h int;
  c_p int;
begin
  perform audit.begin('system', 'test_users.removed');
  tks := array(select t.id from work.task t
               where (t.owner_id = any (ppl) or t.created_by = any (ppl) or t.id = any (array(select core.test_id('task', n)
                                                                                              from pg_catalog.generate_series(1, 10) n)))
                 and t.deleted_at is null);
  update work.task_helper set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'TEST rows removed'
    where (task_id = any (tks) or person_id = any (ppl) or created_by = any (ppl)) and deleted_at is null;
  get diagnostics c_h = row_count;
  update work.task set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'TEST rows removed'
    where id = any (tks) and deleted_at is null;
  get diagnostics c_t = row_count;
  update my.note set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'TEST rows removed'
    where (person_id = any (ppl) or created_by = any (ppl)) and deleted_at is null;
  get diagnostics c_n = row_count;
  update core.team set lead_person_id = null, active = false, retired_at = pg_catalog.now() where id = any (tms) and active;
  update core.person set can_sign_in = false, active = false, left_on = day.d, deleted_at = pg_catalog.now(), deleted_by = me,
                         delete_reason = 'TEST rows removed'
    from (select core.riyadh_today() as d) day
    where id = any (ppl) and deleted_at is null;
  get diagnostics c_p = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('tasks', c_t, 'notes', c_n, 'helper_links', c_h, 'people', c_p);
end
$$;
