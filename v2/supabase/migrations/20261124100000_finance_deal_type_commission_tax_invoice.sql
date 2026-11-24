-- Landing 47 — Finance Part B, items A5, A7, A12 (the row's side) and A14.
--
-- A5.  Every invoice and transaction row carries a deal type — prepaid, postpaid, tender or promo — so the Ledger
--      can be sorted and filtered by it. It is worked out, never typed twice:
--        a row recorded here: the kind of the client ID the invoice itself carries; else promo when it carries a
--          discount code (the payment-type rule the money rows already follow, PAY-01); else the organisation's own
--          kind when every client ID it holds is of one kind;
--        an imported row (it carries no client ID of its own — the organisation is chosen at upload): promo when it
--          carries a code; else the organisation's own kind when every client ID it holds is of one kind.
--      A row none of that settles says "not set", and a person with Full on Finance sets it on the row, with a
--      reason, logged (finance.deal_type_set); what a person set wins. A promo-code sale and a tender are ordinary
--      rows — same revenue, cost and profit — that say what they are.
-- A12. A counted row of a postpaid deal is paid but receivable: the organisation settles it later, by hand, with the
--      Finance team. The row says so (`receivable`).
-- A14. A row that carries a DPIN has its tax invoice issued, and says so (`tax_invoice_issued`).
--      Hand edits and removals happen at the transaction's level only: the two hand doors (finance.row_edit,
--      finance.rows_remove) refuse a monthly (billing) invoice — the tax-invoice side — in words. A tax invoice
--      record was never theirs to touch. A re-import never touches a row typed by hand: the import engine writes
--      work.import_record only, and the Ledger keeps the typed row when both doors carry one document (L18); A14-01
--      pins it.
-- A7.  A commission typed by hand names which provider commission it is — airlines, provider, cashback, study
--      abroad or other — and carries its proof (finance.commission_set). Commissions never come from the payment
--      system's files: only a row recorded by hand takes a commission type.
--
-- How: finance.unified_ledger keeps its name, arguments and grants. The statement of 20261123090000 is kept whole
-- under the name finance.unified_ledger_core — so every counted figure is that statement's, word for word — and the
-- function under the old name adds the marks to its answer: on each row and each not-yet-counted row `deal_type`,
-- `deal_type_by`, `receivable`, `tax_invoice_issued`, `commission_type`; beside them `by_deal_type` (the counted
-- rows on the list, by deal type) and `can_set_deal_type`. No total is read, changed or recomputed here.
-- Forward-only (V103): no pushed migration is edited. Regression tests: DTY-01, DPN-01, CMT-01.

-- ================================================================ the three typed facts
alter table work.import_record add column deal_type text
  check (deal_type is null or deal_type in ('prepaid', 'postpaid', 'tender', 'promo'));
comment on column work.import_record.deal_type is
  'Landing 47 (A5): the deal type a person set on this row; null = worked out from its code and its organisation''s client IDs.';
alter table finance.invoice add column deal_type text
  check (deal_type is null or deal_type in ('prepaid', 'postpaid', 'tender', 'promo'));
comment on column finance.invoice.deal_type is
  'Landing 47 (A5): the deal type a person set on this invoice; null = worked out from its client ID, its code and its organisation.';
alter table finance.invoice add column commission_type text
  check (commission_type is null or commission_type in ('airlines', 'provider', 'cashback', 'study_abroad', 'other'));
alter table finance.invoice add column commission_proof text
  check (commission_proof is null or (pg_catalog.btrim(commission_proof) <> '' and pg_catalog.length(commission_proof) <= 500));
alter table finance.invoice add constraint invoice_commission_has_proof
  check ((commission_type is null) = (commission_proof is null));
comment on column finance.invoice.commission_type is
  'Landing 47 (A7): which provider commission a hand-typed commission is — airlines, provider, cashback, study abroad or other.';
comment on column finance.invoice.commission_proof is
  'Landing 47 (A7): the proof of a hand-typed commission — where the statement or the transfer is kept. Required with the type.';

