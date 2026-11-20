-- Landing 32 (Finance F-B), part A2 — who counts and who does not, decided in one place for both stores.
--
-- What was there: finance.exclusion_rule (D16) — the Finance exclusion list, by client ID, name, VAT/CR, discount
-- code, invoice, product and partner — with admin doors and no screen, consulted only for the rows recorded here
-- (finance.exclusion_of → money_row). The imported rows (work.import_record, read at read time) were never asked.
-- So an excluded client's imported invoices still counted.
--
-- What this adds, forward-only:
--   1. A rule may be for ONE row of ONE organisation (partner_id): the Admin's Exclude on a ledger row. The row
--      stays, is listed apart as not counted with its reason, and Include takes the rule away again (logged). No
--      record is ever removed.
--   2. finance.merge_rule — the merge list: a client ID, or a discount code, counted under a named organisation.
--      Only what is named is merged. A code merged into an organisation leaves the promo pool.
--   3. finance.import_exclusion / finance.import_unit — the imported money rows with the lists applied, read by
--      every Finance read, so the Overview and the Ledger can never disagree about who counts.
--   4. The three Overview reads (money_month, period_figures, money_service_row) read finance.import_unit.
--      Finding 9 (Landing 32): their guard against a document that came through both doors matched on the number
--      alone, so a transaction recorded here and an imported standalone invoice that only share a number were
--      counted once on the Overview and twice in the Ledger. The guard now matches the document — organisation,
--      kind and number — as the Ledger's own dedup does (FND-09).
--   5. The doors: exclude / include one row; the merge list; the rules list counting imported rows too; the
--      "Is it counted?" table by month; what an import for an organisation would meet on the lists.
--
-- This is the Finance list, NOT partner.identifier_block: that table only gates adding an identifier to an
-- organisation and is read by no money read. NO VALUE IS SEEDED HERE: the owner types the lists in Settings.
--
-- finance.unified_ledger itself (the Counted? column, the merges, A4 and A5) is redefined in 20261119110000.

-- ================================================================ 1. a rule for one row of one organisation
alter table finance.exclusion_rule add column partner_id uuid references partner.partner (id);
comment on column finance.exclusion_rule.partner_id is
  'Landing 32: set on a rule made by Exclude on one ledger row (kind invoice) — it catches that number at that organisation only. Null on a list rule.';
drop index finance.exclusion_rule_once;
create unique index exclusion_rule_once on finance.exclusion_rule
  (kind, value_key, coalesce(partner_id, '00000000-0000-0000-0000-000000000000'::uuid)) where deleted_at is null;
create index exclusion_rule_partner on finance.exclusion_rule (partner_id);

-- The first live rule catching an invoice recorded here, read live. A row rule catches its organisation only.
create or replace function finance.exclusion_of(p_invoice uuid) returns finance.exclusion_rule
language sql stable security definer set search_path = ''
as $$
  select r.* from finance.exclusion_rule r
  join finance.invoice i on i.id = p_invoice
  left join lateral finance.partner_match(i.id) m on true
  where r.deleted_at is null
    and (r.partner_id is null or r.partner_id = m.partner_id)
    and case r.kind
          when 'client_id' then i.client_id_key = r.value_key
          when 'tax_no' then i.tax_key = r.value_key
                             or exists (select 1 from partner.identifier d where d.deleted_at is null and d.kind in ('vat', 'cr')
                                        and d.value_key = r.value_key and d.partner_id = m.partner_id)
          when 'discount_code' then i.code_key = r.value_key
          when 'invoice' then norm.fold(i.ref) = r.value_key
          when 'product' then norm.fold(i.product_raw) = r.value_key
                              or exists (select 1 from finance.invoice_line l where l.invoice_id = i.id and l.deleted_at is null
                                         and norm.fold(l.product_raw) = r.value_key)
          when 'name' then i.client_id_key is null and (i.name_key = r.value_key or i.name2_key = r.value_key)
          when 'partner' then m.partner_id is not null
                              and r.value_key = norm.fold((select p.number from partner.partner p where p.id = m.partner_id))
          else false end
  order by case r.mode when 'hide' then 0 else 1 end, r.created_at
  limit 1
$$;

-- ================================================================ 2. the merge list
create table finance.merge_rule (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('client_id', 'discount_code')),
  value_raw text not null check (pg_catalog.btrim(value_raw) <> '' and pg_catalog.length(value_raw) <= 300),
  value_key text not null,
  partner_id uuid not null references partner.partner (id),
  reason text not null check (pg_catalog.btrim(reason) <> '' and pg_catalog.length(reason) <= 500),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index merge_rule_once on finance.merge_rule (kind, value_key) where deleted_at is null;
