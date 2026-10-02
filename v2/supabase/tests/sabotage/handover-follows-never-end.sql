-- Sabotage: handover-follows-never-end
-- Breaks: sql:HAND-01
-- Expect: the job ends the follow
-- A hand-over follow never ends (V488).
create or replace function notify.end_handover_follows() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  k int;
begin
  delete from notify.follow where false;
  get diagnostics k = row_count;
  return k;
end
$$;
