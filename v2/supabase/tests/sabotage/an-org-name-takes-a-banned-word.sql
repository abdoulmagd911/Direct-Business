-- Sabotage: an-org-name-takes-a-banned-word
-- Breaks: sql:WORDS-01
-- Expect: the role editor refuses a banned name
-- A department, a team or a role takes any name: a banned one shows on every person's card (QA-68).
create or replace function core.name_banned() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  return new;
end
$$;
