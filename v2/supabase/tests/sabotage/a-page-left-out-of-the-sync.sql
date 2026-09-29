-- Sabotage: a-page-left-out-of-the-sync
-- Breaks: sql:REG-01
-- Expect: the pages are the registry's
-- A page the registry declares never reaches the database (the old app's unreachable finance page).
update core.page set active = false where key = 'finance';