create index merge_rule_partner on finance.merge_rule (partner_id);
create index merge_rule_created_by on finance.merge_rule (created_by);
comment on table finance.merge_rule is
  'Landing 32: the merge list — a client ID or a discount code counted under a named organisation. Only what is named is merged; a merged code leaves the promo pool. Typed by the owner in Settings, never seeded.';

create function finance.merge_key() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.value_key := case new.kind
                     when 'client_id' then norm.digits_key(new.value_raw, true)
                     when 'discount_code' then norm.code_key(new.value_raw) end;
  if new.value_key is null or new.value_key = '' then
    raise exception using errcode = 'P0001', message = 'finance.exclusion_value_empty';
  end if;
  return new;
end
$$;
create trigger key before insert or update of kind, value_raw on finance.merge_rule
  for each row execute function finance.merge_key();
alter table finance.merge_rule enable row level security;
select audit.track('finance.merge_rule'::regclass);

-- ================================================================ 3. the imported rows with the lists applied
-- The rule that catches an imported row, if any (the first: hide before exclude, then the oldest).
--   client ID  — the row carries no client ID of its own (the organisation is chosen at upload), so the rule
--                catches the rows of the organisation holding that ID — and only when every client ID that
--                organisation holds is on the list. An organisation holding an excluded ID and a kept one keeps
--                its imported rows: what was typed is excluded, nothing is guessed.
--   name       — only where the organisation holds no client ID (V412).
--   VAT / CR   — the organisation holding it (V413).
--   code       — the row's own code text.
--   invoice    — the row's transaction or invoice number; a row rule only its organisation's, and only the row
--                whose own number it is (a transaction by its transaction number, an invoice-only row by its
--                invoice number).
create view finance.import_exclusion with (security_invoker = true) as
with rule as (
  select x.* from finance.exclusion_rule x where x.deleted_at is null
),
-- the organisations a rule catches whole (worked out once per rule, not once per row)
caught_partner as (
  select x.id as rule_id, d.partner_id
  from rule x join partner.identifier d on d.deleted_at is null and d.kind = 'payments_client_id' and d.value_key = x.value_key
  where x.kind = 'client_id'
    and not exists (select 1 from partner.identifier d2 where d2.deleted_at is null
                    and d2.kind = 'payments_client_id' and d2.partner_id = d.partner_id
                    and not exists (select 1 from rule x2 where x2.kind = 'client_id' and x2.value_key = d2.value_key))
  union all
  select x.id, d.partner_id
  from rule x join partner.identifier d on d.deleted_at is null and d.kind in ('vat', 'cr') and d.value_key = x.value_key
  where x.kind = 'tax_no'
  union all
  select x.id, p.id
  from rule x join partner.partner p
    on x.value_key in (norm.name_key(p.trade_name_en, partner.stop_words()), norm.name_key(p.trade_name_ar, partner.stop_words()))
  where x.kind = 'name'
    and not exists (select 1 from partner.identifier d where d.deleted_at is null and d.kind = 'payments_client_id'
                    and d.partner_id = p.id)
  union all
  select x.id, p.id
  from rule x join partner.partner p on norm.fold(p.number) = x.value_key
  where x.kind = 'partner'
),
hit as (
  select r.id as record_id, c.rule_id
  from caught_partner c join work.import_record r on r.partner_id = c.partner_id
  union all
  select r.id, x.id
  from rule x join work.import_record r on r.source_promo is not null and norm.code_key(r.source_promo) = x.value_key
  where x.kind = 'discount_code'
  union all
  select r.id, x.id
  from rule x join work.import_record r
    on case when x.partner_id is null
            then norm.fold(r.transaction_ref) = x.value_key or norm.fold(r.invoice_ref) = x.value_key
            else x.partner_id = r.partner_id
                 and norm.fold(coalesce(r.transaction_ref, r.invoice_ref)) = x.value_key end
  where x.kind = 'invoice'
  union all
  select r.id, x.id
  from rule x join work.import_record r on norm.fold(r.product) = x.value_key
  where x.kind = 'product'
)
select distinct on (r.id) r.id as record_id, x.id as rule_id, x.kind, x.mode, x.reason, x.value_raw,
       x.partner_id is not null as row_level, x.version as rule_version
from hit h
join work.import_record r on r.id = h.record_id and r.deleted_at is null and r.kind in ('transaction', 'invoice')
join rule x on x.id = h.rule_id
order by r.id, case x.mode when 'hide' then 0 else 1 end, x.created_at;
comment on view finance.import_exclusion is
  'Landing 32: the exclusion rule that catches each imported money row, if any — the lists applied to the import store, read live.';

