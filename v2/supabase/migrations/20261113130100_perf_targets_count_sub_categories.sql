-- C-perf (owner's audit, 13 Nov): a target set on a parent category counts its sub-categories' achievements too —
-- the same way the Achievements list's category filter reads a parent (its own and its sub-categories'). Before, a
-- target on a parent matched the category exactly, so achievements filed under its sub-categories never reached it.
-- Checked first: the local plans hold no sub-categories and no targets, so no number moves today. perf.targets is
-- copied from its latest definition (20261109000040_perf_targets_and_category_retire.sql) with only the two category
-- matches changed (drafts still never count, V68); its signature and grants are unchanged. Forward-only (V103).
create or replace function perf.targets(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
begin
  if p_plan is null or not exists (select 1 from perf.plan p where p.id = p_plan and p.deleted_at is null
                                   and perf.sees_department(me, p.department_id)) then
    return '[]'::jsonb;
  end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', t.id, 'plan_id', t.plan_id, 'category_id', t.category_id, 'category_code', c.code,
      'category_name_en', c.name_en, 'category_name_ar', c.name_ar, 'month', t.month,
      'target_count', t.target_count, 'target_value', t.target_value,
      'achieved_count', (select pg_catalog.count(*)::int from perf.achievement a
                         join perf.achievement_category ac on ac.id = a.category_id
                         where a.plan_id = t.plan_id and (a.category_id = t.category_id or ac.parent_id = t.category_id)
                           and a.deleted_at is null
                           and not a.draft and a.happened_on >= t.month
                           and a.happened_on < (t.month + pg_catalog.make_interval(months => 1))::date),
      'achieved_value', (select coalesce(pg_catalog.sum(a.deal_value), 0) from perf.achievement a
                         join perf.achievement_category ac on ac.id = a.category_id
                         where a.plan_id = t.plan_id and (a.category_id = t.category_id or ac.parent_id = t.category_id)
                           and a.deleted_at is null
                           and not a.draft and a.happened_on >= t.month
                           and a.happened_on < (t.month + pg_catalog.make_interval(months => 1))::date),
      'version', t.version)
      order by t.month, c.sort, c.code)
    from perf.target t
    join perf.achievement_category c on c.id = t.category_id
    where t.plan_id = p_plan and t.deleted_at is null), '[]'::jsonb);
end
$$;
