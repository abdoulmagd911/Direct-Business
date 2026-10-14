-- V522: "B2C" is a banned word, beside "B2B" and "B2G" — in data as on screen; the segment stays Individuals.
-- core.banned_word gains it as the sixth entry; the words check (scripts/checks/forbidden-words.mjs) holds the same
-- data list (FORBIDDEN_IN_DATA). Forward-only (V103): the function is replaced, the migration that made it is not touched.
create or replace function core.banned_word(p text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select w.label from (values
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (1, '\mdirect[[:space:]_.-]*ksa\M', 'Direct KSA'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (2, '\mdirect[[:space:]_.-]*corporate\M', 'Direct Corporate'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (3, '\mb[[:space:]_.-]*2[[:space:]_.-]*b\M', 'B2B'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (4, '\mb[[:space:]_.-]*2[[:space:]_.-]*g\M', 'B2G'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V522)
    (5, '\mb[[:space:]_.-]*2[[:space:]_.-]*c\M', 'B2C'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (6, '\mmice\M', 'MICE')) w(n, re, label)
  where coalesce(p, '') ~* w.re
  order by w.n
  limit 1
$$;
comment on function core.banned_word(text) is 'The first banned word in data (V59, V404, V522) a text carries, or null — the words check holds the same list (FORBIDDEN_IN_DATA).';
