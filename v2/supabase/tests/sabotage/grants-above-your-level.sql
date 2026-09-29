-- Sabotage: grants-above-your-level
-- Breaks: sql:ACC-05
-- Expect: a head at View on Finance cannot give Full
-- A level is given whatever the giver's own level on that page.
create or replace function core.access_not_above(p_me uuid, p_page text, p_level core.level) returns void
language plpgsql stable security definer set search_path = ''
as $$ begin end $$;