-- One row per imported money row (a transaction or an invoice with a revenue; an invoice-only row is not here
-- when its transactions are): the rule that catches it, the organisation it counts under after the merge list,
-- and whether it is still in the promo pool. Paid or not — a read asks for fully_paid itself.
--   A merged code   — the row counts under the code's organisation and leaves the promo pool.
--   A merged client — the rows of the organisation holding that client ID count under the named organisation,
--                     and only when every client ID it holds is merged into that same organisation.
create view finance.import_unit with (security_invoker = true) as
select r.id, r.partner_id, r.batch_id, r.kind, r.transaction_ref, r.invoice_ref, r.tax_no, r.record_date,
       r.amount_sar, r.revenue_sar, r.cost_sar, r.profit_sar, r.promo_discount_sar, r.source_promo,
       r.attribution_promo, r.missing_transaction, r.missing_invoice, r.cost_pending, r.provisional,
       r.fully_paid, r.status_text, r.direct_url,
       case when r.kind = 'transaction' then 'transaction'
            when r.transaction_ref is not null then 'transaction'
            else 'standalone' end as mapped_kind,
       coalesce(r.transaction_ref, r.invoice_ref) as number,
       e.rule_id, e.kind as excluded_by, e.reason as excluded_reason, e.mode as excluded_mode,
       coalesce(e.row_level, false) as excluded_row_level,
       coalesce(mc.partner_id, mp.partner_id, r.partner_id) as eff_partner_id,
       case when mc.partner_id is not null then 'discount_code'
            when mp.partner_id is not null then 'client_id' end as merged_by,
       (r.attribution_promo and mc.partner_id is null) as promo_pool
from work.import_record r
left join finance.import_exclusion e on e.record_id = r.id
left join lateral (
  select m.partner_id from finance.merge_rule m
  where m.deleted_at is null and m.kind = 'discount_code'
    and r.source_promo is not null and m.value_key = norm.code_key(r.source_promo)
  limit 1) mc on true
left join lateral (
  select m.partner_id from finance.merge_rule m
  join partner.identifier d on d.deleted_at is null and d.kind = 'payments_client_id'
   and d.partner_id = r.partner_id and d.value_key = m.value_key
  where m.deleted_at is null and m.kind = 'client_id'
    and not exists (select 1 from partner.identifier d2 where d2.deleted_at is null
                    and d2.kind = 'payments_client_id' and d2.partner_id = r.partner_id
                    and not exists (select 1 from finance.merge_rule m2 where m2.deleted_at is null
                                    and m2.kind = 'client_id' and m2.value_key = d2.value_key
                                    and m2.partner_id = m.partner_id))
  limit 1) mp on true
where r.deleted_at is null and r.kind in ('transaction', 'invoice') and r.revenue_sar is not null
  and not (r.kind = 'invoice' and r.transaction_ref is null and exists (
        select 1 from work.import_record t where t.deleted_at is null and t.partner_id = r.partner_id
          and t.transaction_ref is not null and t.invoice_ref = r.invoice_ref));
comment on view finance.import_unit is
  'Landing 32: the imported money rows as every Finance read sees them — with the exclusion list (excluded_by, excluded_reason), the merge list (eff_partner_id, merged_by) and the promo pool (promo_pool) applied, read live.';

-- ================================================================ 4. the Overview reads the same population
-- A row counts on the Overview when it is fully paid, no rule catches it, it is not in the promo pool, and it
-- is not the same document as a unit recorded here. "The same document" is organisation + kind + number —
-- the Ledger's own dedup key — and a unit recorded here that a rule excludes still stands for its document.
create or replace view finance.money_month with (security_invoker = true) as
with import_base as (
  select r.id, r.record_date, r.revenue_sar, r.cost_sar, r.profit_sar
  from finance.import_unit r
  where r.fully_paid and r.excluded_by is null and not r.promo_pool
    and r.record_date is not null
    and not exists (select 1 from finance.money_row m where (m.counted or m.excluded_by is not null)
                    and m.partner_id = r.partner_id and m.unit_kind = r.mapped_kind and m.ref = r.number)
),
r as (
  select x.month_on, x.revenue, x.cost, x.profit, x.provisional, x.loss
  from finance.money_row x where x.counted
  union all
  select pg_catalog.date_trunc('month', i.record_date::timestamp)::date as month_on,
         i.revenue_sar as revenue, i.cost_sar as cost, i.profit_sar as profit,
         (i.cost_sar is null) as provisional, (i.profit_sar < 0) as loss
  from import_base i
)
select r.month_on, count(*)::int as units, sum(r.revenue) as revenue,
       coalesce(sum(r.cost) filter (where not r.provisional), 0) as cost,
       coalesce(sum(r.profit) filter (where not r.provisional), 0) as profit,
       count(*) filter (where r.provisional)::int as provisional_units,
       coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
       coalesce(sum(r.profit) filter (where r.provisional), 0) as provisional_profit,
       count(*) filter (where r.loss)::int as losses
from r
group by r.month_on;

