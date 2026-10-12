-- QA-539 (V458): no amount reaches a person below View on Finance. Needs a decision (View on Clients) still lists each
-- customer, its rows and its clues, but the riyals at stake only for View on Finance and above. (The unpaid-invoice
-- alert already reaches only a person who can see the invoice, so never one with no Finance access.) Forward-only.

create or replace function finance.match_queue() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('clients', 'view');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'key', g.key, 'clue', g.clue, 'value', g.value, 'states', g.states, 'rows', g.n,
             -- the riyals at stake only for View on Finance and above (V458, QA-539)
             'amount_sar', case when authz.level('finance') >= 'view' then g.amount end,
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
