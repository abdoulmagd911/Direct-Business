-- Sabotage: search-names-no-code
-- Breaks: sql:SRCH-05
-- Expect: the code is found by its full text
-- Search finds no discount code at all: the codes key answers empty, so a code typed in Ctrl-K never shows.
do $$
declare
  d text := pg_catalog.pg_get_functiondef('core.search(text, integer)'::regprocedure);
begin
  d := pg_catalog.replace(d, 'd0.kind = ''discount_code''', 'd0.kind = ''discount_code'' and false');
  execute d;
end
$$;
