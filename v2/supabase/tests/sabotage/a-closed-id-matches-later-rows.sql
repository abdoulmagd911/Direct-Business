-- Sabotage: a-closed-id-matches-later-rows
-- Breaks: sql:IDN-06
-- Expect: a row dated after the close date no longer matches
-- A closed client ID keeps matching rows dated after its close date (V411).
create or replace function partner.money_match(i partner.identifier, p_day date) returns text
language sql stable set search_path = ''
as $$
  select case when i.deleted_at is not null then null
              when i.kind = 'discount_code'
                   and not pg_catalog.daterange(i.valid_from, i.valid_to, '[]') @> p_day then null
              when i.kind = 'name' and i.subkind is distinct from 'alias' then 'suggest'
              else 'match' end
$$;
