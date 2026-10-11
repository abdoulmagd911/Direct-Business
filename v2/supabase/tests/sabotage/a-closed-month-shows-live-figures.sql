-- Sabotage: a-closed-month-shows-live-figures
-- Breaks: sql:FCL-03
-- Expect: the closed month's revenue is its snapshot's
-- Every figure reads the units as they are now, so a closed month's tiles move with each late payment or edit
-- (QA-536, V620).
create or replace view finance.money_row with (security_invoker = true) as
select * from finance.money_row_live;
