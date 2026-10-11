-- Receipts and what is owed (spec §3.6 receivable, §3.11; V415, V416, V423). The all-invoices export's receipt rows
-- come in as their own import kind, 'receipts': each a payment allocated to one invoice, written once (the same
-- receipt twice is one receipt), never onto a removed or hand-typed invoice, a removed receipt never brought back.
-- What is owed is per collectable invoice — a billing invoice, a standalone one, and a transaction not gathered into a
-- billing invoice (that one is collected on its billing invoice): due on its own due date, else the setting's days
-- after it was issued (V415, and the row says which); outstanding = its total − the receipts allocated to it (V416),
-- and nothing once Payments says it is fully paid; overdue days and an ageing bucket. Draft, void and cancelled
-- invoices, credit notes, wallet top-ups and excluded rows owe nothing here. Forward-only.

alter table finance.import_batch drop constraint import_batch_file_check;
alter table finance.import_batch add constraint import_batch_file_check check (file in ('invoices', 'expenses', 'receipts'));

-- A payment allocated to an invoice (§3.11 receipt rows): its method, amount, day, the reference at the payment method,
-- who paid and a note. receipt_key names it so a later file finds it again.
create table finance.receipt (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references finance.invoice (id),
  receipt_key text not null,
  method text check (method is null or pg_catalog.length(method) <= 120),
  amount_sar numeric(14, 2) not null check (amount_sar <> 0),
  paid_on date not null,
  ref_at_method text check (ref_at_method is null or pg_catalog.length(ref_at_method) <= 120),
  paid_by text check (paid_by is null or pg_catalog.length(paid_by) <= 200),
  note text check (note is null or pg_catalog.length(note) <= 1000),
  source text not null default 'import' check (source in ('manual', 'import')),
  src jsonb check (src is null or pg_catalog.jsonb_typeof(src) = 'object'),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index receipt_once on finance.receipt (receipt_key) where deleted_at is null;
comment on table finance.receipt is 'A payment allocated to one invoice (§3.11): what is owed is its total less these (V416).';
create function finance.receipt_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select finance.invoice_owner_of('finance.receipt', p_id) $$;
alter table finance.receipt enable row level security;
select audit.track('finance.receipt'::regclass);
select core.index_foreign_keys('finance');

-- One receipt row of the export. Its key: the invoice, then the reference at the payment method when given, else the
-- method, day and amount.
create function finance.import_receipt(p_batch uuid, p_no int, p_row jsonb, p_time timestamptz, p_imp uuid) returns text
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  ref text := finance.row_text(p_row, 'ref');
  inv finance.invoice;
  amount numeric;
  paid date;
  key text;
  cur finance.receipt;
  vals jsonb;
  m record;
  result text;
begin
  if ref is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, null, 'no_ref', p_row);
    return 'held';
  end if;
  select * into inv from finance.invoice i where i.ref = ref and i.deleted_at is null;
  if inv.id is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'no_invoice', p_row);
    return 'held';
  end if;
  if inv.source = 'manual' then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'manual_row', 'typed by a person; the import never changes it', p_row);
    return 'held';
  end if;
  begin
    amount := finance.row_text(p_row, 'amount_sar')::numeric(14, 2);
    paid := finance.row_date(p_row, 'paid_on');
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount_or_date', sqlerrm, p_row);
    return 'held';
  end;
  if amount is null or amount = 0 or paid is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount_or_date', 'a receipt needs its amount and day', p_row);
    return 'held';
  end if;
  if paid > core.riyadh_today() then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'date_in_future', paid::text, p_row);
    return 'held';
  end if;
  key := pg_catalog.concat_ws('|', ref,
           coalesce(norm.fold(finance.row_text(p_row, 'ref_at_method')),
                    pg_catalog.concat_ws('|', norm.fold(coalesce(finance.row_text(p_row, 'method'), '—')), paid, amount)));
  vals := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'method', finance.row_text(p_row, 'method'), 'amount_sar', amount, 'paid_on', paid,
    'ref_at_method', finance.row_text(p_row, 'ref_at_method'), 'paid_by', finance.row_text(p_row, 'paid_by'),
    'note', finance.row_text(p_row, 'note')));
  select * into cur from finance.receipt x where x.receipt_key = key and x.deleted_at is null;
  if cur.id is null and exists (select 1 from finance.receipt x where x.receipt_key = key and x.deleted_at is not null
                                and x.deleted_by <> p_imp) then
    -- a receipt a person removed is never brought back (V622, OA12)
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'removed_row', p_row);
    return 'held';
  end if;
  if cur.id is null then
    insert into finance.receipt (invoice_id, receipt_key, method, amount_sar, paid_on, ref_at_method, paid_by, note, source,
                                 src, created_by)
    select inv.id, key, x.method, x.amount_sar, x.paid_on, x.ref_at_method, x.paid_by, x.note, 'import',
           (select pg_catalog.jsonb_object_agg(k, p_time) from pg_catalog.jsonb_object_keys(vals) k), p_imp
    from pg_catalog.jsonb_populate_record(null::finance.receipt, vals) x;
    result := 'new';
  else
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(cur), vals, cur.src, p_time);
    if m.fields <> '{}'::jsonb then
      update finance.receipt e
      set (method, amount_sar, paid_on, ref_at_method, paid_by, note)
          = (select x.method, x.amount_sar, x.paid_on, x.ref_at_method, x.paid_by, x.note
             from pg_catalog.jsonb_populate_record(e, m.fields) x),
          src = m.src, updated_at = pg_catalog.now(), updated_by = p_imp, version = e.version + 1
      where e.id = cur.id;
      result := 'changed';
    else
      result := 'unchanged';
    end if;
  end if;
  return result;
