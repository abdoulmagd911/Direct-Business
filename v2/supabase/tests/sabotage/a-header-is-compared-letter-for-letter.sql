-- Sabotage: a-header-is-compared-letter-for-letter
-- Breaks: sql:IMP-03
-- Expect: a header row is recognised by the map, spaces, signs and case ignored; an unknown column feeds nothing
-- A file's headers are compared letter for letter, so a spacing or sign change in an export breaks the import (V622 (2), section 3.11 step 1).
create or replace function finance.header_key(p_header text) returns text
language sql immutable set search_path = ''
as $$
  select pg_catalog.lower(coalesce(p_header, ''))
$$;
