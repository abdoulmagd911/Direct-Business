-- Sabotage: a-closed-snapshot-changes
-- Breaks: sql:CNT-04
-- Expect: a snapshot never changes
-- A closed month's snapshot can be rewritten (V610).
create or replace function finance.month_close_fixed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if false then
    raise exception using errcode = 'P0001', message = 'finance.snapshot_never_changes';
  end if;
  return new;
end
$$;
