-- QA-527 (V620): a closed month never reopens. Closing is the one change with no Undo, so the guard on
-- finance.month_close refuses archiving a close (what Undo of the close would do) and deleting it, as well as any change
-- to its month or snapshot. A second close of the same month can therefore never take a new snapshot. Forward-only.

create or replace function finance.month_close_fixed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' or new.deleted_at is distinct from old.deleted_at then
    raise exception using errcode = 'P0001', message = 'finance.month_never_reopens', detail = old.month::text;
  end if;
  if new.snapshot is distinct from old.snapshot or new.month is distinct from old.month then
    raise exception using errcode = 'P0001', message = 'finance.snapshot_never_changes';
  end if;
  return new;
end
$$;

create trigger never_deleted before delete on finance.month_close for each row execute function finance.month_close_fixed();
