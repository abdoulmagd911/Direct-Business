-- Sabotage: numbers-never-advance
-- Breaks: sql:CORE-02
-- Expect: the second task number of 2026
-- The counter hands out the same number twice.
create or replace function core.next_number(p_kind text, p_year int) returns int
language plpgsql volatile security definer set search_path = ''
as $$
begin
  insert into core.counter (kind, year, last) values (p_kind, p_year, 1) on conflict (kind, year) do nothing;
  return 1;
end
$$;
