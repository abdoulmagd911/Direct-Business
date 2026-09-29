-- Sabotage: undoing-a-redo-leaves-the-original-live
-- Breaks: sql:UNDO-01
-- Expect: the original is undone again
-- Redo clears the mark of what it brought back, but undoing the redo never marks the original undone again.
create or replace function audit.undo_mark(q audit.request, p_undo uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update audit.request set undo_of = q.id where id = p_undo;
  update audit.request set undone_by = p_undo, undone_at = pg_catalog.now() where id = q.id;
  if q.kind = 'undo' and q.undo_of is not null then
    update audit.request set undone_by = null, undone_at = null where id = q.undo_of;
  end if;
end
$$;
