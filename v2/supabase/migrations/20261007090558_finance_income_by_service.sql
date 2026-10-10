-- Income by service (D24, spec §3.6 money_service_row; V437, V483). Each counted unit's lines go to one service: the
-- line's own service (typed, or set by a person on an imported line — V483), else the item map on the first part of the
-- line's name, else its product's service, else "No service yet". Lines of a "not income" service sit on their own row,
-- never in a service's sums; wallet top-up lines are not revenue at all and are not here. What the lines do not cover
-- (a monthly invoice's fee, a unit without lines, a total that differs from its lines) is "Not split by line", so
-- services + not income + no service yet + not split = the revenue tile and nothing hides (OA5). The unit's cost is
-- split by each row's share of its revenue, to the halala, the remainder on its largest row, so the parts add up.

-- The item of a line: the part before the first spaced dash or bar ("Chauffeur Service - 3rd Party Fee" → chauffeur
-- service), folded as every other list word.
create function finance.item_head(p_name text) returns text
language sql immutable set search_path = ''
as $$
  select norm.fold(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '\s[-–—|]\s.*$', '')))
$$;

-- The item map (§3.6 finance.item_service): an item, as a person types it (its English name), → a service. Settings →
-- Finance, admins (V97).
create table finance.item_service (
  id uuid primary key default gen_random_uuid(),
  key text not null unique default ('item_' || pg_catalog.replace(gen_random_uuid()::text, '-', ''))
    check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> '' and pg_catalog.length(name_en) <= 200),
  name_ar text not null check (pg_catalog.btrim(name_ar) <> '' and pg_catalog.length(name_ar) <= 200),
  item_key text generated always as (finance.item_head(name_en)) stored,
  service_id uuid not null references finance.service (id),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint item_service_readable check (finance.item_head(name_en) is not null)
);
create unique index item_service_one_item on finance.item_service (item_key) where deleted_at is null;
comment on table finance.item_service is 'D24: an item (the first part of a line name) → a service, ahead of the product''s service. Admins keep it in Settings → Finance.';
alter table finance.item_service enable row level security;
select audit.track('finance.item_service'::regclass);
select core.index_foreign_keys('finance');

-- Every live line with its service and how it was found.
create view finance.line_service with (security_invoker = true) as
select l.id as line_id, l.invoice_id, l.line_no, l.name, l.total_sar,
       finance.is_wallet_line(l.product_id, l.name) as wallet,
       s.id as service_id, coalesce(s.counts_as_income, true) as counts_as_income,
       case when ls.id is not null then 'line' when its.id is not null then 'item' when ps.id is not null then 'product' end
         as mapped_by
from finance.invoice_line l
join finance.invoice i on i.id = l.invoice_id and i.deleted_at is null
-- the line's own service only where a person chose it: a typed invoice, a line added by hand, or a service (or product)
-- set in the app; an import's copy of the product's service is not a choice and leaves the item map in charge
left join finance.service ls on ls.id = l.service_id and ls.deleted_at is null
  and (i.source = 'manual' or l.src ->> '_row' = 'person' or l.src ->> 'service_id' = 'person'
       or l.src ->> 'product_id' = 'person')
left join finance.item_service it on it.item_key = finance.item_head(l.name) and it.active and it.deleted_at is null
left join finance.service its on its.id = it.service_id and its.deleted_at is null
left join finance.product p on p.id = l.product_id and p.deleted_at is null
left join finance.service ps on ps.id = p.service_id and ps.deleted_at is null
left join finance.service s on s.id = coalesce(ls.id, its.id, ps.id)
where l.deleted_at is null;
comment on view finance.line_service is 'D24, V483: each line''s service — the line''s own, else the item map, else the product''s; mapped_by says which.';

-- Each counted unit × part: a service, a not-income service, No service yet, or Not split by line.
create view finance.money_service_row with (security_invoker = true) as
with u as (
  select r.invoice_id, r.unit_kind, r.ref, r.month_on, r.revenue, r.cost, r.provisional
  from finance.money_row r where r.counted
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
comment on view finance.money_service_row is 'D24 (§3.6): each counted unit''s revenue by service; services + not income + no service yet + not split = the unit''s revenue, and its cost split by share adds up to its cost.';

-- The period by service, for Finance → Income by service: each part's revenue, cost and units, and the revenue tile
-- beside them with the gap between (0, or named — never rounded away).
create function finance.income_by_service(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m0 date := pg_catalog.date_trunc('month', p_from::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', p_to::timestamp)::date;
  tile numeric;
  rows jsonb;
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  select coalesce(sum(r.revenue), 0) into tile from finance.money_row r where r.counted and r.month_on between m0 and m1;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'part', g.part, 'service_id', g.service_id, 'service_key', sv.key, 'name_en', sv.name_en, 'name_ar', sv.name_ar,
           'revenue', g.revenue, 'cost', g.cost, 'units', g.units)
           order by pg_catalog.array_position(array['service', 'not_income', 'no_service', 'not_split'], g.part), sv.sort, sv.key),
         '[]'::jsonb)
    into rows
  from (select x.part, x.service_id, sum(x.revenue) as revenue, sum(x.cost) as cost,
               pg_catalog.count(distinct (x.invoice_id, x.unit_kind))::int as units
        from finance.money_service_row x where x.month_on between m0 and m1
        group by x.part, x.service_id) g
  left join finance.service sv on sv.id = g.service_id;
  return pg_catalog.jsonb_build_object(
    'from', m0, 'to', m1, 'revenue', tile, 'rows', rows,
    'gap', tile - coalesce((select sum((e ->> 'revenue')::numeric) from pg_catalog.jsonb_array_elements(rows) e), 0));
end
$$;

create function api.finance_income_by_service(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.income_by_service(p_from, p_to) $$;

revoke all on function finance.income_by_service(date, date) from public;
grant execute on function finance.income_by_service(date, date) to authenticated;
grant execute on function api.finance_income_by_service(date, date) to authenticated;
