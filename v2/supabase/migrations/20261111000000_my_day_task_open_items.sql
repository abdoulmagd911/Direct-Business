-- Landing 13 (review #14): My day's tick knew nothing about a task's open checklist items — the Today
-- list's rows carry no open-item count, so the tick was built on a stub saying 0, sent the Done move
-- straight through, and the database refused it (task.open_action_items) — the tick looked refused with no
-- ask first. The rows now carry the real count, the same count work.task_row carries (open action items:
-- not deleted, not done). my.my_tasks is copied from 20261101090000, one key added, each exactly otherwise.
-- Forward-only (V103).
create or replace function my.my_tasks(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'partner_id', p.id,
           'partner_name', p.trade_name_en, 'client', p.trade_name_en, 'project_id', t.project_id, 'status_id', t.status_id,
           'starred', t.starred,
           'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                                  where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
           'role', case when t.owner_id = p_person then 'owner' else 'helper' end,
           'group', case when t.owner_id is distinct from p_person then 'helping'
                         when t.due_on < d.today then 'overdue' when t.due_on = d.today then 'today' else 'next' end,
           'carried_over', my.carry_count(p_person, 'work.task', t.id))
           order by t.owner_id is distinct from p_person, t.due_on, t.number), '[]'::jsonb)
  from (select core.riyadh_today() as today) d
  -- V661 (the Architect, 1 Nov): a starred task is on the Today list whatever its due day, undated included
  join work.task t on t.deleted_at is null and t.closed_at is null
                  and ((t.due_on is not null and t.due_on <= d.today + 7) or t.starred)
                  and (t.owner_id = p_person
                       or exists (select 1 from work.task_helper h
                                  where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null))
  left join partner.partner p on p.id = t.partner_id and authz.can_see_as(p_person, 'partner.partner', p.id)
  where not work.task_is_past(t)
$$;
