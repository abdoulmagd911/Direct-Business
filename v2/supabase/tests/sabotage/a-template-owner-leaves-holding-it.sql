-- Sabotage: a-template-owner-leaves-holding-it
-- Breaks: sql:TPL-05
-- Expect: a live template its owner holds is open work
-- A live recurring template is not counted as open work, so its owner is switched off holding it (QA-523, V463).
create or replace function core.open_work(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'tasks', (select pg_catalog.count(*) from work.task t
              where t.owner_id = p_person and t.deleted_at is null and t.closed_at is null),
    'projects', (select pg_catalog.count(*) from work.project p
                 where p.owner_id = p_person and p.deleted_at is null and p.closed_at is null),
    'action_items', (select pg_catalog.count(*) from work.action_item a join work.task t on t.id = a.task_id
                     where a.owner_id = p_person and a.deleted_at is null and a.done_on is null
                       and t.deleted_at is null and t.closed_at is null),
    'sides', (select pg_catalog.count(*) from partner.side_owner m join partner.partner p on p.id = m.partner_id
              where m.person_id = p_person and m.deleted_at is null
                and (m.effective_to is null or m.effective_to > core.riyadh_today())
                and p.deleted_at is null and p.archived_at is null and partner.side_on(m.partner_id, m.side)))
$$;
