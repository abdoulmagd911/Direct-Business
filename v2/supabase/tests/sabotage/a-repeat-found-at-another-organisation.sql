-- Sabotage: a-repeat-found-at-another-organisation
-- Breaks: sql:ACH-08
-- Expect: never another organisation's
-- The repeat check ignores the organisation, so look-alike work at another client is offered as a repeat (V531).
create or replace function perf.repeats_for(p_person uuid, p_partner uuid, p_category text, p_title text, p_on date,
                                 p_exclude uuid default null) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', x.id, 'number', x.number, 'title', x.title, 'happened_on', x.happened_on, 'score', pg_catalog.round(x.score::numeric, 2))
      order by x.score desc, x.happened_on desc), '[]'::jsonb)
  from (
    select a.id, a.number, a.title, a.happened_on,
           extensions.similarity(norm.fold(a.title), norm.fold(p_title)) as score
    from perf.achievement a
    join perf.achievement_category c on c.id = a.category_id
    where p_partner is not null and nullif(pg_catalog.btrim(p_title), '') is not null
      and a.deleted_at is null and a.id is distinct from p_exclude
      and c.code = pg_catalog.upper(pg_catalog.btrim(p_category))
      and a.happened_on between (coalesce(p_on, core.riyadh_today()) - interval '12 months')::date
                            and coalesce(p_on, core.riyadh_today())
      and perf.sees_department(p_person, a.department_id)
  ) x
  where x.score >= perf.repeat_threshold()
$$;
