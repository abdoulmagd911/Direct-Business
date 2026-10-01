-- Sabotage: an-undated-achievement-dated-today
-- Breaks: sql:ACH-05
-- Expect: an undated row takes the report's last day
-- An undated row takes today instead of its report's last day (V504).
create or replace function perf.backfill_achievements(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'own');
  full_access boolean := authz.level_of(authz.me(), 'kpis') >= 'full';
  src jsonb := p_request -> 'source';
  last_day date := nullif(src ->> 'last_day', '')::date;
  r jsonb;
  i int := -1;
  day date;
  first_day date;
  owner uuid;
  dept uuid;
  pl uuid;
  c perf.achievement_category;
  pid uuid;
  val numeric;
  cur perf.achievement;
  aid uuid;
  req uuid;
  what text;
  ids uuid[] := '{}';
  touched uuid[] := '{}';
  held jsonb := '[]'::jsonb;
  updated jsonb := '[]'::jsonb;
  kept jsonb := '[]'::jsonb;
  repeats jsonb := '[]'::jsonb;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request -> 'rows') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request -> 'rows') = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if coalesce(p_request ->> 'mode', 'achievements') <> 'achievements'
     or coalesce(p_request ->> 'origin', 'backfill') <> 'backfill' then
    raise exception using errcode = 'P0001', message = 'backfill.mode_invalid';
  end if;
  if src ->> 'kind' is null or src ->> 'kind' not in ('bd_monthly', 'partnerships', 'commercial_quarterly', 'improvements')
     or perf.period_last_day(src ->> 'period') is null or last_day is distinct from perf.period_last_day(src ->> 'period')
     or ((src ->> 'kind' = 'commercial_quarterly') <> (src ->> 'period' ~ 'Q')) then
    raise exception using errcode = 'P0001', message = 'backfill.source_required';
  end if;
  if last_day > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  req := audit.begin('ui', 'achievement.backfilled', pg_catalog.jsonb_build_object(
    'count', pg_catalog.jsonb_array_length(p_request -> 'rows'), 'source', src ->> 'kind', 'period', src ->> 'period'));
  for r in select x from pg_catalog.jsonb_array_elements(p_request -> 'rows') x loop
    i := i + 1;
    val := nullif(r ->> 'value', '')::numeric;
    if val < 0 then
      raise exception using errcode = 'P0001', message = 'achievement.value_invalid', detail = i::text;
    end if;
    -- A key already held: left out — or its deal value taken from a newer report (V502).
    select * into cur from perf.achievement a
    where a.import_key = nullif(r ->> 'import_key', '') and a.deleted_at is null;
    if cur.id is not null then
      if val is not null and val is distinct from cur.deal_value then
        if not perf.can_edit(me, cur) then
          raise exception using errcode = '42501', message = 'access.needs_level',
            detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'own', 'row', i)::text;
        end if;
        if cur.deal_value is null
           or (cur.value_report_kind is not null
               and perf.report_newer(src ->> 'kind', src ->> 'period', cur.value_report_kind, cur.value_report_period)) then
          begin
            update perf.achievement set deal_value = val, value_report_kind = src ->> 'kind',
              value_report_period = src ->> 'period'
            where id = cur.id;
          exception
            when check_violation then
              get stacked diagnostics what = constraint_name;
              raise exception using errcode = 'P0001', message = perf.achievement_refused(what), detail = i::text;
            when raise_exception then
              get stacked diagnostics what = message_text;
              raise exception using errcode = 'P0001', message = what, detail = i::text;
          end;
          updated := updated || pg_catalog.to_jsonb(cur.import_key);
          touched := touched || cur.id;
          first_day := least(coalesce(first_day, cur.happened_on), cur.happened_on);
          continue;
        end if;
        if cur.value_report_kind is null then
          kept := kept || pg_catalog.to_jsonb(cur.import_key);
          continue;
        end if;
      end if;
      held := held || pg_catalog.to_jsonb(cur.import_key);
      continue;
    end if;
    day := coalesce(nullif(r ->> 'happened_on', '')::date, core.riyadh_today());
    if day < date '2025-01-01' then
      raise exception using errcode = 'P0001', message = 'backfill.before_2025', detail = i::text;
    end if;
    if day > core.riyadh_today() then
      raise exception using errcode = 'P0001', message = 'common.date_in_future', detail = i::text;
    end if;
    owner := case when coalesce((r ->> 'owner_unknown')::boolean, false) then null
                  else coalesce(nullif(r ->> 'person_id', '')::uuid, me) end;
    if owner is distinct from me and not full_access then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'full', 'row', i)::text;
    end if;
    dept := coalesce((select p.department_id from core.person p where p.id = owner),
                     (select p.department_id from core.person p where p.id = me));
    if not perf.sees_department(me, dept) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = i::text;
    end if;
    pl := perf.plan_of(dept, pg_catalog.date_part('year', day)::int);
    if pl is null then
      raise exception using errcode = 'P0001', message = 'achievement.no_plan',
        detail = i::text || ':' || pg_catalog.date_part('year', day)::int;
    end if;
    c := perf.category_in(pl, r ->> 'kind');
    if c.id is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = i::text;
    end if;
    -- A category's required reference is asked of live work only: the report stands as past work's evidence (V506).
    pid := nullif(r ->> 'organisation_id', '')::uuid;
    if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = i::text;
    end if;
    begin
      insert into perf.achievement (number, plan_id, department_id, category_id, partner_id, title, notes, deal_value,
                                    value_report_kind, value_report_period, happened_on, owner_id, origin, source_kind,
                                    source_period, date_from_report, import_key)
      values (perf.number_for(pg_catalog.date_part('year', day)::int), pl, dept, c.id, pid, pg_catalog.btrim(r ->> 'title'), nullif(pg_catalog.btrim(r ->> 'notes'), ''), val,
              case when val is not null then src ->> 'kind' end, case when val is not null then src ->> 'period' end,
              day, owner, 'backfill', src ->> 'kind', src ->> 'period', nullif(r ->> 'happened_on', '') is null,
              nullif(r ->> 'import_key', ''))
      returning id into aid;
    exception
      when check_violation or not_null_violation then
        get stacked diagnostics what = constraint_name;
        raise exception using errcode = 'P0001', message = perf.achievement_refused(coalesce(what, 'achievement_title_check')),
          detail = i::text;
      when raise_exception then
        get stacked diagnostics what = message_text;
        raise exception using errcode = 'P0001', message = what, detail = i::text;
    end;
    ids := ids || aid;
    first_day := least(coalesce(first_day, day), day);
    -- V531: a paste never prompts; it names the rows that may repeat an earlier achievement.
    if pid is not null then
      repeats := repeats || (select pg_catalog.jsonb_build_object('row', i, 'id', aid, 'matches', m)
                             from (select perf.repeats_for(me, pid, c.code, r ->> 'title', day, aid) as m) x
                             where m <> '[]'::jsonb);
    end if;
  end loop;
  if first_day is not null then
    perform audit.happened(least(first_day, core.riyadh_today() - 1));    -- past work tells nobody (V491)
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object(
    'request_id', case when pg_catalog.cardinality(ids) + pg_catalog.cardinality(touched) > 0 then req end,
    'saved', pg_catalog.cardinality(ids), 'ids', pg_catalog.to_jsonb(ids),
    'held', held, 'updated', updated, 'kept', kept, 'repeats', repeats);
end
$$;
