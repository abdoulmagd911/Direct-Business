-- Sabotage: undo-leaves-the-mou-prospect
-- Breaks: sql:ACH-09
-- Expect: undone, the side has no status again
-- Undoing an MoU achievement keeps the Prospect it set (V601).
create or replace function perf.achievement_undo_prospect() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  s partner.side_status_change;
begin
  select * into s from partner.side_status_change x where x.id = new.mou_status_id and x.deleted_at is null;
  if false and s.id is not null and not exists (
       select 1 from partner.side_status_change o
       where o.partner_id = s.partner_id and o.side = s.side and o.deleted_at is null and o.id <> s.id) then
    update partner.side_status_change
    set deleted_at = pg_catalog.now(), deleted_by = authz.me(), delete_reason = 'undo'
    where id = s.id;
  end if;
  return new;
end
$$;
