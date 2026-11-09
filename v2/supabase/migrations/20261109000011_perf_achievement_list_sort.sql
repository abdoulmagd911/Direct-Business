-- Landing 3 (FIX-01): the achievements list sorts. perf.achievement_list gains a 'sort' filter key —
-- 'newest' (the order as it was: happened day, then logged, then id), 'oldest', 'title', 'owner' (by the
-- owner's name). Every order ends in the stable tie-break the fix round agreed (D28): added-at, then id.
-- Copied from 20261002040000 exactly otherwise. Forward-only (V103).
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
    where a.deleted_at is null and perf.sees_department(me, a.department_id)
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
