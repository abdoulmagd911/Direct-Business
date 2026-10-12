-- QA-539 (§3.11.6, D21): "the same file" and "a newer file" no longer rest on what the browser says.
--  * The same file is the same kind, export time and rows, fingerprinted here from what was sent; the sha-256 the
--    browser gives is kept for the record only, so a wrong or missing one neither blocks a new file nor lets the same
--    one in twice.
--  * A file exported before one already imported is still read — it fills blanks, never overwrites a newer value — and
--    its answer says older_than with the newer export's time, so the screen can say so.
--  * An older file that fills a blank keeps the field's recorded time where it was newer.
-- Forward-only.

alter table finance.import_batch add column content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');
drop index finance.import_batch_once;
create unique index import_batch_once on finance.import_batch (content_sha256) where content_sha256 is not null;
comment on column finance.import_batch.content_sha256 is 'QA-539: the file''s fingerprint made by the server from its kind, export time and rows — what "the same file twice" means.';

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
  -- the file's own fingerprint, made here from what was sent: its kind, export time and rows (QA-539)
  content text := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
                    p_file || '|' || extract(epoch from p_export_time)::text || '|' || coalesce(p_rows::text, ''),
                    'UTF8')), 'hex');
  newest timestamptz;
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
  select * into prior from finance.import_batch x where x.content_sha256 = content;
  if prior.id is not null then
    return pg_catalog.jsonb_build_object('already_imported', true, 'batch_id', prior.id, 'on', prior.created_at,
                                         'by', prior.started_by, 'counts', prior.counts);
  end if;

  req := audit.begin('import', 'finance.imported',
                     pg_catalog.jsonb_build_object('file', p_file, 'rows', pg_catalog.jsonb_array_length(p_rows)));
  select pg_catalog.max(x.export_time) into newest from finance.import_batch x where x.file = p_file;
  insert into finance.import_batch (file, file_name, file_sha256, content_sha256, export_time, started_by, request_id)
  values (p_file, p_file_name, p_sha256, content, p_export_time, me, req)
  returning id into b;

  -- each expense and receipt row carries its key, numbered where the file repeats one (QA-539)
  for r in select x from pg_catalog.jsonb_array_elements(finance.keyed_rows(p_file, p_rows)) x loop
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
                case when pg_catalog.jsonb_typeof(r) = 'object' then r - '_line_key' - '_group_keys'
                     else pg_catalog.jsonb_build_object('value', r) end);
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
  -- a file exported before one already imported fills blanks only; the answer says so (QA-539, D21)
  if newest is not null and p_export_time < newest then
    answer := answer || pg_catalog.jsonb_build_object('older_than', newest);
  end if;
  perform audit.end();
  if p_dry_run then
    raise exception using errcode = 'P0001', message = 'finance.import_dry_run', detail = answer::text;
  end if;
  return answer;
end
$$;

create or replace function finance.merge_fields(p_old jsonb, p_new jsonb, p_src jsonb, p_time timestamptz)
returns table (fields jsonb, src jsonb, kept jsonb)
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
  nv jsonb;
  ov jsonb;
  took jsonb := '{}'::jsonb;
  left_alone jsonb := '{}'::jsonb;
  s jsonb := coalesce(p_src, '{}'::jsonb);
begin
  for k, nv in select e.key, e.value from pg_catalog.jsonb_each(p_new) e loop
    continue when nv is null or nv = 'null'::jsonb;
    ov := p_old -> k;
    continue when ov = nv;
    if s ->> k = 'person' then
      left_alone := left_alone || pg_catalog.jsonb_build_object(k, nv);
    elsif ov is null or ov = 'null'::jsonb or p_time > coalesce((s ->> k)::timestamptz, '-infinity'::timestamptz) then
      took := took || pg_catalog.jsonb_build_object(k, nv);
      -- an older file that fills a blank never lowers the field's time (QA-539)
      s := s || pg_catalog.jsonb_build_object(k, greatest(p_time, coalesce((s ->> k)::timestamptz, p_time)));
    end if;
  end loop;
  return query select took, s, left_alone;
end
$$;
