-- Sabotage: the-money-rows-take-seconds
-- Breaks: sql:SPD-01
-- Expect: every partner-tab and Finance-page read answers in under 2 s at live-like volume
-- Working the money rows out takes seconds again, as it did on live before Landing 35 (the reads were cut at 8 s).
create or replace function finance.money_rows() returns setof finance.money_row_calc
language plpgsql stable set search_path = '' set jit = off as $$
begin
  perform pg_catalog.pg_sleep(2.2);
  return query select c.* from finance.money_row_calc c;
end
$$;
