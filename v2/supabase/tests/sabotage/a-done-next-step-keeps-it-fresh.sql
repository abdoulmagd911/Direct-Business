-- Sabotage: a-done-next-step-keeps-it-fresh
-- Breaks: sql:ACT-02
-- Expect: done, it goes stale
-- A next step's task keeps the organisation fresh even once done (V151).
create or replace function partner.stale_on(p_partner uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select case when p.archived_at is null and p.deleted_at is null
                   and exists (select 1 from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
                               and partner.side_on(p.id, s.side)
                               and partner.status_of(p.id, s.side) is distinct from 'lost')
              then greatest(coalesce(a.last_on, sd.since_on)
                              + coalesce((core.setting_at('partner.stale_after_days', null, core.riyadh_today()) #>> '{}')::int, 21),
                            a.next_on + 1) end
  from partner.partner p
  left join lateral (
    select pg_catalog.max(n.happened_on) as last_on,
           pg_catalog.max(case when t.id is null then n.next_step_on
                               else greatest(n.next_step_on, core.riyadh_today()) end) as next_on
    from core.note n left join work.task t on t.id = n.next_step_task_id
    where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity' and n.deleted_at is null) a
    on true
  left join lateral (select pg_catalog.min(s.since) as since_on from partner.partner_side s
                     where s.partner_id = p.id and s.deleted_at is null and partner.side_on(p.id, s.side)) sd on true
  where p.id = p_partner
$$;
