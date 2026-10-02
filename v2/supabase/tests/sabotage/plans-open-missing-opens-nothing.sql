-- Sabotage: plans-open-missing-opens-nothing
-- Breaks: sql:ACH-11
-- Expect: the missing three are opened
-- The system's run opens no plan, so a department keeps an empty Category list (V380).
create or replace function perf.plans_open_missing(p_years int[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return 0;
end
$$;
