-- Sabotage: a-table-in-public
-- Breaks: sql:GRANTS-05
-- Expect: made_up_stray
-- A migration puts a table in the public schema, where the API's reach would hang on Supabase's automatic grants.
create table public.made_up_stray (id int primary key);
