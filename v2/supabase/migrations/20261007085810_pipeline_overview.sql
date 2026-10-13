-- P5-10 (the database half) · the Commercial overview (TECH-SPEC §3.7a, §6; V80, V477, V503, V511, V64):
-- api.overview(period, from, to, segment) — for a period (month, quarter or year to date, or custom) against the same
-- days a year earlier: the clients (sign-ups · onboarded — V477's third count, active, reads invoices), tenders
-- submitted, awarded value, partnerships signed and government entity contracts; then both funnels as of the period's
-- last day. A segment (a Client-side type key, V64) filters every figure and funnel. The money tiles — revenue, cost,
-- profit, collections — and the active clients read Finance (P4): until it lands they answer "not measured", never 0
-- (V511, M60). Company-wide, for whoever may view the Overview (TECH-SPEC §8). Forward-only.

-- ================================================================ the clients (V477) and the contracts (§3.8)
-- Sign-ups: organisations whose Client side came on inside the period (its start, else the day it was added), in the
-- segment its type names. Person scope: one of the side's owners; team and department: an owner's.
create function measure.partner_sign_ups_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                               p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'partner.partner'::text, s.partner_id, null::uuid, coalesce(s.since, core.riyadh_day(s.created_at)), true
  from partner.partner_side s join partner.partner p on p.id = s.partner_id
  where s.side = 'client' and s.deleted_at is null and p.deleted_at is null
    and coalesce(s.since, core.riyadh_day(s.created_at)) between p_from and p_to
    and (seg is null or s.type_id = seg)
    and measure.partner_in_scope(p_scope_kind, p_scope_id, s.partner_id)
  order by 4, 2;
end
$$;
create function measure.partner_sign_ups(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.partner_sign_ups_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- Onboarded: organisations whose Client side first reached Active inside the period (its effective date).
create function measure.partner_onboarded_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'partner.partner'::text, x.partner_id, null::uuid, x.first_active, true
  from (select c.partner_id, pg_catalog.min(c.effective_on) as first_active
        from partner.side_status_change c
        where c.side = 'client' and c.status = 'active' and c.deleted_at is null
        group by c.partner_id) x
  join partner.partner_side s on s.partner_id = x.partner_id and s.side = 'client' and s.deleted_at is null
  join partner.partner p on p.id = x.partner_id and p.deleted_at is null
  where x.first_active between p_from and p_to
    and (seg is null or s.type_id = seg)
    and measure.partner_in_scope(p_scope_kind, p_scope_id, x.partner_id)
  order by 4, 2;
end
$$;
create function measure.partner_onboarded(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.partner_onboarded_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- Whether an organisation's Client side belongs to a scope: partner is the organisation; person one of the side's
-- owners; team and department an owner's.
create function measure.partner_in_scope(p_kind text, p_id uuid, p_partner uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case coalesce(p_kind, 'company')
           when 'company' then true
           when 'partner' then p_partner = p_id
           else exists (select 1 from partner.side_owners(p_partner, 'client') o(person_id)
                        join core.person p on p.id = o.person_id
                        where measure.in_scope(p_kind, p_id, p.id, p.team_id, p.department_id, null)) end
$$;

-- Government entity contracts (§3.8, V503): live, dated achievements of the Contract signed category (code CONTRACT,
-- or one under it) with an organisation of the Government segment, by the day they happened. Under another segment
-- there are none.
create function measure.perf_government_contracts_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                        p_from date, p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
  gov uuid := (select t.id from partner.side_type t where t.side = 'client' and t.key = 'government' and t.deleted_at is null);
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'perf.achievement'::text, a.id, a.owner_id, a.happened_on, true
  from perf.achievement a
  join perf.achievement_category c on c.id = a.category_id
  left join perf.achievement_category up on up.id = c.parent_id
  left join core.person p on p.id = a.owner_id
  where a.deleted_at is null and not a.draft and a.happened_on between p_from and p_to
    and 'CONTRACT' in (c.code, up.code)
    and a.partner_id is not null and measure.client_segment(a.partner_id) = gov
    and (seg is null or seg = gov)
    and measure.in_scope(p_scope_kind, p_scope_id, a.owner_id, p.team_id, a.department_id, a.partner_id)
  order by a.happened_on, a.id;
end
$$;
create function measure.perf_government_contracts(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                  p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.perf_government_contracts_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

revoke all on function measure.partner_sign_ups_items(jsonb, text, uuid, date, date),
  measure.partner_sign_ups(jsonb, text, uuid, date, date), measure.partner_onboarded_items(jsonb, text, uuid, date, date),
  measure.partner_onboarded(jsonb, text, uuid, date, date), measure.partner_in_scope(text, uuid, uuid),
  measure.perf_government_contracts_items(jsonb, text, uuid, date, date),
  measure.perf_government_contracts(jsonb, text, uuid, date, date)
from public;

-- ================================================================ the overview
-- One figure against last year's: the value now, whether it is measured, how many it counts, and the same a year back.
create function pipeline.overview_tile(p_now measure.result, p_last measure.result) returns jsonb
language sql immutable set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('value', (p_now).value, 'measured', (p_now).measured, 'n', (p_now).n,
                                       'last_year', (p_last).value, 'last_year_measured', (p_last).measured)
$$;

-- A figure that reads Finance, until Finance lands (V511): not measured — never drawn as 0 (M60).
create function pipeline.overview_waits_for_finance() returns jsonb
language sql immutable set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('value', null, 'measured', false, 'n', null, 'last_year', null,
                                       'last_year_measured', false, 'waits_for', 'finance')
$$;

-- A funnel as jsonb: each stage in order with its cards and value.
create function pipeline.overview_funnel(p_kind text, p_params jsonb, p_day date) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('stage', f.stage_key, 'meaning', f.meaning,
           'name_en', f.name_en, 'name_ar', f.name_ar, 'optional', f.optional, 'n', f.n, 'value', f.value)
           order by f.sort, f.stage_key), '[]'::jsonb)
  from measure.pipeline_by_stage(p_kind, p_params, 'company', null, p_day) f
$$;

-- The Commercial overview (§6): p_period 'mtd', 'qtd', 'ytd' (to today, Riyadh) or 'custom' (p_from to p_to);
-- p_segment a Client-side type key, or none or 'all' for every segment.
create function pipeline.overview(p_period text default 'mtd', p_from date default null, p_to date default null,
                                  p_segment text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := core.riyadh_today();
  f date;
  t date;
  lf date;
  lt date;
  params jsonb := case when coalesce(pg_catalog.btrim(p_segment), '') in ('', 'all') then '{}'::jsonb
                       else pg_catalog.jsonb_build_object('segment', pg_catalog.btrim(p_segment)) end;
begin
  perform authz.require('overview', 'view');
  case p_period
    when 'mtd' then f := pg_catalog.date_trunc('month', today)::date; t := today;
    when 'qtd' then f := pg_catalog.date_trunc('quarter', today)::date; t := today;
    when 'ytd' then f := pg_catalog.date_trunc('year', today)::date; t := today;
    when 'custom' then f := p_from; t := p_to;
    else raise exception using errcode = 'P0001', message = 'overview.unknown_period', detail = coalesce(p_period, '');
  end case;
  if f is null or t is null or f > t then
    raise exception using errcode = 'P0001', message = 'overview.period_invalid';
  end if;
  perform measure.segment_id(params);
  lf := (f - interval '1 year')::date;
  lt := (t - interval '1 year')::date;
  return pg_catalog.jsonb_build_object(
    'period', pg_catalog.jsonb_build_object('kind', p_period, 'from', f, 'to', t),
    'last_year', pg_catalog.jsonb_build_object('from', lf, 'to', lt),
    'segment', params ->> 'segment',
    'tiles', pg_catalog.jsonb_build_object(
      'revenue', pipeline.overview_waits_for_finance(),
      'cost', pipeline.overview_waits_for_finance(),
      'profit', pipeline.overview_waits_for_finance(),
      'collections', pipeline.overview_waits_for_finance(),
      'clients', pg_catalog.jsonb_build_object(
        'sign_ups', pipeline.overview_tile(measure.partner_sign_ups(params, 'company', null, f, t),
                                           measure.partner_sign_ups(params, 'company', null, lf, lt)),
        'onboarded', pipeline.overview_tile(measure.partner_onboarded(params, 'company', null, f, t),
                                            measure.partner_onboarded(params, 'company', null, lf, lt)),
        'active', pipeline.overview_waits_for_finance()),
      'tenders_submitted', pipeline.overview_tile(measure.pipeline_tenders_submitted(params, 'company', null, f, t),
                                                  measure.pipeline_tenders_submitted(params, 'company', null, lf, lt)),
      'awarded_value', pipeline.overview_tile(measure.pipeline_awarded_value(params, 'company', null, f, t),
                                              measure.pipeline_awarded_value(params, 'company', null, lf, lt)),
      'partnerships_signed', pipeline.overview_tile(
        measure.pipeline_partnerships_signed(params, 'company', null, f, t),
        measure.pipeline_partnerships_signed(params, 'company', null, lf, lt)),
      'government_contracts', pipeline.overview_tile(
        measure.perf_government_contracts(params, 'company', null, f, t),
        measure.perf_government_contracts(params, 'company', null, lf, lt))),
    'funnels', pg_catalog.jsonb_build_object(
      'tenders', pipeline.overview_funnel('tender', params, t),
      'partnerships', pipeline.overview_funnel('partnership', params, t)));
end
$$;
revoke all on function pipeline.overview_tile(measure.result, measure.result), pipeline.overview_waits_for_finance(),
  pipeline.overview_funnel(text, jsonb, date) from public;
grant execute on function pipeline.overview(text, date, date, text) to authenticated;

create function api.overview(p_period text default 'mtd', p_from date default null, p_to date default null,
                             p_segment text default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select pipeline.overview(p_period, p_from, p_to, p_segment) $$;
grant execute on function api.overview(text, date, date, text) to authenticated;
