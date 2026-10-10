-- Pins (P4-3, spec §3.5 level 0; V147). A pin names the organisation an invoice belongs to when its clues decide
-- nothing, logged and undoable, of two kinds: `entry` — the one a person picked while typing (or importing) an invoice
-- whose clues matched nothing, set by anyone who may type the invoice; `decision` — a manager's last resort, needing
-- the Client side's identify capability. A live pin wins over every other level. The clue itself still waits in Needs
-- a decision, with the pin beside it: once a person accepts it there, the invoice matches by itself and the pin is let
-- go in the same request. Finance health lists a pin whose invoice would now match a different organisation without
-- it. Forward-only.

create table partner.match_pin (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('finance.invoice')),
  source_id uuid not null,
  partner_id uuid not null references partner.partner (id),
  kind text not null check (kind in ('entry', 'decision')),
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index match_pin_one on partner.match_pin (source_table, source_id) where deleted_at is null;
comment on table partner.match_pin is '§3.5 level 0: the organisation a person pinned an invoice to when its clues decided nothing — entry (while typing) or decision (a manager''s last resort); a live pin wins.';
create function partner.match_pin_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select partner.owners_via('partner.match_pin', p_id)
  union
  select i.created_by from partner.match_pin m join finance.invoice i on i.id = m.source_id where m.id = p_id
$$;
alter table partner.match_pin enable row level security;
select audit.track('partner.match_pin'::regclass);
select core.index_foreign_keys('partner');

