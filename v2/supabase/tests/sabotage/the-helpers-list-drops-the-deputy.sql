-- Sabotage: the-helpers-list-drops-the-deputy
-- Breaks: sql:DLG-02
-- Expect: emptying the helpers list keeps the deputy
-- Setting the helpers list removes the deputy with the rest.
create or replace function work.task_helpers_set(p_id uuid, p_people uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t work.task := work.task_editable(p_id);
  who uuid;
  req uuid;
  k int := 0;
begin
  req := audit.begin('ui', 'task.helpers_set', pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_id]);
  update work.task_helper set deleted_at = core.clock(), deleted_by = authz.me()
  where task_id = p_id and deleted_at is null
    and not (person_id = any (coalesce(p_people, '{}')));
  foreach who in array coalesce(p_people, '{}') loop
    continue when who is null or exists (select 1 from work.task_helper h
                                         where h.task_id = p_id and h.person_id = who and h.deleted_at is null);
    insert into work.task_helper (task_id, person_id) values (p_id, who);
    if not work.task_is_past(t) then
      perform notify.push_assigned(who, 'helper_added', 'work.task', p_id);
    end if;
    k := k + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('added', k, 'request_id', req);
end
$$;
