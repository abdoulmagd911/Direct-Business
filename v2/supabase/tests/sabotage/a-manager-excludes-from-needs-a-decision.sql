-- Sabotage: a-manager-excludes-from-needs-a-decision
-- Breaks: sql:MATCH-02
-- Expect: a manager cannot exclude from Needs a decision
-- Anyone who sees Needs a decision writes a Finance exclusion rule from it, where V458 keeps Exclude for admins.
create or replace function finance.match_decide(p_key text, p_decision text, p_partner uuid default null, p_reason text default null,
                                     p_options jsonb default '{}')
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
             case w.clue when 'client_id' then 'payments_client_id'
                         -- a tax number is a VAT number unless the person says it is a CR (§3.5)
                         when 'tax_no' then case when p_options ->> 'tax_kind' = 'cr' then 'cr' else 'vat' end
                         when 'email' then 'email'
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
  elsif p_decision = 'exclude' then
    -- Exclude writes a Finance rule, so admins only (V458); a reason is required, and the rule applies at once
    if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
      raise exception using errcode = 'P0001', message = 'common.reason_required';
    end if;
    if w.clue not in ('client_id', 'tax_no', 'name') then
      raise exception using errcode = 'P0001', message = 'match.exclude_needs_a_rule_kind', detail = w.clue;
    end if;
    req := audit.begin('ui', 'match.excluded', pg_catalog.jsonb_build_object('clue', w.clue), p_reason);
    insert into finance.exclusion_rule (kind, value_raw, mode, reason, created_by)
    values (w.clue, w.value, case when p_options ->> 'mode' = 'hide' then 'hide' else 'exclude' end, p_reason, authz.me());
    perform audit.end();
    return pg_catalog.jsonb_build_object('excluded', w.clue, 'request_id', req);
  elsif p_decision = 'individual' then
    if w.clue <> 'name' then
      raise exception using errcode = 'P0001', message = 'match.individual_needs_a_name';
    end if;
    return partner.individual_add(w.value, p_reason);
  end if;
  raise exception using errcode = 'P0001', message = 'match.unknown_decision', detail = coalesce(p_decision, '');
end
$$;