-- ================================================================ the organisation's own kind
-- The kind of an organisation's client IDs when they are all of one kind; null when it holds none, or several kinds.
create function finance.partner_deal_type(p_partner uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when pg_catalog.count(distinct d.subkind) = 1 and pg_catalog.count(*) = pg_catalog.count(d.subkind)
              then pg_catalog.min(d.subkind) end
  from partner.identifier d
  where d.partner_id = p_partner and d.deleted_at is null and d.kind = 'payments_client_id'
$$;
comment on function finance.partner_deal_type(uuid) is 'Landing 47 (A5): prepaid, postpaid or tender when every client ID the organisation holds is of that one kind; else null.';

-- ================================================================ one row's deal type — the one copy of the rule
-- What a person set wins. Else, a row recorded here: the kind of the client ID its invoice carries, then promo when
-- it carries a code, then its organisation's own kind. An imported row carries no client ID of its own: promo when
-- it carries a code, then its organisation's own kind. Nothing of that: not set (null), and nothing claims it.
create function finance.deal_rule(p_set text, p_own_kind text, p_has_code boolean, p_partner_kind text,
  out deal_type text, out deal_type_by text)
language sql immutable set search_path = '' as $$
  select coalesce(p_set, p_own_kind, case when p_has_code then 'promo' end, p_partner_kind),
         case when p_set is not null then 'person'
              when p_own_kind is not null then 'client_id'
              when p_has_code then 'code'
              when p_partner_kind is not null then 'organisation' end
$$;
comment on function finance.deal_rule(text, text, boolean, text) is 'Landing 47 (A5): the deal-type rule itself — what a person set, else the invoice''s own client-ID kind, else promo for a code, else the organisation''s kind — and what decided it.';

-- The rule for one invoice recorded here.
create function finance.invoice_deal(p_invoice uuid, p_partner uuid, out deal_type text, out deal_type_by text)
language sql stable security definer set search_path = '' as $$
  select d.deal_type, d.deal_type_by
  from finance.invoice i
  left join lateral (select x.subkind from partner.identifier x
                     where x.deleted_at is null and x.kind = 'payments_client_id' and x.value_key = i.client_id_key
                     limit 1) cid on true
  cross join lateral finance.deal_rule(i.deal_type, cid.subkind, i.code_key is not null,
                                       finance.partner_deal_type(p_partner)) d
  where i.id = p_invoice
$$;
-- The rule for one imported row.
create function finance.import_deal(p_record uuid, out deal_type text, out deal_type_by text)
language sql stable security definer set search_path = '' as $$
  select d.deal_type, d.deal_type_by
  from work.import_record x
  cross join lateral finance.deal_rule(x.deal_type, null, x.attribution_promo or x.source_promo is not null,
                                       finance.partner_deal_type(x.partner_id)) d
  where x.id = p_record
$$;
comment on function finance.invoice_deal(uuid, uuid) is 'Landing 47 (A5): the deal type of an invoice recorded here and what decided it (person, client_id, code, organisation).';
comment on function finance.import_deal(uuid) is 'Landing 47 (A5): the deal type of an imported row and what decided it (person, code, organisation).';

-- ================================================================ the marks on a ledger answer
-- Set-based: the organisations' kinds are worked out once each, the rows' own facts are joined in, and the rule
-- (finance.deal_rule) is applied to each row — so the cost grows with the rows, never with rows times lookups.
create function finance.ledger_marks(p_answer jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  with listed as (
    select 'rows'::text as part, t.r, t.o from pg_catalog.jsonb_array_elements(coalesce(p_answer -> 'rows', '[]'::jsonb)) with ordinality t(r, o)
    union all
    select 'not_yet_counted', t.r, t.o from pg_catalog.jsonb_array_elements(coalesce(p_answer -> 'not_yet_counted', '[]'::jsonb)) with ordinality t(r, o)
  ),
  keyed as materialized (
    select l.part, l.r, l.o, l.r ->> 'source' as source,
           case when l.r ->> 'source' = 'manual' and (l.r ->> 'invoice_id') ~ '^[0-9a-f-]{36}$' then (l.r ->> 'invoice_id')::uuid end as invoice_id,
           nullif(l.r ->> 'source_partner_id', '')::uuid as source_partner_id,
           coalesce(l.r ->> 'number', l.r ->> 'transaction_number', l.r ->> 'invoice_number') as number,
           l.r ->> 'dpin' as dpin
    from listed l
  ),
  kinds as materialized (
    select s.partner_id, finance.partner_deal_type(s.partner_id) as kind
    from (select distinct source_partner_id as partner_id from keyed where source_partner_id is not null) s
  ),
  -- the imported rows of the organisations on the list, one per organisation and number (a transaction's row before
  -- an invoice-only row that carries the same number), so each listed row meets its own in one hashed join
  imported as materialized (
    select distinct on (x.partner_id, coalesce(x.transaction_ref, x.invoice_ref))
           x.partner_id, coalesce(x.transaction_ref, x.invoice_ref) as number,
           x.deal_type, x.attribution_promo or x.source_promo is not null as has_code, x.tax_no
    from work.import_record x
    where x.deleted_at is null and x.kind in ('transaction', 'invoice')
      and x.partner_id in (select k.partner_id from kinds k)
    order by x.partner_id, coalesce(x.transaction_ref, x.invoice_ref), x.transaction_ref nulls last
  ),
  typed as (
    select k.part, k.o, k.r, i.commission_type, d.deal_type, d.deal_type_by,
           coalesce(case when k.source = 'manual' then i.id is not null and k.dpin is not null
                         else k.dpin ~* '^\s*DPIN' or c.tax_no ~* '^\s*DPIN' end, false) as issued
    from keyed k
    left join finance.invoice i on i.id = k.invoice_id
    left join lateral (select x.subkind from partner.identifier x
                       where i.id is not null and x.deleted_at is null and x.kind = 'payments_client_id'
                         and x.value_key = i.client_id_key
                       limit 1) cid on true
    left join imported c on k.source = 'import' and c.partner_id = k.source_partner_id and c.number = k.number
    left join kinds kd on kd.partner_id = k.source_partner_id
    cross join lateral finance.deal_rule(
      case when k.source = 'manual' then i.deal_type else c.deal_type end,
      case when k.source = 'manual' then cid.subkind end,
      case when k.source = 'manual' then i.code_key is not null else coalesce(c.has_code, false) end,
      kd.kind) d
  ),
  done as (
    select t.part, t.o, t.deal_type,
           t.r || pg_catalog.jsonb_build_object(
             'deal_type', t.deal_type, 'deal_type_by', t.deal_type_by,
             'receivable', t.part = 'rows' and coalesce((t.r ->> 'counted')::boolean, true) and t.deal_type = 'postpaid',
             'tax_invoice_issued', t.issued, 'commission_type', t.commission_type) as r
    from typed t
  )
  select pg_catalog.jsonb_build_object(
    'rows', coalesce((select pg_catalog.jsonb_agg(d.r order by d.o) from done d where d.part = 'rows'), '[]'::jsonb),
    'not_yet_counted', coalesce((select pg_catalog.jsonb_agg(d.r order by d.o) from done d where d.part = 'not_yet_counted'), '[]'::jsonb),
    'by_deal_type', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'deal_type', g.deal_type, 'units', g.units, 'revenue', g.revenue, 'cost', g.cost, 'profit', g.profit,
               'without_cost', g.without_cost)
             order by case g.deal_type when 'prepaid' then 1 when 'postpaid' then 2 when 'tender' then 3 when 'promo' then 4 else 5 end)
      from (select d.deal_type, pg_catalog.count(*)::int as units,
                   coalesce(pg_catalog.sum((d.r ->> 'revenue')::numeric), 0) as revenue,
                   pg_catalog.sum((d.r ->> 'cost')::numeric) as cost,
                   pg_catalog.sum((d.r ->> 'profit')::numeric) as profit,
                   pg_catalog.count(*) filter (where (d.r ->> 'cost') is null)::int as without_cost
            from done d
            where d.part = 'rows' and coalesce((d.r ->> 'counted')::boolean, true)
            group by d.deal_type) g), '[]'::jsonb),
    'can_set_deal_type', authz.level_of(authz.me(), 'finance') >= 'full')
