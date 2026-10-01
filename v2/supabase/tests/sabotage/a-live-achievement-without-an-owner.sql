-- Sabotage: a-live-achievement-without-an-owner
-- Breaks: sql:ACH-04
-- Expect: live work always has an owner
-- An Unknown owner is allowed on live work too (V491: past work only).
create or replace function perf.achievement_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  yr int := pg_catalog.date_part('year', coalesce(new.happened_on, core.riyadh_day(new.logged_at)))::int;
  pl uuid := perf.plan_of(new.department_id, yr);
  c perf.achievement_category;
begin
  if pl is null then
    raise exception using errcode = 'P0001', message = 'achievement.no_plan', detail = yr::text;
  end if;
  select * into c from perf.achievement_category x where x.id = new.category_id;
  if c.plan_id is distinct from pl then
    select * into c from perf.achievement_category x where x.plan_id = pl and x.code = c.code and x.deleted_at is null;
    if c.id is null then
      raise exception using errcode = 'P0001', message = 'achievement.category_not_in_plan', detail = yr::text;
    end if;
    new.category_id := c.id;
  end if;
  if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) and (c.deleted_at is not null or not c.active) then
    raise exception using errcode = 'P0001', message = 'achievement.category_retired', detail = c.code;
  end if;
  new.plan_id := pl;
  if new.deal_value is not null and not c.has_deal_value then
    raise exception using errcode = 'P0001', message = 'achievement.no_deal_value', detail = c.code;
  end if;
  if false then
    raise exception using errcode = 'P0001', message = 'achievement.owner_required';
  end if;
  if new.owner_id is not null and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id)
     and not perf.person_ok(new.owner_id) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = new.owner_id::text;
  end if;
  return new;
end
$$;
