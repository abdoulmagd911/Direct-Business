-- Needs a decision (P4-3, spec §3.5; V147, V412, V420, V421, D25). The match gains its last two steps: a name a person
-- typed as an organisation's alias matches a row with no client ID; a name on the individuals list makes the row an
-- individual's. Rows still in none, unknown_client_id or conflict wait in Needs a decision, grouped by customer — the
-- row's strongest clue (client ID, else VAT/CR, else email, else name) — with their count, the riyals at stake, the
-- organisations holding the clue in a conflict and those whose names resemble the row's (a suggestion, never a match).
-- A person decides once per customer: "This is client X" adds the clue to X as an identifier (an alias for a name),
-- through the identifier door — its rights (the side's identify capability), its log, its Undo — so every row with that
-- clue matches by itself; "Individual" puts the name on the individuals list. A conflict is not settled by adding a clue:
-- it needs the identifier moved or the organisations merged. Exclude stays on the Finance rules (admins, V458).
-- Forward-only.

create or replace function finance.partner_match(p_invoice uuid)
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


-- The customer a row waits under: its strongest clue.
create function finance.match_clue(i finance.invoice) returns table (key text, clue text, value text)
language sql immutable set search_path = ''
as $$
  select case when i.client_id_key is not null then 'client_id:' || i.client_id_key
              when i.tax_key is not null then 'tax_no:' || i.tax_key
              when i.email_key is not null then 'email:' || i.email_key
              when i.name_key is not null then 'name:' || i.name_key
              else 'ref:' || i.ref end,
         case when i.client_id_key is not null then 'client_id' when i.tax_key is not null then 'tax_no'
              when i.email_key is not null then 'email' when i.name_key is not null then 'name' else 'ref' end,
         case when i.client_id_key is not null then i.client_id_raw when i.tax_key is not null then i.tax_no_raw
              when i.email_key is not null then i.customer_email when i.name_key is not null then i.customer_name
              else i.ref end
$$;

create view finance.match_waiting with (security_invoker = true) as
select f.id as invoice_id, f.ref, f.match_state, f.total_sar, f.created_on, c.key, c.clue, c.value, i.name_key, i.name2_key,
       i.client_id_key as id_key, i.tax_key, i.email_key
from finance.invoice_fact f
join finance.invoice i on i.id = f.id
cross join lateral finance.match_clue(i) c
where f.match_state in ('none', 'unknown_client_id', 'conflict') and f.kind <> 'credit_note'
  and f.pay_state is distinct from 'void' and f.pay_state is distinct from 'cancelled';

create function finance.match_queue() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('clients', 'view');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'key', g.key, 'clue', g.clue, 'value', g.value, 'states', g.states, 'rows', g.n, 'amount_sar', g.amount,
             'first_on', g.first_on, 'last_on', g.last_on,
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
                                         null) as names
          from finance.match_waiting w group by w.key) g), '[]'::jsonb);
end
$$;

-- One decision for a customer: 'partner' (this is client X) or 'individual'.
create function finance.match_decide(p_key text, p_decision text, p_partner uuid default null, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  w record;
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
    return partner.identifier_add(p_partner,
             case w.clue when 'client_id' then 'payments_client_id' when 'tax_no' then 'vat' when 'email' then 'email'
                         else 'name' end,
             w.value, coalesce(nullif(pg_catalog.btrim(p_reason), ''), 'Needs a decision'),
             case w.clue when 'name' then 'alias' end);
  elsif p_decision = 'individual' then
    if w.clue <> 'name' then
      raise exception using errcode = 'P0001', message = 'match.individual_needs_a_name';
    end if;
    return partner.individual_add(w.value, p_reason);
  end if;
  raise exception using errcode = 'P0001', message = 'match.unknown_decision', detail = coalesce(p_decision, '');
end
$$;

create function api.match_queue() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.match_queue() $$;
create function api.match_decide(p_key text, p_decision text, p_partner uuid default null, p_reason text default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.match_decide(p_key, p_decision, p_partner, p_reason) $$;

revoke all on function finance.match_clue(finance.invoice), finance.match_queue(),
  finance.match_decide(text, text, uuid, text) from public;
grant execute on function finance.match_queue() to authenticated;
grant execute on function finance.match_decide(text, text, uuid, text) to authenticated;
grant execute on function api.match_queue() to authenticated;
grant execute on function api.match_decide(text, text, uuid, text) to authenticated;