create or replace function finance.period_figures(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with import_base as (
      select r.id, r.record_date, r.revenue_sar, r.cost_sar, r.profit_sar
      from finance.import_unit r
      where r.fully_paid and r.excluded_by is null and not r.promo_pool
        and r.record_date between p_from and p_to
        and not exists (select 1 from finance.money_row m where (m.counted or m.excluded_by is not null)
                        and m.partner_id = r.partner_id and m.unit_kind = r.mapped_kind and m.ref = r.number)
    ),
    r as (
      select x.month_on, x.revenue, x.cost, x.profit, x.provisional, x.loss, x.estimate
      from finance.money_row x where x.counted and x.created_on between p_from and p_to
      union all
      select pg_catalog.date_trunc('month', i.record_date::timestamp)::date as month_on,
             i.revenue_sar as revenue, i.cost_sar as cost, i.profit_sar as profit,
             (i.cost_sar is null) as provisional, (i.profit_sar < 0) as loss, null::numeric as estimate
      from import_base i
    ),
    months as (
      select r.month_on, count(*)::int as units, sum(r.revenue) as revenue,
             coalesce(sum(r.cost) filter (where not r.provisional), 0) as cost,
             coalesce(sum(r.profit) filter (where not r.provisional), 0) as profit,
             count(*) filter (where r.provisional)::int as provisional_units,
             coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
             coalesce(sum(r.profit) filter (where r.provisional), 0) as provisional_profit,
             count(*) filter (where r.loss)::int as losses
      from r group by r.month_on
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'units', (select pg_catalog.count(*) from r),
      'revenue', (select coalesce(sum(r.revenue), 0) from r),
      'cost', (select coalesce(sum(r.cost) filter (where not r.provisional), 0) from r),
      'profit', (select coalesce(sum(r.profit) filter (where not r.provisional), 0) from r),
      'provisional', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from r where r.provisional),
        'revenue', (select coalesce(sum(r.revenue), 0) from r where r.provisional),
        'cost', (select case when pg_catalog.count(*) filter (where r.provisional) = 0 then 0::numeric
                             else null::numeric end from r),
        'profit', (select coalesce(sum(r.profit), 0) from r where r.provisional)),
      'losses', (select pg_catalog.count(*) from r where r.loss),
      'estimate', (select sum(r.estimate) from r where r.estimate is not null),
      'estimated_units', (select pg_catalog.count(*) from r where r.estimate is not null),
      'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.month_on)
                          from months m), '[]'::jsonb))
  );
end
$$;
-- CREATE OR REPLACE drops a function's settings: the Overview read keeps jit = off (L27, JIT-03).
alter function finance.period_figures(date, date) set jit = off;

create or replace view finance.money_service_row with (security_invoker = true) as
with u as (
  select r.invoice_id, r.unit_kind, r.ref, r.month_on, r.revenue, r.cost, r.provisional
  from finance.money_row r where r.counted
  union all
  select i.id as invoice_id, i.mapped_kind as unit_kind, i.number as ref,
         pg_catalog.date_trunc('month', i.record_date::timestamp)::date as month_on,
         i.revenue_sar as revenue, i.cost_sar as cost, (i.cost_sar is null) as provisional
  from finance.import_unit i
  where i.fully_paid and i.excluded_by is null and not i.promo_pool
    and i.record_date is not null
    and not exists (select 1 from finance.money_row m where (m.counted or m.excluded_by is not null)
                    and m.partner_id = i.partner_id and m.unit_kind = i.mapped_kind and m.ref = i.number)
),
lines as (
  select u.invoice_id, u.unit_kind,
         case when x.service_id is null then 'no_service' when x.counts_as_income then 'service' else 'not_income' end
           as part,
         x.service_id, x.total_sar
  from u join finance.line_service x on x.invoice_id = u.invoice_id and not x.wallet
  where u.unit_kind <> 'monthly_fee'
),
parts as (
  select l.invoice_id, l.unit_kind, l.part, l.service_id, sum(l.total_sar) as revenue
  from lines l group by l.invoice_id, l.unit_kind, l.part, l.service_id
  union all
  select u.invoice_id, u.unit_kind, 'not_split', null,
         u.revenue - coalesce((select sum(l.total_sar) from lines l
                               where l.invoice_id = u.invoice_id and l.unit_kind = u.unit_kind), 0)
  from u
),
shared as (
  select p.*, u.ref, u.month_on, u.provisional, u.cost as unit_cost, u.revenue as unit_revenue,
         pg_catalog.round(u.cost * case when u.revenue = 0 then 0 else p.revenue / u.revenue end, 2) as cost_part,
         pg_catalog.row_number() over (partition by p.invoice_id, p.unit_kind
                                       order by pg_catalog.abs(p.revenue) desc, p.part, p.service_id) as k
  from parts p join u on u.invoice_id = p.invoice_id and u.unit_kind = p.unit_kind
  where p.part <> 'not_split' or p.revenue <> 0 or not exists (
    select 1 from lines l where l.invoice_id = p.invoice_id and l.unit_kind = p.unit_kind)
)
select s.invoice_id, s.unit_kind, s.ref, s.month_on, s.provisional, s.part, s.service_id, s.revenue,
       s.cost_part + case when s.k = 1 then s.unit_cost - sum(s.cost_part) over (partition by s.invoice_id, s.unit_kind)
                          else 0 end as cost
