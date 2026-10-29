-- Sabotage: a-shared-note-reaches-its-authors-team
-- Breaks: sql:NOTE-13
-- Expect: the author's teammate cannot read it
-- A note shared with one colleague is read as a team note too (G): the author's whole team reads it.
do $$
declare
  d text := pg_catalog.pg_get_functiondef('my.note_visible(uuid, uuid)'::regprocedure);
  rule text := 'n.visibility in (''team'', ''workspace'')';
begin
  if pg_catalog.strpos(d, rule) = 0 then
    raise exception 'the read rule is not where this sabotage expects it';
  end if;
  execute pg_catalog.replace(d, rule, 'n.visibility in (''team'', ''workspace'', ''person'')');
end
$$;
