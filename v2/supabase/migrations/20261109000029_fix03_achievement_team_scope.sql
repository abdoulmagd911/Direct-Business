-- FIX-03 (F089, P2): a cross-team achievement is refused, and the list is scoped to match. Achievements were
-- department-wide (V96): anyone in the department saw every achievement, so a Commercial member opened another team's
-- achievement read-only. The rule is now: the whole department still sees it when the reader holds Full on KPIs, or
-- is one of the achievement's own people (owner, creator, participant), or is on the same team as the owner — two
-- people with no team count as the same team, so the teamless colleagues of ACH-02 keep seeing the department's
-- achievements. One rule, two call sites: perf.row_level (the record read, edit, restore and comment paths) and
-- perf.achievement_list (the list and its total). Plans, repeats and the log's department gates are untouched: they
-- are department-level, not record-level. Forward-only (V103).
-- Regression test: FIX03-01 (supabase/tests/fix03/).
create function perf.sees_achievement(p_person uuid, a perf.achievement) returns boolean
language sql stable security definer set search_path = ''
as $$
  select a.id is not null and perf.sees_department(p_person, a.department_id)
         and (authz.level_of(p_person, 'kpis') = 'full'
              or perf.is_own(p_person, a)
              or (select p.team_id from core.person p where p.id = p_person)
                 is not distinct from (select p.team_id from core.person p where p.id = a.owner_id))
$$;

create or replace function perf.row_level(p_table text, p_id uuid, p_person uuid) returns core.level
language sql stable security definer set search_path = ''
as $$
  select case when perf.sees_achievement(p_person, a)
              then authz.level_of(p_person, 'kpis') else 'none'::core.level end
  from (select perf.achievement_of(p_table, p_id) as aid) k
  left join perf.achievement a on a.id = k.aid
$$;

-- The list reads the same rule, so its total never counts a record the reader is refused (D36(c)).
create or replace function perf.achievement_list(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  lim int := greatest(1, least(coalesce(p_limit, 50), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := norm.fold(f ->> 'q');
  who uuid := case when f ->> 'scope' = 'mine' then me else nullif(f ->> 'person_id', '')::uuid end;
  month date := case when f ->> 'month' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then (f ->> 'month' || '-01')::date end;
  cat text := pg_catalog.upper(nullif(pg_catalog.btrim(f ->> 'category'), ''));
  sort text := coalesce(nullif(f ->> 'sort', ''), 'newest');
  rows jsonb;
  total int;
begin
  with hits as (
    select a, perf.achievement_flags(a) as fl,
           (select coalesce(p.full_name_en, p.full_name_ar) from core.person p where p.id = a.owner_id) as owner_name
    from perf.achievement a
    join perf.achievement_category c on c.id = a.category_id
    left join perf.achievement_category pc on pc.id = c.parent_id
    where a.deleted_at is null and perf.sees_achievement(me, a)
      and (cat is null or c.code = cat or pc.code = cat)
      and (who is null or a.owner_id = who
           or exists (select 1 from perf.achievement_participant x
                      where x.achievement_id = a.id and x.person_id = who and x.deleted_at is null))
      and (month is null or (a.happened_on >= month and a.happened_on < (month + interval '1 month')::date))
      and (nullif(f ->> 'year', '') is null or pg_catalog.date_part('year', a.happened_on) = (f ->> 'year')::int)
      and (nullif(f ->> 'partner_id', '') is null or a.partner_id = (f ->> 'partner_id')::uuid)
      and (q is null or norm.fold(a.title) like '%' || q || '%' or norm.fold(a.number) like '%' || q || '%')
  ), flagged as (
    select * from hits h
    where (f -> 'backfilled' is null or (h.fl ->> 'backfilled')::boolean = (f ->> 'backfilled')::boolean)
      and (f -> 'past_work' is null or (h.fl ->> 'past_work')::boolean = (f ->> 'past_work')::boolean)
      and (not coalesce((f ->> 'needs_owner')::boolean, false) or (h.fl ->> 'needs_owner')::boolean)
      and (f -> 'draft' is null or (h.fl ->> 'draft')::boolean = (f ->> 'draft')::boolean)
      and (not coalesce((f ->> 'no_evidence')::boolean, false) or (h.fl ->> 'no_evidence')::boolean)
  )
  select (select pg_catalog.count(*)::int from flagged),
         coalesce((select pg_catalog.jsonb_agg(perf.achievement_row(x.a, me) order by x.o)
                   from (select y.a, pg_catalog.row_number() over (
                                  -- each sort names its own keys; the branches that do not apply are null
                                  -- for every row, so they never order. Every order ends in the stable
                                  -- tie-break the fix round agreed (D28): added-at, then id
                                  order by case when sort = 'oldest' then (y.a).happened_on end asc nulls last,
                                           case when sort = 'title' then pg_catalog.lower((y.a).title) end asc nulls last,
                                           case when sort = 'owner' then y.owner_name end asc nulls last,
                                           case when sort = 'oldest' then (y.a).logged_at end asc,
                                           case when sort <> 'oldest' then (y.a).happened_on end desc nulls first,
                                           case when sort <> 'oldest' then (y.a).logged_at end desc,
                                           (y.a).id) o
                         from flagged y) x
                   where x.o > off and x.o <= off + lim), '[]'::jsonb)
    into total, rows;
  return pg_catalog.jsonb_build_object('rows', rows, 'total', total, 'more', total > off + lim);
end
$$;
