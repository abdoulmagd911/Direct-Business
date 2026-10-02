-- Sabotage: the-job-makes-an-occurrence-twice
-- Breaks: sql:TPL-01
-- Expect: one task for each key client, once
-- Each run of the job makes the occurrence again.
drop index work.task_occurrence_once;
create or replace function work.template_generate_one(t work.task_template, p_day date, p_due date, p_partner uuid)
  returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  owner uuid := work.template_owner(t, p_partner);
  team uuid;
  occ uuid;
  tid uuid;
begin
  if owner is null then
    return null;
  end if;
  team := coalesce(t.team_id, (select p.team_id from core.person p where p.id = owner));
  if team is null then
    return null;
  end if;
  perform work.template_request(t);
  insert into work.task_occurrence (template_id, occurs_on, partner_id) values (t.id, p_due, p_partner)
  returning id into occ;
  insert into work.task (number, title, notes, owner_id, team_id, department_id, priority_id, status_id, type_id,
                         work_type, due_on, partner_id, origin, happened_on)
  values (core.format_number('TSK', pg_catalog.date_part('year', p_day)::int,
                             core.next_number('task', pg_catalog.date_part('year', p_day)::int)),
          t.title, t.notes, owner, team, (select m.department_id from core.team m where m.id = team), t.priority_id,
          (select s.id from work.task_status s where s.is_default and s.deleted_at is null), t.type_id,
          case when p_partner is null then 'internal' else 'client' end, p_due, p_partner, 'template', p_day)
  returning id into tid;
  update work.task_occurrence set task_id = tid where id = occ;
  perform work.template_checklist_add(t, tid, p_day);
  if t.attach_previous then
    perform work.template_attach_previous(t, p_partner, tid);
  end if;
  if not work.is_past(p_day) then
    perform notify.push_assigned(owner, 'assigned', 'work.task', tid);
  end if;
  perform audit.end();
  return tid;
end
$$;
