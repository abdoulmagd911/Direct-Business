-- Sabotage: a-task-has-two-deputies
-- Breaks: sql:DLG-02
-- Expect: a task has one deputy
-- Naming a deputy leaves the earlier one in place.
drop index work.task_helper_one_deputy;
create or replace function work.task_deputy_set(p_id uuid, p_person uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  t work.task := work.task_editable(p_id);
  req uuid;
  had uuid;
begin
  select h.person_id into had from work.task_helper h
  where h.task_id = p_id and h.is_deputy and h.deleted_at is null;
  if had is not distinct from p_person then
    raise exception using errcode = 'P0001', message = 'task.deputy_unchanged';
  end if;
  if p_person is not null then
    if not work.person_ok(p_person) then
      raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_person::text;
    end if;
    if p_person = t.owner_id then
      raise exception using errcode = 'P0001', message = 'task.deputy_is_responsible';
    end if;
    if not authz.can_see_as(p_person, 'work.task', p_id) then
      raise exception using errcode = 'P0001', message = 'task.deputy_cannot_see', detail = p_person::text;
    end if;
  end if;
  req := audit.begin('ui', case when p_person is null then 'task.deputy_cleared' else 'task.deputy_set' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_id]);
  if p_person is not null then
    if exists (select 1 from work.task_helper h
               where h.task_id = p_id and h.person_id = p_person and h.deleted_at is null) then
      update work.task_helper set is_deputy = true
      where task_id = p_id and person_id = p_person and deleted_at is null;
    else
      insert into work.task_helper (task_id, person_id, is_deputy) values (p_id, p_person, true);
    end if;
    if not work.task_is_past(t) then
      perform notify.push_assigned(p_person, 'helper_added', 'work.task', p_id);
    end if;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'deputy_id', p_person, 'request_id', req);
end
$$;
