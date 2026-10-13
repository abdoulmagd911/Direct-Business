-- Sabotage: undo-reopens-a-closed-month
-- Breaks: sql:FCL-01
-- Expect: Undo of a close is refused
-- The guard on a closed month watches only its month and snapshot, so Undo archives the close and the month reopens
-- (QA-527, V620).
create or replace function finance.month_close_fixed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    return old;
  end if;
  if new.snapshot is distinct from old.snapshot or new.month is distinct from old.month then
    raise exception using errcode = 'P0001', message = 'finance.snapshot_never_changes';
  end if;
  return new;
end
$$;
