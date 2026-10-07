-- Sabotage: use-import-leaves-the-field-the-persons
-- Breaks: sql:ROW-02
-- Expect: Use import writes the file's value and gives the field back to the imports
-- Use import writes the file's value but leaves the field marked as the person's, so later files never reach it (V622).
create or replace function finance.difference_decide(p_id uuid, p_choice text, p_version int, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  d finance.import_difference;
  cols text;
  times jsonb;
  req uuid;
begin
  if p_choice not in ('keep_mine', 'use_import') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'choice';
  end if;
  select * into d from finance.import_difference x where x.id = p_id and x.deleted_at is null for update;
  if d.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if d.state <> 'open' then
    raise exception using errcode = 'P0001', message = 'finance.difference_decided', detail = d.state;
  end if;
  perform core.check_version('finance.import_difference', p_id, p_version, array['state']);
  req := audit.begin('ui', 'finance.difference_decided',
                     pg_catalog.jsonb_build_object('choice', p_choice, 'field', d.field, 'table', d.row_table), p_reason);
  if p_choice = 'use_import' then
    select pg_catalog.string_agg(pg_catalog.quote_ident(k), ', ' order by k),
           pg_catalog.jsonb_object_agg(k, 'person')
    into cols, times
    from pg_catalog.jsonb_object_keys(d.import_value) k;
    execute pg_catalog.format(
      'update %1$s x set (%2$s) = (select %2$s from pg_catalog.jsonb_populate_record(x, $1)), '
      'src = coalesce(x.src, ''{}''::jsonb) || $2, updated_at = pg_catalog.now(), updated_by = $3, version = x.version + 1 '
      'where x.id = $4 and x.deleted_at is null', pg_catalog.to_regclass('finance.' || d.row_table), cols)
      using d.import_value, times, me, d.row_id;
  end if;
  update finance.import_difference x
  set state = case p_choice when 'keep_mine' then 'kept_mine' else 'used_import' end,
      decided_at = pg_catalog.now(), decided_by = me,
      updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;