$$;
comment on function finance.ledger_marks(jsonb) is 'Landing 47: the marks a ledger answer gains — each row''s deal type (A5), paid-but-receivable (A12), tax invoice issued (A14), commission type (A7) — and the listed counted rows by deal type. Reads no total.';

-- ================================================================ the Ledger, with the marks
alter function finance.unified_ledger(date, date, uuid, text, text, text, text) rename to unified_ledger_core;
revoke all on function finance.unified_ledger_core(date, date, uuid, text, text, text, text) from public, authenticated;
comment on function finance.unified_ledger_core(date, date, uuid, text, text, text, text) is 'The unified Ledger as it stood before Landing 47 (20261123090000) — every counted figure — reached only through finance.unified_ledger.';

create function finance.unified_ledger(p_from date, p_to date, p_partner uuid default null, p_client_id text default null,
  p_kind text default null, p_code text default null, p_project text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  answer jsonb;
begin
  perform authz.require('finance', 'view');
  answer := finance.unified_ledger_core(p_from, p_to, p_partner, p_client_id, p_kind, p_code, p_project);
  return answer || finance.ledger_marks(answer);
end
$$;
alter function finance.unified_ledger(date, date, uuid, text, text, text, text) set jit = off;
comment on function finance.unified_ledger(date, date, uuid, text, text, text, text) is 'The unified Ledger: the statement of 20261123090000 for every figure, and (Landing 47) each row''s deal type, paid-but-receivable, tax invoice issued and commission type.';

-- ================================================================ a person sets a row's deal type
create function finance.deal_type_set(p_partner uuid, p_number text, p_type text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := authz.require('finance', 'full');
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  num text := pg_catalog.btrim(coalesce(p_number, ''));
  key text := norm.fold(pg_catalog.btrim(coalesce(p_number, '')));
  req uuid;
  n_manual int := 0;
  n_import int := 0;
begin
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if num = '' or (p_type is not null and p_type not in ('prepaid', 'postpaid', 'tender', 'promo')) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'deal_type';
  end if;
  req := audit.begin('ui', 'finance.deal_type_set', pg_catalog.jsonb_build_object('number', num, 'type', p_type), why);
  -- the row recorded here with that number, at that organisation (or at none, when none is given)
  update finance.invoice i set deal_type = p_type, updated_at = now(), updated_by = me, version = i.version + 1
    where i.deleted_at is null and norm.fold(i.ref) = key and i.kind in ('transaction', 'standalone', 'billing')
      and (select m.partner_id from finance.partner_match(i.id) m limit 1) is not distinct from p_partner
      and i.deal_type is distinct from p_type;
  get diagnostics n_manual = row_count;
  -- the imported row with that number at that organisation
  if p_partner is not null then
    update work.import_record x set deal_type = p_type, updated_at = now(), updated_by = me, version = x.version + 1
      where x.deleted_at is null and x.partner_id = p_partner and x.kind in ('transaction', 'invoice')
        and norm.fold(coalesce(x.transaction_ref, x.invoice_ref)) = key
        and x.deal_type is distinct from p_type;
    get diagnostics n_import = row_count;
  end if;
  perform audit.end();
  if n_manual + n_import = 0 and not exists (
       select 1 from finance.invoice i where i.deleted_at is null and norm.fold(i.ref) = key
         and (select m.partner_id from finance.partner_match(i.id) m limit 1) is not distinct from p_partner)
     and not exists (
       select 1 from work.import_record x where x.deleted_at is null and x.partner_id = p_partner
         and x.kind in ('transaction', 'invoice') and norm.fold(coalesce(x.transaction_ref, x.invoice_ref)) = key) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return pg_catalog.jsonb_build_object('number', num, 'deal_type', p_type, 'changed', n_manual + n_import, 'request_id', req);
end
$$;
comment on function finance.deal_type_set(uuid, text, text, text) is 'Landing 47 (A5): a person with Full on Finance sets (or, with no type, clears) the deal type of one row, by its number at its organisation, with a reason; logged.';
create function api.finance_deal_type_set(p_partner uuid, p_number text, p_type text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select finance.deal_type_set(p_partner, p_number, p_type, p_reason) $$;

-- ================================================================ a hand-typed commission names itself
create function finance.commission_set(p_invoice uuid, p_type text, p_proof text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := authz.require('finance', 'full');
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  proof text := nullif(pg_catalog.btrim(coalesce(p_proof, '')), '');
  inv finance.invoice;
  req uuid;
begin
  select * into inv from finance.invoice where id = p_invoice and deleted_at is null;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  -- commissions never come from the payment system's files: a hand-typed row only
  if inv.source <> 'manual' or inv.kind not in ('transaction', 'standalone') then
    raise exception using errcode = 'P0001', message = 'finance.commission_is_typed_by_hand', detail = inv.ref;
  end if;
  if p_type is null or p_type not in ('airlines', 'provider', 'cashback', 'study_abroad', 'other') then
    raise exception using errcode = 'P0001', message = 'finance.commission_needs_type';
  end if;
  if proof is null then
    raise exception using errcode = 'P0001', message = 'finance.commission_needs_proof';
  end if;
  if pg_catalog.length(proof) > 500 then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'proof';
  end if;
  req := audit.begin('ui', 'finance.commission_set', pg_catalog.jsonb_build_object('number', inv.ref, 'type', p_type), why);
  update finance.invoice set commission_type = p_type, commission_proof = proof,
    updated_at = now(), updated_by = me, version = version + 1 where id = inv.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('invoice_id', inv.id, 'commission_type', p_type, 'request_id', req);
end
$$;
comment on function finance.commission_set(uuid, text, text, text) is 'Landing 47 (A7): name which provider commission a hand-typed commission is, with its proof; Full on Finance, a reason, logged.';
create function api.finance_commission_set(p_invoice uuid, p_type text, p_proof text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select finance.commission_set(p_invoice, p_type, p_proof, p_reason) $$;

-- ================================================================ A14: hand edits at the transaction's level only
alter function finance.row_edit(text, uuid, jsonb, int, text) rename to row_edit_core;
alter function finance.rows_remove(text, uuid[], text) rename to rows_remove_core;
revoke all on function finance.row_edit_core(text, uuid, jsonb, int, text), finance.rows_remove_core(text, uuid[], text)
  from public, authenticated;

create function finance.row_edit(p_table text, p_id uuid, p_fields jsonb, p_version int, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform authz.require('finance', 'full');
  if p_table = 'invoice' and exists (select 1 from finance.invoice i where i.id = p_id and i.kind = 'billing') then
    raise exception using errcode = 'P0001', message = 'finance.edit_at_transaction_level',
      detail = (select i.ref from finance.invoice i where i.id = p_id);
  end if;
  return finance.row_edit_core(p_table, p_id, p_fields, p_version, p_reason);
end
$$;
create function finance.rows_remove(p_table text, p_ids uuid[], p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform authz.require('finance', 'full');
  if p_table = 'invoice' and exists (select 1 from finance.invoice i where i.id = any (p_ids) and i.kind = 'billing') then
    raise exception using errcode = 'P0001', message = 'finance.edit_at_transaction_level',
      detail = (select i.ref from finance.invoice i where i.id = any (p_ids) and i.kind = 'billing' limit 1);
  end if;
  return finance.rows_remove_core(p_table, p_ids, p_reason);
end
$$;
comment on function finance.row_edit(text, uuid, jsonb, int, text) is 'Edit one hand-kept finance row. Landing 47 (A14): at the transaction''s level only — a monthly (billing) invoice is refused; the rest is the statement kept as finance.row_edit_core.';
comment on function finance.rows_remove(text, uuid[], text) is 'Remove hand-kept finance rows. Landing 47 (A14): at the transaction''s level only — a monthly (billing) invoice is refused; the rest is the statement kept as finance.rows_remove_core.';

revoke all on function finance.partner_deal_type(uuid), finance.ledger_marks(jsonb),
  finance.invoice_deal(uuid, uuid), finance.import_deal(uuid), finance.deal_rule(text, text, boolean, text),
  finance.unified_ledger(date, date, uuid, text, text, text, text),
  finance.deal_type_set(uuid, text, text, text), api.finance_deal_type_set(uuid, text, text, text),
  finance.commission_set(uuid, text, text, text), api.finance_commission_set(uuid, text, text, text),
  finance.row_edit(text, uuid, jsonb, int, text), finance.rows_remove(text, uuid[], text) from public;
grant execute on function finance.unified_ledger(date, date, uuid, text, text, text, text) to authenticated;
grant execute on function finance.deal_type_set(uuid, text, text, text), api.finance_deal_type_set(uuid, text, text, text) to authenticated;
grant execute on function finance.commission_set(uuid, text, text, text), api.finance_commission_set(uuid, text, text, text) to authenticated;
grant execute on function finance.row_edit(text, uuid, jsonb, int, text), finance.rows_remove(text, uuid[], text) to authenticated;
