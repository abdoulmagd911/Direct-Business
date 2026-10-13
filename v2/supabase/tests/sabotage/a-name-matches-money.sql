-- Sabotage: a-name-matches-money
-- Breaks: sql:IDN-06
-- Expect: an official name only suggests
-- An official or trade name applies a money match instead of only suggesting one (V421).
create or replace function partner.money_match(i partner.identifier, p_day date) returns text
language sql stable set search_path = ''
as $$
  select case when i.deleted_at is not null then null
              when i.closed_on is not null and p_day > i.closed_on then null
              when i.kind = 'discount_code'
                   and not pg_catalog.daterange(i.valid_from, i.valid_to, '[]') @> p_day then null
              else 'match' end
$$;
