-- Sabotage: a-colleagues-achievement-edited
-- Breaks: sql:ACH-02
-- Expect: a member never changes a colleague's
-- Own on KPIs counts as Full, so a member changes a colleague's achievement (§3.8).
create or replace function perf.can_edit(p_person uuid, a perf.achievement) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case perf.row_level('perf.achievement', a.id, p_person)
           when 'full' then true
           when 'own' then true
           else false end
$$;
