-- Sabotage: keep-mine-is-asked-again
-- Breaks: sql:ROW-02
-- Expect: the kept amount is not listed again for the same value
-- A difference the person kept theirs against is listed again by the next file with the same value (V622).
create or replace function finance.note_differences(p_table text, p_row uuid, p_invoice uuid, p_kept jsonb, p_time timestamptz,
                                         p_batch uuid, p_imp uuid) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  f text;
  v jsonb;
  d finance.import_difference;
  n int := 0;
begin
  for f, v in
    select finance.field_of(e.key), pg_catalog.jsonb_object_agg(e.key, e.value)
    from pg_catalog.jsonb_each(coalesce(p_kept, '{}'::jsonb)) e
    group by 1
  loop
    select * into d from finance.import_difference x
    where x.row_table = p_table and x.row_id = p_row and x.field = f and x.deleted_at is null
    order by (x.state = 'open') desc, x.import_time desc
    limit 1;
    if d.id is not null and d.state = 'open' then
      if p_time > d.import_time and d.import_value is distinct from v then
        update finance.import_difference x
        set import_value = v, import_time = p_time, batch_id = p_batch,
            updated_at = pg_catalog.now(), updated_by = p_imp, version = x.version + 1
        where x.id = d.id;
      end if;
    elsif false then
      continue;
    else
      insert into finance.import_difference (invoice_id, row_table, row_id, field, import_value, import_time, batch_id,
                                             created_by)
      values (p_invoice, p_table, p_row, f, v, p_time, p_batch, p_imp);
      n := n + 1;
    end if;
  end loop;
  return n;
end
$$;