from shared s;

-- ================================================================ 5. the doors
-- ---- Exclude / Include one ledger row (Admin only, reason required, logged). The row is named by the
-- organisation it is recorded under and its own number (a transaction's transaction number, else the invoice
-- number). Excluding writes a row rule; including takes that rule away. A row a LIST rule catches cannot be
-- included here — the list is changed in Settings — and the door says so.
create function finance.row_exclude(p_partner uuid, p_number text, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  num text := pg_catalog.btrim(coalesce(p_number, ''));
  key text := norm.fold(pg_catalog.btrim(coalesce(p_number, '')));
  req uuid;
  rid uuid;
begin
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if p_partner is null or num = '' then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'row';
  end if;
  -- the row must be there: a unit recorded here or an imported money row of that organisation, by its own number
  if not exists (select 1 from finance.money_row_live m where m.partner_id = p_partner and norm.fold(m.ref) = key)
     and not exists (select 1 from finance.import_unit u where u.partner_id = p_partner and norm.fold(u.number) = key) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  begin
    req := audit.begin('ui', 'finance.row_excluded', pg_catalog.jsonb_build_object('number', num), why);
    insert into finance.exclusion_rule (kind, value_raw, mode, reason, partner_id, created_by)
    values ('invoice', num, 'exclude', why, p_partner, me)
    returning id into rid;
    perform audit.end();
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.row_already_excluded', detail = num;
  end;
  return pg_catalog.jsonb_build_object('id', rid, 'number', num, 'request_id', req);
end
$$;
comment on function finance.row_exclude(uuid, text, text) is
  'Landing 32: the Admin takes one ledger row out of the totals, with a reason; the row stays, listed apart as not counted. Logged.';

create function finance.row_include(p_partner uuid, p_number text, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  num text := pg_catalog.btrim(coalesce(p_number, ''));
  key text := norm.fold(pg_catalog.btrim(coalesce(p_number, '')));
  cur finance.exclusion_rule;
  req uuid;
begin
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if p_partner is null or num = '' then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'row';
  end if;
  select * into cur from finance.exclusion_rule x
  where x.deleted_at is null and x.kind = 'invoice' and x.partner_id = p_partner and x.value_key = key
  for update;
  if cur.id is null then
    -- not excluded by hand: either a list rule catches it (changed in Settings), or it is not excluded at all
    if exists (select 1 from finance.import_unit u where u.partner_id = p_partner and norm.fold(u.number) = key
               and u.excluded_by is not null)
       or exists (select 1 from finance.money_row_live m where m.partner_id = p_partner and norm.fold(m.ref) = key
                  and m.excluded_by is not null) then
      raise exception using errcode = 'P0001', message = 'finance.row_excluded_by_list', detail = num;
    end if;
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'finance.row_included', pg_catalog.jsonb_build_object('number', cur.value_raw), why);
  update finance.exclusion_rule x set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = why
  where x.id = cur.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'number', cur.value_raw, 'request_id', req);
end
$$;
comment on function finance.row_include(uuid, text, text) is
  'Landing 32: the Admin puts a row excluded by hand back into the totals, with a reason. Logged. A row a list rule catches is changed in Settings.';

-- ---- The exclusion list, with what each rule catches now in BOTH stores (rows and riyals). Row rules (made by
-- Exclude on a ledger row) are listed too, marked, so the Admin sees every exclusion in one place.
create or replace function finance.exclusion_rules() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require_admin();
  return coalesce((
    -- the imported rows are read once (materialized), then grouped by the rule that catches each
    with caught as materialized (
      select u.rule_id, u.revenue_sar from finance.import_unit u where u.rule_id is not null and u.fully_paid
    )
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', r.id, 'kind', r.kind, 'value', r.value_raw, 'mode', r.mode, 'reason', r.reason,
             'version', r.version, 'created_at', r.created_at, 'created_by', r.created_by,
             'partner_id', r.partner_id, 'row_level', r.partner_id is not null,
             'rows', coalesce(c.n, 0) + coalesce(i.n, 0),
             'amount_sar', coalesce(c.amount, 0) + coalesce(i.amount, 0),
             'imported_rows', coalesce(i.n, 0), 'imported_amount_sar', coalesce(i.amount, 0))
           order by (r.partner_id is not null), r.mode, r.kind, r.value_raw)
    from finance.exclusion_rule r
    left join (select (finance.exclusion_of(v.id)).id as rule_id, pg_catalog.count(*) as n,
                      sum(coalesce(v.total_sar, 0)) as amount
               from finance.invoice v where v.deleted_at is null
               group by 1) c on c.rule_id = r.id
    left join (select u.rule_id, pg_catalog.count(*) as n, sum(coalesce(u.revenue_sar, 0)) as amount
               from caught u group by 1) i on i.rule_id = r.id
    where r.deleted_at is null), '[]'::jsonb);
