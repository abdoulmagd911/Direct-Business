-- Sabotage: the-job-runs-a-switched-off-template
-- Breaks: sql:TPL-01
-- Expect: a template switched off or ended makes nothing
-- The job runs templates switched off or past their end.
create or replace function work.generate_recurring(p_day date default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  today date := coalesce(p_day, core.riyadh_today());
  t work.task_template;
  due date;
  p uuid;
  made int := 0;
begin
  for t in select x.* from work.task_template x
           where x.deleted_at is null and x.rule is not null
           order by x.created_at, x.id loop
    due := today + coalesce((t.rule ->> 'lead_days')::int, 0);
    continue when not work.occurs_on(t.rule, t.starts_on, due);
    for p in select x from work.template_targets(t, due) x loop
      if work.template_generate_one(t, today, due, p) is not null then
        made := made + 1;
      end if;
    end loop;
  end loop;
  return made;
end
$$;
