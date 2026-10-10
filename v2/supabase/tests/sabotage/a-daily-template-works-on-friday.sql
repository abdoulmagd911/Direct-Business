-- Sabotage: a-daily-template-works-on-friday
-- Breaks: sql:TPL-02
-- Expect: working days: not Friday
-- A working-days template is made on Friday (the weekend is Friday and Saturday — V472).
create or replace function work.occurs_on(p_rule jsonb, p_start date, p_day date) returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  freq text := p_rule ->> 'freq';
  n int := coalesce((p_rule ->> 'interval')::int, 1);
  dow int := pg_catalog.date_part('dow', p_day)::int;
  months int;
  md int;
  last_day int;
begin
  if p_day < p_start then
    return false;
  end if;
  if freq = 'daily' then
    if coalesce((p_rule ->> 'working_days')::boolean, false) and dow in (6) then
      return false;
    end if;
    return (p_day - p_start) % n = 0;
  elsif freq = 'weekly' then
    if not (case when p_rule ? 'weekdays'
                 then exists (select 1 from pg_catalog.jsonb_array_elements_text(p_rule -> 'weekdays') d where d::int = dow)
                 else dow = pg_catalog.date_part('dow', p_start)::int end) then
      return false;
    end if;
    return ((p_day - (p_start - pg_catalog.date_part('dow', p_start)::int)) / 7) % n = 0;
  end if;
  months := case freq when 'monthly' then n when 'quarterly' then 3 * n else 12 * n end;
  if ((pg_catalog.date_part('year', p_day)::int * 12 + pg_catalog.date_part('month', p_day)::int)
      - (pg_catalog.date_part('year', p_start)::int * 12 + pg_catalog.date_part('month', p_start)::int)) % months <> 0 then
    return false;
  end if;
  md := coalesce((p_rule ->> 'month_day')::int, pg_catalog.date_part('day', p_start)::int);
  last_day := pg_catalog.date_part('day', (pg_catalog.make_date(pg_catalog.date_part('year', p_day)::int,
                                                                pg_catalog.date_part('month', p_day)::int, 1)
                                           + interval '1 month' - interval '1 day'))::int;
  return pg_catalog.date_part('day', p_day)::int = least(md, last_day);
end
$$;
