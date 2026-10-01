-- Sabotage: finish-meeting-drops-the-points
-- Breaks: sql:NOTE-04
-- Expect: with the note's points
-- A logged meeting carries the note's title and words but not its points.
create or replace function my.note_text(n my.note) returns text
language sql stable set search_path = ''
as $$
  select pg_catalog.left(pg_catalog.concat_ws(E'\n', n.title, n.body), 20000)
$$;
