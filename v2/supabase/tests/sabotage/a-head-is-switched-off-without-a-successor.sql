-- Sabotage: a-head-is-switched-off-without-a-successor
-- Breaks: sql:LEAVE-02
-- Expect: head is not switched off
-- A department's head is switched off before a new head is chosen (V463, OLD-005).
create or replace function core.person_keep_work() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  today date := core.riyadh_today();
  d core.department;
  w jsonb;
begin
  if new.kind <> 'staff' then
    return new;
  end if;
  if not ((old.can_sign_in and not new.can_sign_in) or (old.active and not new.active)
          or (old.deleted_at is null and new.deleted_at is not null)
          or coalesce(new.left_on <= today and (old.left_on is null or old.left_on > today), false)) then
    return new;
  end if;
  select * into d from core.department x where x.head_person_id = new.id and x.deleted_at is null and x.active
  order by x.name_en limit 1;
  w := core.open_work(new.id);
  if core.open_work_count(w) > 0 then
    raise exception using errcode = 'P0001', message = 'person.open_work', detail = w::text;
  end if;
  return new;
end
$$;
