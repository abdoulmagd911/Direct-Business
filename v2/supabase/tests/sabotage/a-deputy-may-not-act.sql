-- Sabotage: a-deputy-may-not-act
-- Breaks: sql:DLG-02
-- Expect: the deputy moves the status
-- The deputy is a helper like any other: no status moves.
create or replace function work.task_actable(p_id uuid) returns work.task
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  t work.task;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into t from work.task where id = p_id and deleted_at is null;
  if t.id is null or work.row_level('work.task', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not work.can_edit_task(me, t) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'own')::text;
  end if;
  return t;
end
$$;
