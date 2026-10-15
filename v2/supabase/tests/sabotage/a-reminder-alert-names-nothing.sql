-- Sabotage: a-reminder-alert-names-nothing
-- Breaks: sql:NTF-07
-- Expect: a reminder on a titled note reads by the title
-- The bell's names know no reminder, so its row reads "Reminder: Reminder" (the sweep of 15 Oct, item 2).
do $$
declare
  d text := pg_catalog.pg_get_functiondef('notify.entity_title(text, uuid, uuid)'::regprocedure);
begin
  d := pg_catalog.regexp_replace(d, '    when ''core.reminder'' then.*?    when ''my.note'' then', '    when ''my.note'' then', 's');
  execute d;
end
$$;
