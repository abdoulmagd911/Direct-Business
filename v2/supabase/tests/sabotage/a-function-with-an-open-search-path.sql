-- Sabotage: a-function-with-an-open-search-path
-- Breaks: sql:SEC-01
-- Expect: core.month_of(d date)
-- A function forgets `set search_path`, so objects on the caller's path could shadow the ones it means.
alter function core.month_of(date) reset search_path;
