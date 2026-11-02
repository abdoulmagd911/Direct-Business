-- Sabotage: the-queue-shows-amounts-to-clients-only
-- Breaks: sql:FAL-02
-- Expect: Needs a decision shows the customer and its rows, not the riyals
-- Needs a decision gives the riyals at stake to anyone with View on Clients, whatever their Finance level (QA-539, V458).
create or replace function finance.match_queue() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('clients', 'view');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'key', g.key, 'clue', g.clue, 'value', g.value, 'states', g.states, 'rows', g.n,
             -- the riyals at stake only for View on Finance and above (V458, QA-539)
             'amount_sar', g.amount,
             'first_on', g.first_on, 'last_on', g.last_on, 'pinned_to', g.pins,
             -- every organisation a conflicting row could be, at whichever level it stopped (§3.5)
             'candidates', coalesce((select pg_catalog.jsonb_agg(distinct c.c)
                                     from pg_catalog.unnest(g.ids) x(id)
                                     cross join lateral finance.match_detail(x.id) d
                                     cross join lateral pg_catalog.unnest(d.candidates) c(c)), '[]'::jsonb),
             'suggestions', coalesce((select pg_catalog.jsonb_agg(distinct d.partner_id) from partner.identifier d
                                      where d.deleted_at is null and d.kind = 'name' and d.value_key = any (g.names)),
                                     '[]'::jsonb))
           order by g.amount desc nulls last, g.key)
    from (select w.key, min(w.clue) as clue, min(w.value) as value,
                 pg_catalog.array_agg(distinct w.match_state order by w.match_state) as states,
                 pg_catalog.count(*) as n, sum(w.total_sar) as amount, min(w.created_on) as first_on,
                 max(w.created_on) as last_on,
                 pg_catalog.array_agg(w.invoice_id) filter (where w.match_state = 'conflict') as ids,
                 pg_catalog.array_remove(pg_catalog.array_agg(distinct w.name_key) || pg_catalog.array_agg(distinct w.name2_key),
                                         null) as names,
                 coalesce(pg_catalog.jsonb_agg(distinct w.pinned_to) filter (where w.pinned_to is not null), '[]'::jsonb) as pins
          from finance.match_waiting w group by w.key) g), '[]'::jsonb);
end
$$;