-- The engine of §3.5 steps 2 to 4, as before, under its own name; the match puts the pin in front of it.
create function finance.partner_match_unpinned(p_invoice uuid)
returns table (partner_id uuid, state text, level text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v finance.invoice;
  hits uuid[];
begin
  select * into v from finance.invoice i where i.id = p_invoice;
  if v.id is null then
    return;
  end if;
  if v.client_id_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'payments_client_id' and d.value_key = v.client_id_key;
    if hits is null then
      return query select null::uuid, 'unknown_client_id'::text, 'client_id'::text;
      return;
    end if;
    return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                        case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'client_id'::text;
    return;
  end if;
  if v.tax_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind in ('vat', 'cr') and d.value_key = v.tax_key;
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'tax_no'::text;
      return;
    end if;
  end if;
  if v.code_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'discount_code' and d.value_key = v.code_key
      and v.created_on between coalesce(d.valid_from, '-infinity'::date) and coalesce(d.valid_to, 'infinity'::date);
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'code'::text;
      return;
    end if;
  end if;
  if v.email_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'email' and d.value_key = v.email_key;
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'email'::text;
      return;
    end if;
  end if;
  -- a name a person typed as an organisation's alias, only on a row with no client ID (V412, V421)
  if v.client_id_key is null and coalesce(v.name_key, v.name2_key) is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'name' and d.subkind = 'alias' and d.value_key in (v.name_key, v.name2_key);
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'alias'::text;
      return;
    end if;
    -- a person, not an organisation (D25)
    if exists (select 1 from partner.individual_name n where n.deleted_at is null and n.name_key in (v.name_key, v.name2_key)) then
      return query select null::uuid, 'individual'::text, 'name'::text;
      return;
    end if;
  end if;
  return query select null::uuid, 'none'::text, null::text;
end
$$;

create or replace function finance.partner_match(p_invoice uuid)
returns table (partner_id uuid, state text, level text)
language sql stable security definer set search_path = ''
as $$
  select coalesce(p.partner_id, u.partner_id), case when p.id is not null then 'matched' else u.state end,
         case when p.id is not null then 'pin' else u.level end
  from finance.partner_match_unpinned(p_invoice) u
  left join partner.match_pin p on p.source_table = 'finance.invoice' and p.source_id = p_invoice and p.deleted_at is null
$$;

-- Set a pin. entry: the clues matched nothing (none, or a client ID nobody holds); decision: any row not matched by its
-- clues, a true conflict included. A matched row takes no pin; one pin per row.
create function finance.match_pin_set(p_invoice uuid, p_partner uuid, p_kind text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'own');
  u record;
  req uuid;
  pid uuid;
begin
  if p_kind not in ('entry', 'decision') then
    raise exception using errcode = 'P0001', message = 'match.unknown_pin_kind', detail = coalesce(p_kind, '');
  end if;
  if p_kind = 'decision' then
    perform authz.require_capability('clients.identify');
  end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if not exists (select 1 from finance.invoice i where i.id = p_invoice and i.deleted_at is null)
     or not exists (select 1 from partner.partner x where x.id = p_partner and x.archived_at is null and x.merged_into_id is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into u from finance.partner_match_unpinned(p_invoice);
  if u.state = 'matched' then
    raise exception using errcode = 'P0001', message = 'match.already_matched';
  end if;
  if p_kind = 'entry' and u.state not in ('none', 'unknown_client_id') then
    raise exception using errcode = 'P0001', message = 'match.entry_pin_needs_no_match', detail = u.state;
  end if;
  if exists (select 1 from partner.match_pin p where p.source_table = 'finance.invoice' and p.source_id = p_invoice
             and p.deleted_at is null) then
    raise exception using errcode = '23505', message = 'match.already_pinned';
  end if;
  req := audit.begin('ui', 'match.pinned', pg_catalog.jsonb_build_object('kind', p_kind), p_reason);
  insert into partner.match_pin (source_table, source_id, partner_id, kind, reason, created_by)
  values ('finance.invoice', p_invoice, p_partner, p_kind, pg_catalog.btrim(p_reason), me)
  returning id into pid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', 1, 'request_id', req);
end
$$;

-- Let a pin go. A decision pin needs the same capability that set it.
create function finance.match_pin_clear(p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'own');
  p partner.match_pin;
  req uuid;
begin
  select * into p from partner.match_pin x where x.id = p_id and x.deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p.kind = 'decision' then
    perform authz.require_capability('clients.identify');
  end if;
  req := audit.begin('ui', 'match.unpinned', pg_catalog.jsonb_build_object('kind', p.kind), p_reason);
  update partner.match_pin x
  set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = coalesce(nullif(pg_catalog.btrim(p_reason), ''), 'unpinned')
  where x.id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- Needs a decision keeps a pinned row, with its pin beside it: the clue still wants accepting.
create or replace view finance.match_waiting with (security_invoker = true) as
select f.id as invoice_id, f.ref, f.match_state, f.total_sar, f.created_on, c.key, c.clue, c.value, i.name_key, i.name2_key,
       i.client_id_key as id_key, i.tax_key, i.email_key, p.partner_id as pinned_to
from finance.invoice_fact f
join finance.invoice i on i.id = f.id
cross join lateral finance.match_clue(i) c
left join partner.match_pin p on p.source_table = 'finance.invoice' and p.source_id = f.id and p.deleted_at is null
where (f.match_state in ('none', 'unknown_client_id', 'conflict') or f.match_level = 'pin') and f.kind <> 'credit_note'
  and f.pay_state is distinct from 'void' and f.pay_state is distinct from 'cancelled';

create or replace function finance.match_queue() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('clients', 'view');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'key', g.key, 'clue', g.clue, 'value', g.value, 'states', g.states, 'rows', g.n, 'amount_sar', g.amount,
             'first_on', g.first_on, 'last_on', g.last_on, 'pinned_to', g.pins,
             'candidates', coalesce((select pg_catalog.jsonb_agg(distinct d.partner_id) from partner.identifier d
                                     where d.deleted_at is null and 'conflict' = any (g.states)
                                       and ((g.clue = 'client_id' and d.kind = 'payments_client_id' and d.value_key = g.ck)
                                            or (g.clue = 'tax_no' and d.kind in ('vat', 'cr') and d.value_key = g.tk)
                                            or (g.clue = 'email' and d.kind = 'email' and d.value_key = g.ek))), '[]'::jsonb),
             'suggestions', coalesce((select pg_catalog.jsonb_agg(distinct d.partner_id) from partner.identifier d
                                      where d.deleted_at is null and d.kind = 'name' and d.value_key = any (g.names)),
                                     '[]'::jsonb))
           order by g.amount desc nulls last, g.key)
    from (select w.key, min(w.clue) as clue, min(w.value) as value,
                 pg_catalog.array_agg(distinct w.match_state order by w.match_state) as states,
                 pg_catalog.count(*) as n, sum(w.total_sar) as amount, min(w.created_on) as first_on,
                 max(w.created_on) as last_on, min(w.id_key) as ck, min(w.tax_key) as tk, min(w.email_key) as ek,
                 pg_catalog.array_remove(pg_catalog.array_agg(distinct w.name_key) || pg_catalog.array_agg(distinct w.name2_key),
                                         null) as names,
                 coalesce(pg_catalog.jsonb_agg(distinct w.pinned_to) filter (where w.pinned_to is not null), '[]'::jsonb) as pins
          from finance.match_waiting w group by w.key) g), '[]'::jsonb);
end
$$;

