-- Sabotage: leaving-drops-a-later-side
-- Breaks: sql:LEAVE-01
-- Expect: passes whole
-- An organisation the leaver was to own from a later day is dropped instead of passing to the new owner (V452).
create or replace function core.hand_over(p_from uuid, p_to uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  today date := core.riyadh_today();
  t work.task;
  p work.project;
  a record;
  m partner.side_owner;
  k_tasks int := 0;
  k_projects int := 0;
  k_items int := 0;
  k_sides int := 0;
  k_templates int := 0;
  told uuid[] := '{}';
begin
  if p_to = p_from then
    raise exception using errcode = 'P0001', message = 'person.hand_over_to_self';
  end if;
  if not exists (select 1 from core.person x where x.id = p_to and x.kind = 'staff' and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = p_to::text;
  end if;
  perform work.require_person(p_to);
  for t in select * from work.task x where x.owner_id = p_from and x.deleted_at is null and x.closed_at is null
           order by x.number loop
    update work.task set owner_id = p_to, assigned_by = case when p_to <> me then me end where id = t.id;
    if not work.task_is_past(t) then
      perform notify.push_assigned(p_to, 'assigned', 'work.task', t.id);
    end if;
    k_tasks := k_tasks + 1;
  end loop;
  for p in select * from work.project x where x.owner_id = p_from and x.deleted_at is null and x.closed_at is null
           order by x.number loop
    update work.project set owner_id = p_to where id = p.id;
    if not work.is_past(p.happened_on) then
      perform notify.push_assigned(p_to, 'assigned', 'work.project', p.id);
    end if;
    k_projects := k_projects + 1;
  end loop;
  for a in select i.id, x as task from work.action_item i join work.task x on x.id = i.task_id
           where i.owner_id = p_from and i.deleted_at is null and i.done_on is null
             and x.deleted_at is null and x.closed_at is null
           order by x.number, i.sort, i.id loop
    update work.action_item set owner_id = p_to where id = a.id;
    if not work.task_is_past(a.task) then
      perform notify.push_assigned(p_to, 'assigned', 'work.action_item', a.id);
    end if;
    k_items := k_items + 1;
  end loop;
  for m in select x.* from partner.side_owner x join partner.partner o on o.id = x.partner_id
           where x.person_id = p_from and x.deleted_at is null and (x.effective_to is null or x.effective_to > today)
             and o.deleted_at is null and o.archived_at is null and partner.side_on(x.partner_id, x.side)
           order by x.partner_id, x.side, x.effective_from loop
    if m.effective_from >= today then
      update partner.side_owner set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'handed over'
      where id = m.id;
    else
      update partner.side_owner set effective_to = today where id = m.id;
      insert into partner.side_owner (partner_id, side, person_id, effective_from, effective_to, reason)
      values (m.partner_id, m.side, p_to, today, m.effective_to, 'handed over');
    end if;
    if not (m.partner_id = any (told)) then
      perform notify.push_assigned(p_to, 'assigned', 'partner.partner', m.partner_id);
      told := told || m.partner_id;
    end if;
    k_sides := k_sides + 1;
  end loop;
  -- a live recurring template keeps making tasks for its owner, so it goes with the rest (V463); no notice — its next
  -- task tells the new owner when it is made
  update work.task_template k set owner_id = p_to
  where k.owner_id = p_from and k.deleted_at is null and k.active
    and (k.ends_on is null or k.ends_on >= today);
  get diagnostics k_templates = row_count;
  return pg_catalog.jsonb_build_object('tasks', k_tasks, 'projects', k_projects, 'action_items', k_items,
                                       'sides', k_sides, 'templates', k_templates);
end
$$;
