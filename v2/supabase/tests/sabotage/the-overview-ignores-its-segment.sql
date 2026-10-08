-- Sabotage: the-overview-ignores-its-segment
-- Breaks: sql:FLOW-11
-- Expect: under Corporate there are none
-- The tenders submitted tile counts every segment whichever one the switch names (V64, V80).
create or replace function pipeline.overview(p_period text default 'mtd', p_from date default null, p_to date default null,
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
      'tenders_submitted', pipeline.overview_tile(measure.pipeline_tenders_submitted('{}', 'company', null, f, t),
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
