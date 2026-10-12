-- Sabotage: a-date-is-read-in-the-servers-zone
-- Breaks: sql:IMP-08
-- Expect: a time with no zone is Riyadh's clock: still 30 Sep
-- The export's text is cast by the server's zone and date style, so a late 30 Sep time on a UTC server is 1 Oct and
-- 03/04/2026 is read as 3 April or 4 March (QA-538, D20).
create or replace function finance.row_time(p_row jsonb, p_key text) returns timestamptz
language sql stable set search_path = ''
as $$ select (finance.row_text(p_row, p_key)::timestamp at time zone 'UTC') $$;