create or replace function finance.match_decide(p_key text, p_decision text, p_partner uuid default null, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  w record;
  req uuid;
  out jsonb;
begin
  perform authz.require('clients', 'view');
  select x.clue, x.value, pg_catalog.bool_or(x.match_state = 'conflict') as conflict
    into w from finance.match_waiting x where x.key = p_key group by x.clue, x.value limit 1;
  if w.clue is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_decision = 'partner' then
    if p_partner is null then
      raise exception using errcode = 'P0001', message = 'match.partner_required';
    end if;
    if w.conflict then
      raise exception using errcode = 'P0001', message = 'match.conflict_needs_a_move';
    end if;
    if w.clue = 'ref' then
      raise exception using errcode = 'P0001', message = 'match.no_clue';
    end if;
    req := audit.begin('ui', 'match.decided', pg_catalog.jsonb_build_object('clue', w.clue), p_reason);
    out := partner.identifier_add(p_partner,
             case w.clue when 'client_id' then 'payments_client_id' when 'tax_no' then 'vat' when 'email' then 'email'
                         else 'name' end,
             w.value, coalesce(nullif(pg_catalog.btrim(p_reason), ''), 'Needs a decision'),
             case w.clue when 'name' then 'alias' end);
    -- a pinned row of this customer that now matches by itself lets its pin go, in the same request (§3.5)
    update partner.match_pin p
    set deleted_at = pg_catalog.now(), deleted_by = authz.me(), delete_reason = 'matched by itself'
    where p.deleted_at is null and p.source_table = 'finance.invoice'
      and p.source_id in (select x.invoice_id from finance.match_waiting x where x.key = p_key)
      and exists (select 1 from finance.partner_match_unpinned(p.source_id) u
                  where u.state = 'matched' and u.partner_id = p.partner_id);
    perform audit.end();
    return out || pg_catalog.jsonb_build_object('request_id', req);
  elsif p_decision = 'individual' then
    if w.clue <> 'name' then
      raise exception using errcode = 'P0001', message = 'match.individual_needs_a_name';
    end if;
    return partner.individual_add(w.value, p_reason);
  end if;
  raise exception using errcode = 'P0001', message = 'match.unknown_decision', detail = coalesce(p_decision, '');
end
$$;


create or replace function finance.health(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m0 date := pg_catalog.date_trunc('month', coalesce(p_from, '2000-01-01')::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', coalesce(p_to, '2100-12-31')::timestamp)::date;
begin
  perform authz.require('finance', 'view');
  if m1 < m0 then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with latest as (
      select distinct on (b.file) b.id, b.file from finance.import_batch b order by b.file, b.export_time desc, b.created_at desc
    ),
    held as (
      select h.reason_key, l.file, h.ref, finance.raw_amount(h.raw) as amount
      from finance.import_held h join latest l on l.id = h.batch_id
      where not h.written
    ),
    u as (select * from finance.money_row r where r.month_on between m0 and m1),
    items as (
      select 'held_' || h.file || '_' || h.reason_key as key, pg_catalog.count(*)::int as n, sum(h.amount) as amount
      from held h where not (h.file = 'expenses' and h.reason_key = 'no_invoice')
      group by h.file, h.reason_key
      union all
      select 'drop_cost_export_again', pg_catalog.count(distinct h.ref)::int, sum(h.amount)
      from held h
      where h.file = 'expenses' and h.reason_key = 'no_invoice'
        and exists (select 1 from finance.invoice i where i.ref = h.ref and i.deleted_at is null)
      union all
      select 'excluded', pg_catalog.count(*)::int, sum(u.revenue) from u where u.excluded_by is not null and u.paid
      union all
      select 'hidden', pg_catalog.count(*)::int, sum(i.total_sar)
      from finance.invoice i cross join lateral finance.exclusion_of(i.id) x
      where i.deleted_at is null and x.mode = 'hide' and i.month_on between m0 and m1
      union all
      select 'no_organisation', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.match_state = 'none'
      union all
      select 'unknown_client_id', pg_catalog.count(*)::int, sum(u.revenue)
      from u where u.counted and u.match_state = 'unknown_client_id'
      union all
      select 'match_conflict', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.match_state = 'conflict'
      union all
      select 'provisional', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.provisional
      union all
      select 'losses', pg_catalog.count(*)::int, sum(u.profit) from u where u.counted and u.loss
      union all
      select 'checks_failed', pg_catalog.count(*)::int, sum(pg_catalog.abs(c.amount_sar))
      from finance.check c join finance.invoice i on i.id = c.invoice_id
      where not c.ok and i.month_on between m0 and m1
      union all
      select 'differences_open', pg_catalog.count(*)::int, null::numeric
      from finance.import_difference d where d.state = 'open' and d.deleted_at is null
      union all
      select 'proposals_open', pg_catalog.count(*)::int, null::numeric
      from finance.billing_proposal p where p.state = 'open' and p.deleted_at is null
      union all
      select 'pins_stale', pg_catalog.count(*)::int, sum(i.total_sar)
      from partner.match_pin p
      join finance.invoice i on i.id = p.source_id and i.deleted_at is null
      cross join lateral finance.partner_match_unpinned(i.id) x
      where p.deleted_at is null and x.state = 'matched' and x.partner_id <> p.partner_id and i.month_on between m0 and m1
    )
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', i.key, 'count', i.n, 'amount_sar', i.amount)
                                         order by i.key) filter (where i.n > 0), '[]'::jsonb)
    from items i
  );
end
$$;


create function api.match_pin_set(p_invoice uuid, p_partner uuid, p_kind text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.match_pin_set(p_invoice, p_partner, p_kind, p_reason) $$;
create function api.match_pin_clear(p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.match_pin_clear(p_id, p_reason) $$;

revoke all on function finance.partner_match_unpinned(uuid), finance.match_pin_set(uuid, uuid, text, text),
  finance.match_pin_clear(uuid, text) from public;
grant execute on function finance.match_pin_set(uuid, uuid, text, text) to authenticated;
grant execute on function finance.match_pin_clear(uuid, text) to authenticated;
grant execute on function api.match_pin_set(uuid, uuid, text, text) to authenticated;
grant execute on function api.match_pin_clear(uuid, text) to authenticated;
