-- Sabotage: no-executive-directive
-- Breaks: sql:PRIO-01
-- Expect: Executive directive ranks first
-- The priority list keeps 'Executive directive' below the others (WRK-041).
select audit.begin('system', 'made up: sabotage');
update work.priority set sort = 99 where key = 'executive_directive';
select audit.end();