end
$$;

-- ---- The merge list.
create function finance.merge_rules() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require_admin();
  return coalesce((
    -- the merged imported rows are read once (materialized), then matched to the rule that merged each
    with merged as materialized (
      select u.partner_id, u.eff_partner_id, u.merged_by, u.revenue_sar,
             case when u.merged_by = 'discount_code' then norm.code_key(u.source_promo) end as code_key
      from finance.import_unit u
      where u.merged_by is not null and u.fully_paid and u.excluded_by is null
    )
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', r.id, 'kind', r.kind, 'value', r.value_raw, 'partner_id', r.partner_id,
             'partner_number', p.number, 'trade_name_en', p.trade_name_en, 'trade_name_ar', p.trade_name_ar,
             'reason', r.reason, 'version', r.version, 'created_at', r.created_at, 'created_by', r.created_by,
             'rows', coalesce(i.n, 0), 'amount_sar', coalesce(i.amount, 0))
           order by p.trade_name_en nulls last, r.kind, r.value_raw)
    from finance.merge_rule r
    join partner.partner p on p.id = r.partner_id
    left join (select m.id as rule_id, pg_catalog.count(*) as n, sum(coalesce(u.revenue_sar, 0)) as amount
               from finance.merge_rule m
               join merged u on u.eff_partner_id = m.partner_id and u.merged_by = m.kind
                and case m.kind when 'discount_code' then m.value_key = u.code_key
                                else exists (select 1 from partner.identifier d where d.deleted_at is null
                                             and d.kind = 'payments_client_id' and d.partner_id = u.partner_id
                                             and d.value_key = m.value_key) end
               where m.deleted_at is null
               group by 1) i on i.rule_id = r.id
    where r.deleted_at is null), '[]'::jsonb);
end
$$;

