-- P5-8 (part 2) · the pipeline measures (TECH-SPEC §3.7a "Measures", §3.8; V80, V99, V400, V503, V64):
-- pipeline.tenders_submitted, pipeline.tenders_signed, pipeline.awarded_value, pipeline.partnerships_signed,
-- pipeline.partnerships_onboarded, and the two funnels pipeline.tenders_by_stage and pipeline.opportunities_by_stage.
-- Each is a function measure.pipeline_<name>(params, scope_kind, scope_id, from, to), with an _items twin for the
-- drill-down, the shape of the work measures (P5-1). Scopes: company, department (the card's), team (its owner's),
-- person (its owner), partner (its organisation). params.segment, a Client-side type key (V64, V98), keeps one
-- segment's cards: a tender's project's segment, else the organisation's Client type; an opportunity for the Client
-- side the type it would become, else the organisation's Client type. Every date is the history's happened_on (V400):
-- a card counts in the period it reached a stage, entered or passed on the way, whenever that was typed; a later Lost,
-- or a move back, never takes it out. Counts are always measured: nothing is a real 0. Inside the database only — the
-- Overview and the KPI reads (P5-10, P5-4) call them after their own access checks. Also: a file on a card is named
-- with it — the Tender document (V55). Forward-only.

-- ================================================================ the shared pieces
-- The segment params name, by its key: a type of the Client side; none means every segment.
create function measure.segment_id(p_params jsonb) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  k text := nullif(pg_catalog.btrim(p_params ->> 'segment'), '');
  r uuid;
begin
  if k is null then
    return null;
  end if;
  select t.id into r from partner.side_type t where t.side = 'client' and t.key = k and t.deleted_at is null;
  if r is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = 'segment:' || k;
  end if;
  return r;
end
$$;