end
$$;

-- The import door as P4-1b wrote it, now taking the receipts file too.
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
    case (case p_file when 'invoices' then finance.import_invoice(b, n, r, p_export_time, imp)
                      when 'receipts' then finance.import_receipt(b, n, r, p_export_time, imp)
                      else finance.import_expense(b, n, r, p_export_time, imp) end)
      when 'new' then c_new := c_new + 1;
      when 'changed' then c_changed := c_changed + 1;
      when 'unchanged' then c_unchanged := c_unchanged + 1;
      else c_held := c_held + 1;
    end case;
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

-- What each collectable invoice owes, as of today.
create view finance.receivable with (security_invoker = true) as
with inv as (
  select f.id as invoice_id, f.ref, f.kind, f.partner_id, f.pay_state, f.total_sar,
         coalesce(i.generated_on, i.created_on) as issued_on, i.due_on, i.month_on
  from finance.invoice_fact f
  join finance.invoice i on i.id = f.id
  where f.kind in ('billing', 'standalone', 'transaction') and f.billing_invoice_id is null
    and f.pay_state in ('paid', 'pending') and coalesce(f.total_sar, 0) > 0
    and not exists (select 1 from finance.exclusion_of(f.id) x where x.id is not null)
),
owed as (
  select v.*, coalesce((select sum(r.amount_sar) from finance.receipt r
                        where r.invoice_id = v.invoice_id and r.deleted_at is null), 0) as received,
         coalesce(v.due_on, v.issued_on + coalesce((core.setting_at('finance.collection_due_days', null, v.issued_on) #>> '{}')::int,
                                                   30)) as due_date,
         case when v.due_on is not null then 'own' else 'setting' end as due_basis
  from inv v
)
select o.invoice_id, o.ref, o.kind, o.partner_id, o.month_on, o.issued_on, o.due_date, o.due_basis, o.total_sar,
       o.received, case when o.pay_state = 'paid' then 0 else greatest(o.total_sar - o.received, 0) end as outstanding,
       case when o.pay_state <> 'paid' and o.total_sar > o.received and o.due_date < core.riyadh_today()
            then core.riyadh_today() - o.due_date else 0 end as days_overdue,
       case when o.pay_state = 'paid' or o.total_sar <= o.received then 'settled'
            when o.due_date >= core.riyadh_today() then 'not_due'
            when core.riyadh_today() - o.due_date <= 30 then 'days_1_30'
            when core.riyadh_today() - o.due_date <= 60 then 'days_31_60'
            when core.riyadh_today() - o.due_date <= 90 then 'days_61_90'
            else 'days_over_90' end as bucket
from owed o;
comment on view finance.receivable is 'V415, V416: each collectable invoice — due on its own date, else the setting''s days after issue; outstanding = total − receipts, nothing once fully paid; overdue days and ageing bucket.';

-- The receivables: each open invoice, and the totals by bucket.
create function finance.receivables(p_partner uuid default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return (
    with r as (select * from finance.receivable x where x.outstanding > 0 and (p_partner is null or x.partner_id = p_partner))
    select pg_catalog.jsonb_build_object(
      'outstanding', coalesce((select sum(r.outstanding) from r), 0),
      'buckets', coalesce((select pg_catalog.jsonb_object_agg(b.bucket, b.amount)
                           from (select r.bucket, sum(r.outstanding) as amount from r group by r.bucket) b), '{}'::jsonb),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'invoice_id', r.invoice_id, 'ref', r.ref, 'kind', r.kind, 'partner_id', r.partner_id,
                 'issued_on', r.issued_on, 'due_date', r.due_date, 'due_basis', r.due_basis, 'total_sar', r.total_sar,
                 'received', r.received, 'outstanding', r.outstanding, 'days_overdue', r.days_overdue, 'bucket', r.bucket)
                 order by r.days_overdue desc, r.due_date, r.ref) from r), '[]'::jsonb))
  );
end
$$;

create function api.finance_receivables(p_partner uuid default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.receivables(p_partner) $$;

revoke all on function finance.receivables(uuid) from public;
grant execute on function finance.receivables(uuid) to authenticated;
grant execute on function api.finance_receivables(uuid) to authenticated;
