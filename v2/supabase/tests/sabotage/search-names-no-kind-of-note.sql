-- Sabotage: search-names-no-kind-of-note
-- Breaks: sql:SRCH-02
-- Expect: each says what it was captured as
-- Search finds the notes but calls every one a plain note, so an idea or a reminder cannot be told apart (V641 (3)).
do $$
declare
  d text := pg_catalog.pg_get_functiondef('core.search(text, integer)'::regprocedure);
begin
  d := pg_catalog.replace(d, 'when n.idea then ''idea''', 'when false then ''idea''');
  execute d;
end
$$;