-- An organisation's segment: its Client side's type, while it has that side.
create function measure.client_segment(p_partner uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select s.type_id from partner.partner_side s
  where s.partner_id = p_partner and s.side = 'client' and s.deleted_at is null
  order by s.created_at desc limit 1
$$;

-- The live cards of one board ('tender' or 'partnership') in a scope and segment, with the values the measures add up.
create function measure.pipeline_cards(p_kind text, p_params jsonb, p_scope_kind text, p_scope_id uuid)
  returns table (card_table text, card_id uuid, card_owner uuid, card_value numeric, card_awarded numeric,
                 card_awarded_on date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
begin
  perform measure.check_scope(p_scope_kind);
  if p_kind = 'tender' then
    return query
    select 'pipeline.tender'::text, t.id, t.owner_id, t.value_sar::numeric, t.awarded_value_sar::numeric, t.awarded_on
    from pipeline.tender t
    join core.person p on p.id = t.owner_id
    left join work.project pr on pr.id = t.project_id
    where t.deleted_at is null
      and measure.in_scope(p_scope_kind, p_scope_id, t.owner_id, p.team_id, t.department_id, t.partner_id)
      and (seg is null or coalesce(pr.segment_id, measure.client_segment(t.partner_id)) = seg);
  elsif p_kind = 'partnership' then
    return query
    select 'pipeline.opportunity'::text, o.id, o.owner_id, o.expected_value_sar::numeric, null::numeric, null::date
    from pipeline.opportunity o
    join core.person p on p.id = o.owner_id
    where o.deleted_at is null
      and measure.in_scope(p_scope_kind, p_scope_id, o.owner_id, p.team_id, o.department_id, o.partner_id)
      and (seg is null or case when o.side = 'client' then o.type_id
                               else measure.client_segment(o.partner_id) end = seg);
  else
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = p_kind;
  end if;
end
$$;

-- The first day a card reached a stage of this meaning — entered or passed on the way — if it ever did.
create function measure.pipeline_reached_on(p_table text, p_id uuid, p_meaning text) returns date
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.min(c.happened_on)
  from pipeline.stage_change c join pipeline.stage s on s.id = c.to_stage_id
  where c.entity_table = p_table and c.entity_id = p_id and c.deleted_at is null and s.meaning = p_meaning
$$;

-- The stage a card stood in at the end of a day, and the day it entered it: the last of its history up to that day.
create function measure.pipeline_stage_on(p_table text, p_id uuid, p_day date) returns table (stage_id uuid, since date)
language sql stable security definer set search_path = ''
as $$
  select c.to_stage_id, c.happened_on from pipeline.stage_change c
  where c.entity_table = p_table and c.entity_id = p_id and c.deleted_at is null and c.happened_on <= p_day
  order by c.happened_on desc, c.seq desc limit 1
$$;

-- The cards of one board that first reached a meaning inside the period. A count: nothing is a real 0.
create function measure.pipeline_reached_items(p_kind text, p_meaning text, p_params jsonb, p_scope_kind text,
                                               p_scope_id uuid, p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select x.card_table, x.card_id, x.card_owner, x.reached, true
  from (select c.card_table, c.card_id, c.card_owner,
               measure.pipeline_reached_on(c.card_table, c.card_id, p_meaning) as reached
        from measure.pipeline_cards(p_kind, p_params, p_scope_kind, p_scope_id) c) x
  where x.reached between p_from and p_to
  order by x.reached, x.card_id
$$;

-- A funnel as of a day: every stage of the board in its order, with the cards standing in it at the end of that day
-- and their value — a tender's value, its awarded value once Awarded or Signed; an opportunity's expected value.
-- A retired stage shows only while cards still stand in it.
create function measure.pipeline_by_stage(p_kind text, p_params jsonb, p_scope_kind text, p_scope_id uuid, p_day date)
  returns table (stage_id uuid, stage_key text, meaning text, name_en text, name_ar text, optional boolean, sort int,
                 n int, value numeric)
language sql stable security definer set search_path = ''
as $$
  with standing as (
    select c.card_id, c.card_value, c.card_awarded, st.stage_id
    from measure.pipeline_cards(p_kind, p_params, p_scope_kind, p_scope_id) c
    cross join lateral measure.pipeline_stage_on(c.card_table, c.card_id, p_day) st)
  select s.id, s.key, s.meaning, s.name_en, s.name_ar, s.optional, s.sort, pg_catalog.count(a.card_id)::int,
         coalesce(pg_catalog.sum(case when s.meaning in ('awarded', 'signed') then coalesce(a.card_awarded, a.card_value)
                                      else a.card_value end), 0)
  from pipeline.stage s left join standing a on a.stage_id = s.id
  where s.kind = p_kind and s.deleted_at is null
  group by s.id
  having s.active or pg_catalog.count(a.card_id) > 0
  order by s.sort, s.key
$$;

-- The cards standing in one stage (params.stage, a key; none: every stage) at the end of a day, dated the day each
-- entered it — the funnel's drill-down.
create function measure.pipeline_by_stage_items(p_kind text, p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                p_day date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select c.card_table, c.card_id, c.card_owner, st.since, true
  from measure.pipeline_cards(p_kind, p_params, p_scope_kind, p_scope_id) c
  cross join lateral measure.pipeline_stage_on(c.card_table, c.card_id, p_day) st
  join pipeline.stage s on s.id = st.stage_id
  where nullif(p_params ->> 'stage', '') is null or s.key = p_params ->> 'stage'
  order by s.sort, st.since, c.card_id
$$;

-- ================================================================ tenders
-- Tenders submitted (§3.7a): whose history reached Submitted inside the period — a later Lost still counts.
create function measure.pipeline_tenders_submitted_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                         p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$ select * from measure.pipeline_reached_items('tender', 'submitted', p_params, p_scope_kind, p_scope_id, p_from, p_to) $$;
create function measure.pipeline_tenders_submitted(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                   p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.pipeline_tenders_submitted_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- Tenders signed (V503): whose history reached Signed inside the period — the contracts, counted at signing.
create function measure.pipeline_tenders_signed_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                      p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$ select * from measure.pipeline_reached_items('tender', 'signed', p_params, p_scope_kind, p_scope_id, p_from, p_to) $$;
create function measure.pipeline_tenders_signed(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.pipeline_tenders_signed_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- Awarded value (§3.7a, V503): the awarded values of the tenders awarded inside the period, by their award date — a
-- measure of awards, never of contracts. Always measured: no award is a real 0.
create function measure.pipeline_awarded_value_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                     p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select c.card_table, c.card_id, c.card_owner, c.card_awarded_on, true
  from measure.pipeline_cards('tender', p_params, p_scope_kind, p_scope_id) c
  where c.card_awarded_on between p_from and p_to and c.card_awarded is not null
  order by c.card_awarded_on, c.card_id
$$;
create function measure.pipeline_awarded_value(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                               p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(pg_catalog.sum(c.card_awarded), 0), true, pg_catalog.count(*)::int)::measure.result
  from measure.pipeline_cards('tender', p_params, p_scope_kind, p_scope_id) c
  where c.card_awarded_on between p_from and p_to and c.card_awarded is not null
$$;

-- The tenders' funnel as of the period's last day.
create function measure.pipeline_tenders_by_stage(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                  p_to date)
  returns table (stage_id uuid, stage_key text, meaning text, name_en text, name_ar text, optional boolean, sort int,
                 n int, value numeric)
language sql stable security definer set search_path = ''
as $$ select * from measure.pipeline_by_stage('tender', p_params, p_scope_kind, p_scope_id, p_to) $$;
create function measure.pipeline_tenders_by_stage_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                        p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$ select * from measure.pipeline_by_stage_items('tender', p_params, p_scope_kind, p_scope_id, p_to) $$;

-- ================================================================ partnerships
-- Partnerships signed and onboarded (V99): opportunities whose history reached Signed, or Onboarded, inside the period.
create function measure.pipeline_partnerships_signed_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                           p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$ select * from measure.pipeline_reached_items('partnership', 'signed', p_params, p_scope_kind, p_scope_id, p_from, p_to) $$;
create function measure.pipeline_partnerships_signed(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                     p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.pipeline_partnerships_signed_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

create function measure.pipeline_partnerships_onboarded_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                              p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$ select * from measure.pipeline_reached_items('partnership', 'onboarded', p_params, p_scope_kind, p_scope_id, p_from, p_to) $$;
create function measure.pipeline_partnerships_onboarded(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                        p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select measure.tally(pg_catalog.array_agg(i))
  from measure.pipeline_partnerships_onboarded_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- The opportunities' funnel as of the period's last day.
create function measure.pipeline_opportunities_by_stage(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                        p_to date)
  returns table (stage_id uuid, stage_key text, meaning text, name_en text, name_ar text, optional boolean, sort int,
                 n int, value numeric)
language sql stable security definer set search_path = ''
as $$ select * from measure.pipeline_by_stage('partnership', p_params, p_scope_kind, p_scope_id, p_to) $$;
create function measure.pipeline_opportunities_by_stage_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                              p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$ select * from measure.pipeline_by_stage_items('partnership', p_params, p_scope_kind, p_scope_id, p_to) $$;

-- ================================================================ a card's files (§3.4, V55)
-- A file on a card — a tender's Tender document, an opportunity's attachment — is named with the card: {record} its
-- number and title, the organisation's tokens beside them.
create function pipeline.tender_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select partner.partner_file_tokens(t.partner_id, p_locale) || pg_catalog.jsonb_build_object(
    'number', t.number, 'title', t.title, 'record', t.number || ' · ' || t.title)
  from pipeline.tender t where t.id = p_id
$$;
create function pipeline.opportunity_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select partner.partner_file_tokens(o.partner_id, p_locale) || pg_catalog.jsonb_build_object(
    'number', o.number, 'title', o.title, 'record', o.number || ' · ' || o.title)
  from pipeline.opportunity o where o.id = p_id
$$;
revoke all on function pipeline.tender_file_tokens(uuid, text), pipeline.opportunity_file_tokens(uuid, text) from public;

-- Inside the database only: the Overview and the KPI reads (P5-10, P5-4) call them after their own access checks.
revoke all on function
  measure.segment_id(jsonb), measure.client_segment(uuid), measure.pipeline_cards(text, jsonb, text, uuid),
  measure.pipeline_reached_on(text, uuid, text), measure.pipeline_stage_on(text, uuid, date),
  measure.pipeline_reached_items(text, text, jsonb, text, uuid, date, date),
  measure.pipeline_by_stage(text, jsonb, text, uuid, date),
  measure.pipeline_by_stage_items(text, jsonb, text, uuid, date),
  measure.pipeline_tenders_submitted_items(jsonb, text, uuid, date, date),
  measure.pipeline_tenders_submitted(jsonb, text, uuid, date, date),
  measure.pipeline_tenders_signed_items(jsonb, text, uuid, date, date),
  measure.pipeline_tenders_signed(jsonb, text, uuid, date, date),
  measure.pipeline_awarded_value_items(jsonb, text, uuid, date, date),
  measure.pipeline_awarded_value(jsonb, text, uuid, date, date),
  measure.pipeline_tenders_by_stage(jsonb, text, uuid, date, date),
  measure.pipeline_tenders_by_stage_items(jsonb, text, uuid, date, date),
  measure.pipeline_partnerships_signed_items(jsonb, text, uuid, date, date),
  measure.pipeline_partnerships_signed(jsonb, text, uuid, date, date),
  measure.pipeline_partnerships_onboarded_items(jsonb, text, uuid, date, date),
  measure.pipeline_partnerships_onboarded(jsonb, text, uuid, date, date),
  measure.pipeline_opportunities_by_stage(jsonb, text, uuid, date, date),
  measure.pipeline_opportunities_by_stage_items(jsonb, text, uuid, date, date)
from public;