create function finance.merge_rule_save(p_id uuid, p_fields jsonb, p_version int default null,
                                        p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  cur finance.merge_rule;
  req uuid;
  rid uuid;
  allowed text[] := array['kind', 'value', 'partner_id', 'reason'];
  changes jsonb := '{}'::jsonb;
  target uuid;
begin
  if pg_catalog.jsonb_typeof(p_fields) is distinct from 'object'
     or exists (select 1 from pg_catalog.jsonb_object_keys(p_fields) k where k <> all (allowed)) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'fields';
  end if;
  if p_fields ? 'partner_id' then
    begin
      target := (p_fields ->> 'partner_id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'partner_id';
    end;
    if not exists (select 1 from partner.partner p where p.id = target and p.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner';
    end if;
  end if;
  begin
    if p_id is null then
      if target is null or p_fields ->> 'kind' not in ('client_id', 'discount_code')
         or pg_catalog.btrim(coalesce(p_fields ->> 'value', '')) = ''
         or pg_catalog.btrim(coalesce(p_fields ->> 'reason', '')) = '' then
        raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'fields';
      end if;
      req := audit.begin('ui', 'finance.merge_rule_added',
                         pg_catalog.jsonb_build_object('kind', p_fields ->> 'kind', 'value', p_fields ->> 'value'), p_reason);
      insert into finance.merge_rule (kind, value_raw, partner_id, reason, created_by)
      values (p_fields ->> 'kind', p_fields ->> 'value', target, p_fields ->> 'reason', me)
      returning id into rid;
      perform audit.end();
      return pg_catalog.jsonb_build_object('id', rid, 'version', 1, 'request_id', req);
    end if;
    select * into cur from finance.merge_rule x where x.id = p_id and x.deleted_at is null for update;
    if cur.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if p_fields ? 'kind' and p_fields ->> 'kind' is distinct from cur.kind then
      changes := changes || pg_catalog.jsonb_build_object('kind', p_fields ->> 'kind');
    end if;
    if p_fields ? 'value' and p_fields ->> 'value' is distinct from cur.value_raw then
      changes := changes || pg_catalog.jsonb_build_object('value_raw', p_fields ->> 'value');
    end if;
    if target is not null and target is distinct from cur.partner_id then
      changes := changes || pg_catalog.jsonb_build_object('partner_id', target);
    end if;
    if p_fields ? 'reason' and p_fields ->> 'reason' is distinct from cur.reason then
      changes := changes || pg_catalog.jsonb_build_object('reason', p_fields ->> 'reason');
    end if;
    if changes = '{}'::jsonb then
      return pg_catalog.jsonb_build_object('id', cur.id, 'version', cur.version, 'request_id', null);
    end if;
    perform core.check_version('finance.merge_rule', cur.id, p_version,
                               array(select pg_catalog.jsonb_object_keys(changes)));
    req := audit.begin('ui', 'finance.merge_rule_changed',
                       pg_catalog.jsonb_build_object('kind', cur.kind, 'value', cur.value_raw), p_reason);
    perform audit.write_fields('finance.merge_rule', cur.id, changes);
    perform audit.end();
    return pg_catalog.jsonb_build_object('id', cur.id, 'version', cur.version + 1, 'request_id', req);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.merge_rule_exists',
                          detail = coalesce(p_fields ->> 'value', cur.value_raw);
  end;
end
$$;

create function finance.merge_rule_remove(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  cur finance.merge_rule;
  req uuid;
begin
  if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  select * into cur from finance.merge_rule x where x.id = p_id and x.deleted_at is null for update;
  if cur.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'finance.merge_rule_removed',
                     pg_catalog.jsonb_build_object('kind', cur.kind, 'value', cur.value_raw), p_reason);
  update finance.merge_rule x set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason
  where x.id = cur.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'request_id', req);
end
$$;

-- ---- "Is it counted?" — by month: the units and revenue that count, and those that do not, by why not
-- (a rule or the Admin's Exclude · not fully paid yet · in the promo pool). Both stores, a document that came
-- through both doors once. Finance at View.
create function finance.counted_by_month(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with u as (
      select m.month_on, m.revenue,
             case when m.counted then 'counted' when m.excluded_by is not null then 'excluded' else 'not_paid' end as state
      from finance.money_row m
      where m.created_on between p_from and p_to
      union all
      select pg_catalog.date_trunc('month', i.record_date::timestamp)::date, i.revenue_sar,
             case when i.excluded_by is not null then 'excluded'
                  when not i.fully_paid then 'not_paid'
                  when i.promo_pool then 'promo_pool'
                  else 'counted' end
      from finance.import_unit i
      where i.record_date between p_from and p_to
        and i.excluded_mode is distinct from 'hide'
        and not exists (select 1 from finance.money_row m where (m.counted or m.excluded_by is not null)
                        and m.partner_id = i.partner_id and m.unit_kind = i.mapped_kind and m.ref = i.number)
    ),
    months as (
      select u.month_on,
             pg_catalog.count(*) filter (where u.state = 'counted')::int as counted_units,
             coalesce(sum(u.revenue) filter (where u.state = 'counted'), 0) as counted_revenue,
             pg_catalog.count(*) filter (where u.state <> 'counted')::int as not_counted_units,
             coalesce(sum(u.revenue) filter (where u.state <> 'counted'), 0) as not_counted_revenue,
             pg_catalog.count(*) filter (where u.state = 'excluded')::int as excluded_units,
             coalesce(sum(u.revenue) filter (where u.state = 'excluded'), 0) as excluded_revenue,
             pg_catalog.count(*) filter (where u.state = 'not_paid')::int as not_paid_units,
             coalesce(sum(u.revenue) filter (where u.state = 'not_paid'), 0) as not_paid_revenue,
             pg_catalog.count(*) filter (where u.state = 'promo_pool')::int as promo_pool_units,
             coalesce(sum(u.revenue) filter (where u.state = 'promo_pool'), 0) as promo_pool_revenue
      from u where u.month_on is not null group by u.month_on
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.month_on) from months m), '[]'::jsonb),
      'years', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(y) order by y.year) from (
        select pg_catalog.date_part('year', m.month_on)::int as year,
               sum(m.counted_units)::int as counted_units, sum(m.counted_revenue) as counted_revenue,
               sum(m.not_counted_units)::int as not_counted_units, sum(m.not_counted_revenue) as not_counted_revenue,
               sum(m.excluded_units)::int as excluded_units, sum(m.excluded_revenue) as excluded_revenue,
               sum(m.not_paid_units)::int as not_paid_units, sum(m.not_paid_revenue) as not_paid_revenue,
               sum(m.promo_pool_units)::int as promo_pool_units, sum(m.promo_pool_revenue) as promo_pool_revenue
        from months m group by 1) y), '[]'::jsonb))
  );
end
$$;
alter function finance.counted_by_month(date, date) set jit = off;
comment on function finance.counted_by_month(date, date) is
  'Landing 32: "Is it counted?" — per month and per year, the units and revenue that count and those that do not, by why (excluded · not fully paid · promo pool).';

