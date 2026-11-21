-- Sabotage: the-money-rows-are-planned-per-mention
-- Breaks: sql:SPD-01
-- Expect: finance.money_row reads finance.money_rows(): one kept plan, worked out once per mention
-- finance.money_row is the whole definition again, planned and worked out for every mention of it in a read.
create or replace view finance.money_row with (security_invoker = true) as
select c.* from finance.money_row_calc c;
