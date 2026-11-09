-- FIX-04 (F161): the code's configured discount value. Nothing in the app read partner.code_terms, so the detail
-- showed the aggregate totals but never the value the code was configured with. codes_detail now also answers
-- fee_percent: the latest code_terms row's fee_percent for the code's identifier, or null when there is no terms
-- row (shown empty, never 0). "Latest" is the terms row with the latest effective_from, then the latest created_at —
-- the most recent configuration. A terms row can carry services/tiers, so this is the configured value, not a
-- per-service or per-tier figure; which row is "the" value when several exist is this definition, and finance
-- finalisation may refine it (e.g. to the terms in effect today). Only this function is redefined here; the
-- single-pass rewrite of the three codes functions (FIX-04 (a)) is a later migration and must keep fee_percent.
-- No signature change, so the grants and the generated types are untouched. Forward-only (V103): nothing already
-- on v2/main is edited here. Regression test: CODE-02 (supabase/tests/codes/).

-- finance.codes_detail as 20261104120000 wrote it, plus fee_percent.
create or replace function finance.codes_detail(p_code uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  code_row partner.identifier;
begin
  perform authz.require('codes', 'view');
  select * into code_row from partner.identifier d
  where d.id = p_code and d.kind = 'discount_code' and d.deleted_at is null;
  if code_row.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return pg_catalog.jsonb_build_object(
    'id', code_row.id,
    'code', code_row.value_raw,
    'valid_from', code_row.valid_from,
    'valid_to', code_row.valid_to,
    'state', finance.code_state(code_row.valid_from, code_row.valid_to),
    'fee_percent', (
      select t.fee_percent from partner.code_terms t
      where t.identifier_id = code_row.id and t.deleted_at is null
      order by t.effective_from desc, t.created_at desc limit 1),
    'totals', pg_catalog.jsonb_build_object(
      'total_discount', (
        select sum(u.discount_sar) from finance.code_use u
        where u.code_id = code_row.id and u.deleted_at is null
          and exists (select 1 from finance.money_row m where m.invoice_id = u.invoice_id and m.counted)),
      'total_collected', (
        select sum(m.revenue) from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'total_cost', (
        select sum(m.cost) from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'total_profit', (
        select sum(m.profit) from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'units', (
        select pg_catalog.count(*)::int from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null)),
    'ledger', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.counted desc, l.created_on)
      from (
        select u.id as use_id, u.invoice_id, u.invoice_ref as ref, i.created_on, i.status_raw as status_word,
               u.discount_sar, u.source, u.direct_url,
               (select coalesce(pg_catalog.bool_and(m.counted), false) from finance.money_row m where m.invoice_id = u.invoice_id) as counted,
               (select sum(m.revenue) from finance.money_row m where m.invoice_id = u.invoice_id and m.counted) as revenue,
               (select sum(m.cost) from finance.money_row m where m.invoice_id = u.invoice_id and m.counted) as cost,
               (select sum(m.profit) from finance.money_row m where m.invoice_id = u.invoice_id and m.counted) as profit,
               (select min(m.excluded_reason) from finance.money_row m where m.invoice_id = u.invoice_id) as excluded_reason
        from finance.code_use u
        join finance.invoice i on i.id = u.invoice_id
        where u.code_id = code_row.id and u.deleted_at is null
      ) l), '[]'::jsonb),
    'attributions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', a.id, 'partner_id', a.partner_id, 'partner_name', p.trade_name_en, 'is_promo', a.is_promo)
        order by p.trade_name_en)
      from finance.code_attribution a
      join partner.partner p on p.id = a.partner_id
      where a.code_id = code_row.id and a.deleted_at is null), '[]'::jsonb));
end
$$;