-- ---- What an import for this organisation (and this code text) would meet on the lists — for the preview,
-- so "left out by rule" counts the exclusion list too and a row is never silently stored uncounted.
create function finance.import_rule_check(p_partner uuid, p_source_promo text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  hit finance.exclusion_rule;
begin
  perform authz.require('finance', 'view');
  select x.* into hit from finance.exclusion_rule x
  where x.deleted_at is null and x.partner_id is null
    and case x.kind
          when 'client_id' then
            exists (select 1 from partner.identifier d where d.deleted_at is null and d.kind = 'payments_client_id'
                    and d.partner_id = p_partner and d.value_key = x.value_key)
            and not exists (select 1 from partner.identifier d2 where d2.deleted_at is null
                            and d2.kind = 'payments_client_id' and d2.partner_id = p_partner
                            and not exists (select 1 from finance.exclusion_rule x2 where x2.deleted_at is null
                                            and x2.kind = 'client_id' and x2.value_key = d2.value_key))
          when 'tax_no' then
            exists (select 1 from partner.identifier d where d.deleted_at is null and d.kind in ('vat', 'cr')
                    and d.partner_id = p_partner and d.value_key = x.value_key)
          when 'discount_code' then pg_catalog.btrim(coalesce(p_source_promo, '')) <> ''
                                    and norm.code_key(p_source_promo) = x.value_key
          when 'name' then
            not exists (select 1 from partner.identifier d where d.deleted_at is null and d.kind = 'payments_client_id'
                        and d.partner_id = p_partner)
            and exists (select 1 from partner.partner p where p.id = p_partner
                        and x.value_key in (norm.name_key(p.trade_name_en, partner.stop_words()),
                                            norm.name_key(p.trade_name_ar, partner.stop_words())))
          when 'partner' then
            exists (select 1 from partner.partner p where p.id = p_partner and norm.fold(p.number) = x.value_key)
          else false end
  order by case x.mode when 'hide' then 0 else 1 end, x.created_at
  limit 1;
  return pg_catalog.jsonb_build_object(
    'excluded', hit.id is not null,
    'kind', hit.kind, 'value', hit.value_raw, 'reason', hit.reason,
    -- the invoice numbers the list names one by one, so the preview can mark those rows too
    'numbers', coalesce((select pg_catalog.jsonb_agg(x.value_key) from finance.exclusion_rule x
                         where x.deleted_at is null and x.kind = 'invoice'
                           and (x.partner_id is null or x.partner_id = p_partner)), '[]'::jsonb));
end
$$;
comment on function finance.import_rule_check(uuid, text) is
  'Landing 32: whether the exclusion list catches an import for this organisation (and code), with the rule and its reason — for the import preview.';

create function api.finance_row_exclude(p_partner uuid, p_number text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.row_exclude(p_partner, p_number, p_reason) $$;
create function api.finance_row_include(p_partner uuid, p_number text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.row_include(p_partner, p_number, p_reason) $$;
create function api.finance_merge_rules() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.merge_rules() $$;
create function api.finance_merge_rule_save(p_id uuid, p_fields jsonb, p_version int default null,
                                            p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.merge_rule_save(p_id, p_fields, p_version, p_reason) $$;
create function api.finance_merge_rule_remove(p_id uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.merge_rule_remove(p_id, p_reason) $$;
create function api.finance_counted_by_month(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.counted_by_month(p_from, p_to) $$;
create function api.finance_import_rule_check(p_partner uuid, p_source_promo text default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.import_rule_check(p_partner, p_source_promo) $$;

revoke all on function finance.row_exclude(uuid, text, text), finance.row_include(uuid, text, text),
  finance.merge_rules(), finance.merge_rule_save(uuid, jsonb, int, text), finance.merge_rule_remove(uuid, text),
  finance.counted_by_month(date, date), finance.import_rule_check(uuid, text), finance.merge_key(),
  api.finance_row_exclude(uuid, text, text), api.finance_row_include(uuid, text, text),
  api.finance_merge_rules(), api.finance_merge_rule_save(uuid, jsonb, int, text),
  api.finance_merge_rule_remove(uuid, text), api.finance_counted_by_month(date, date),
  api.finance_import_rule_check(uuid, text) from public;
grant execute on function finance.row_exclude(uuid, text, text), finance.row_include(uuid, text, text),
  finance.merge_rules(), finance.merge_rule_save(uuid, jsonb, int, text), finance.merge_rule_remove(uuid, text),
  finance.counted_by_month(date, date), finance.import_rule_check(uuid, text),
  api.finance_row_exclude(uuid, text, text), api.finance_row_include(uuid, text, text),
  api.finance_merge_rules(), api.finance_merge_rule_save(uuid, jsonb, int, text),
  api.finance_merge_rule_remove(uuid, text), api.finance_counted_by_month(date, date),
  api.finance_import_rule_check(uuid, text) to authenticated;
