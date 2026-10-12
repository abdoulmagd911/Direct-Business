-- QA-532 (D21): one bad row never stops the file. Each row is imported on its own; a row the database refuses — an
-- over-long branch, ref or name, an unreadable DPIN total, lines that are not a list, a quantity or price too large, a
-- kind that conflicts — is rolled back alone and held as unreadable_row with the reason (the check or the message), and
-- every other row imports. Forward-only.

create or replace function finance.import_run(p_file text, p_rows jsonb, p_export_time timestamptz, p_file_name text,
                                   p_sha256 text, p_dry_run boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_capability('finance.import');
  imp uuid := core.import_person_id();
  b uuid;
  prior finance.import_batch;
  req uuid;
  r jsonb;
  n int := 0;
  c_new int := 0; c_changed int := 0; c_unchanged int := 0; c_held int := 0;
  answer jsonb;
begin
  if p_file not in ('invoices', 'expenses', 'receipts') then
    raise exception using errcode = 'P0001', message = 'finance.import_unknown_file', detail = p_file;
  end if;
  if pg_catalog.jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'rows';
  end if;
  if p_export_time is null or p_export_time > pg_catalog.now() + interval '1 hour' then
    raise exception using errcode = 'P0001', message = 'finance.import_export_time', detail = coalesce(p_export_time::text, '');
  end if;
  -- The same file twice changes nothing (§3.11.6).
  select * into prior from finance.import_batch x where x.file_sha256 = p_sha256;
  if prior.id is not null then
    return pg_catalog.jsonb_build_object('already_imported', true, 'batch_id', prior.id, 'on', prior.created_at,
                                         'by', prior.started_by, 'counts', prior.counts);
  end if;

  req := audit.begin('import', 'finance.imported',
                     pg_catalog.jsonb_build_object('file', p_file, 'rows', pg_catalog.jsonb_array_length(p_rows)));
  insert into finance.import_batch (file, file_name, file_sha256, export_time, started_by, request_id)
  values (p_file, p_file_name, p_sha256, p_export_time, me, req)
  returning id into b;

  for r in select x from pg_catalog.jsonb_array_elements(p_rows) x loop
    n := n + 1;
    -- one row at a time: a row the database refuses (too long, out of range, a wrong kind, not a list …) is rolled
    -- back alone and held with the reason, and the rest of the file imports (QA-532, D21)
    declare
      res text;
      why text;
      what text;
    begin
      begin
        res := case p_file when 'invoices' then finance.import_invoice(b, n, r, p_export_time, imp)
                           when 'receipts' then finance.import_receipt(b, n, r, p_export_time, imp)
                           else finance.import_expense(b, n, r, p_export_time, imp) end;
      exception when others then
        get stacked diagnostics why = message_text, what = constraint_name;
        insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
        values (b, n, case when pg_catalog.jsonb_typeof(r) = 'object' then pg_catalog.left(finance.row_text(r, 'ref'), 200) end,
                'unreadable_row', coalesce(nullif(what, ''), why),
                case when pg_catalog.jsonb_typeof(r) = 'object' then r else pg_catalog.jsonb_build_object('value', r) end);
        res := 'held';
      end;
    case res
      when 'new' then c_new := c_new + 1;
      when 'changed' then c_changed := c_changed + 1;
      when 'unchanged' then c_unchanged := c_unchanged + 1;
      else c_held := c_held + 1;
    end case;
    end;
  end loop;
  if p_file = 'invoices' then
    perform finance.import_links(b, p_rows, imp);
  end if;

  update finance.import_batch x
  set counts = pg_catalog.jsonb_build_object('read', n, 'new', c_new, 'changed', c_changed, 'unchanged', c_unchanged,
                                            'held', c_held)
  where x.id = b;
  select pg_catalog.jsonb_build_object(
           'batch_id', b, 'counts', x.counts,
           'held', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('row', h.row_no, 'ref', h.ref,
                                                                                      'reason', h.reason_key, 'detail', h.detail,
                                                                                      'written', h.written)
                                                         order by h.row_no, h.reason_key)
                             from finance.import_held h where h.batch_id = b), '[]'::jsonb))
  into answer from finance.import_batch x where x.id = b;
  perform audit.end();
  if p_dry_run then
    raise exception using errcode = 'P0001', message = 'finance.import_dry_run', detail = answer::text;
  end if;
  return answer;
end
$$;
