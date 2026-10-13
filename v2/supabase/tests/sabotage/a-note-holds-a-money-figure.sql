-- Sabotage: a-note-holds-a-money-figure
-- Breaks: sql:RLINE-01
-- Expect: a note with a money figure
-- A Note line may carry a money figure, so a note counts as an achievement would (V79).
create or replace function report.has_money(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select false and coalesce(p, '') ~* '[0-9٠-٩][0-9٠-٩,.٬٫]*[[:space:]]*(sar\M|ريال|ر[.]?[[:space:]]?س)'
         or coalesce(p, '') ~* '(\msar|ريال|ر[.]?[[:space:]]?س)[[:space:]]*[0-9٠-٩]'
$$;
