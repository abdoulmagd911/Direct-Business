-- Sabotage: wrap-up-rewrites-the-day-it-happened
-- Breaks: sql:NOTE-05
-- Expect: keeping the day it happened
-- Carrying a capture over moves the day it happened to the day it was wrapped up.
create function my.sabotage_carry_moves_the_day() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.carried_to is distinct from old.carried_to then
    new.happened_on := core.riyadh_today();
  end if;
  return new;
end
$$;
create trigger sabotage_carry before update on my.note for each row execute function my.sabotage_carry_moves_the_day();
