-- Sabotage: reports-to-walks-the-whole-chain
-- Breaks: sql:ACC-06
-- Expect: but nobody further down the line
-- The appraisal line walks the whole chain (the world before V96): a manager's manager sees every appraisal below.
create or replace function authz.reports_to(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  with recursive up as (
    select p.manager_id, 1 as depth from core.person p where p.id = p_person
    union all
    select p.manager_id, up.depth + 1 from core.person p join up on p.id = up.manager_id where up.depth < 50
  )
  select coalesce(authz.me() in (select manager_id from up where manager_id is not null), false)
$$;
