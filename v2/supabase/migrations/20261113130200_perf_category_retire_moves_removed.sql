-- C-perf (owner's audit, 13 Nov): archiving an achievement category moves the removed achievements that use it too,
-- as core.list_retire does for every other list (QA-97: "rows waiting in Recently deleted move too, so a restore brings
-- them back on the replacement"). Before, only live achievements moved: the archive dialog counted every use (the live
-- and the recently removed, core.list_uses) and said they all move, while the removed ones kept the archived category
-- and came back on it when restored. The deal-value check covers the removed ones as well (moving one with a deal value
-- to a category without one would be refused half-way). perf.category_retire is copied from its latest definition
-- (20261109000040_perf_targets_and_category_retire.sql) with only those two changes; signature and grants unchanged.
-- Forward-only (V103).
create or replace function perf.category_retire(p_id uuid, p_replacement uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  why text := core.access_reason(p_reason);
  c perf.achievement_category;
  rep perf.achievement_category;
  moved bigint;
  gone bigint;
  req uuid;
begin
  select * into c from perf.achievement_category x where x.id = p_id and x.deleted_at is null;
  if c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into rep from perf.achievement_category x where x.id = p_replacement and x.deleted_at is null;
  if rep.id is null or not rep.active or rep.plan_id is distinct from c.plan_id or rep.id = c.id
     or rep.parent_id = c.id then
    raise exception using errcode = 'P0001', message = 'list.replacement_invalid';
  end if;
  if exists (select 1 from perf.achievement_category s where s.parent_id = c.id and s.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'list.in_use',
      detail = (select pg_catalog.string_agg(s.code, ', ') from perf.achievement_category s
                where s.parent_id = c.id and s.deleted_at is null);
  end if;
  if exists (select 1 from perf.achievement a where a.category_id = c.id
             and a.deal_value is not null) and not rep.has_deal_value then
    raise exception using errcode = 'P0001', message = 'achievement_category.deal_values_held';
  end if;
  req := audit.begin('ui', 'achievement_category.retired', pg_catalog.jsonb_build_object('code', c.code), why);
  -- removed achievements move too, so a restore brings them back on the replacement (QA-97, as core.list_retire);
  -- they are counted apart: 'moved' stays the live ones
  select pg_catalog.count(*) into gone from perf.achievement a where a.category_id = p_id and a.deleted_at is not null;
  update perf.achievement a set category_id = p_replacement where a.category_id = p_id;
  get diagnostics moved = row_count;
  moved := moved - gone;
  perform audit.write_fields('perf.achievement_category', p_id, '{"active": false}');
  perform audit.end();
  return pg_catalog.jsonb_build_object('moved', moved, 'moved_removed', gone, 'request_id', req);
end
$$;
