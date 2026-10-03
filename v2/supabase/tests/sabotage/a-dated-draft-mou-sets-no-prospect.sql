-- Sabotage: a-dated-draft-mou-sets-no-prospect
-- Breaks: sql:ACH-09
-- Expect: dated, the side is Prospect
-- Only the log sets an MoU's Prospect; a draft MoU dated later never does (QA-513).
create or replace function perf.achievement_update(p_id uuid, p_values jsonb, p_version int, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a perf.achievement := perf.achievement_editable(p_id);
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  cat uuid := a.category_id;
  pid uuid := a.partner_id;
  day date := a.happened_on;
  side text := a.mou_side;
  prospect boolean;
  was_ready boolean;
  sid uuid;
  req uuid;
  what text;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' or v = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('category', 'title', 'notes', 'happened_on', 'partner_id', 'count', 'deal_value', 'use_as_example',
                 'before_value', 'after_value', 'side') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if not perf.is_own(me, a) and nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  perform core.check_version('perf.achievement', p_id, p_version,
    array(select case x when 'category' then 'category_id' when 'side' then 'mou_side' else x end
          from pg_catalog.jsonb_object_keys(v) x));
  if v ? 'happened_on' then
    day := nullif(v ->> 'happened_on', '')::date;
    if day > core.riyadh_today() then
      raise exception using errcode = 'P0001', message = 'common.date_in_future';
    end if;
    if day is null and a.happened_on is not null then
      raise exception using errcode = 'P0001', message = 'achievement.date_required';
    end if;
  end if;
  if v ? 'category' then
    cat := (perf.category_in(a.plan_id, v ->> 'category')).id;
    if cat is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = coalesce(v ->> 'category', '');
    end if;
  end if;
  if v ? 'partner_id' then
    pid := nullif(v ->> 'partner_id', '')::uuid;
    if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
    end if;
  end if;
  -- V521: an MoU with an organisation names its side.
  if v ? 'side' then
    side := nullif(v ->> 'side', '');
    if side is not null and side not in ('client', 'supplier_partner') then
      raise exception using errcode = 'P0001', message = 'achievement.side_required';
    end if;
  end if;
  was_ready := perf.category_sets_prospect(a.category_id) and a.partner_id is not null and a.mou_side is not null
               and a.happened_on is not null;
  prospect := perf.category_sets_prospect(cat);
  if not prospect then
    side := null;
  elsif pid is not null and side is null and (v ? 'category' or v ? 'partner_id' or v ? 'side') and a.origin <> 'backfill' then
    raise exception using errcode = 'P0001', message = 'achievement.side_required';
  end if;
  req := audit.begin('ui', 'achievement.changed', null, nullif(pg_catalog.btrim(p_reason), ''));
  perform perf.quiet_if_past(array[p_id]);
  begin
    update perf.achievement x set
      category_id = cat,
      partner_id = pid,
      happened_on = day,
      title = case when v ? 'title' then pg_catalog.btrim(v ->> 'title') else x.title end,
      notes = case when v ? 'notes' then nullif(pg_catalog.btrim(v ->> 'notes'), '') else x.notes end,
      count = case when v ? 'count' then (v ->> 'count')::int else x.count end,
      deal_value = case when v ? 'deal_value' then (v ->> 'deal_value')::numeric else x.deal_value end,
      value_report_kind = case when v ? 'deal_value' then null else x.value_report_kind end,
      value_report_period = case when v ? 'deal_value' then null else x.value_report_period end,
      use_as_example = case when v ? 'use_as_example' then coalesce((v ->> 'use_as_example')::boolean, false)
                            else x.use_as_example end,
      before_value = case when v ? 'before_value' then (v ->> 'before_value')::numeric else x.before_value end,
      after_value = case when v ? 'after_value' then (v ->> 'after_value')::numeric else x.after_value end,
      mou_side = side,
      mou_status_id = coalesce(sid, x.mou_status_id)
    where x.id = p_id;
  exception when check_violation or not_null_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = perf.achievement_refused(coalesce(what, 'achievement_title_check'));
  end;
  -- Re-filed under a category that needs a reference, live work brings it first (V99).
  if exists (select 1 from perf.achievement y join perf.achievement_category c on c.id = y.category_id
             where y.id = p_id and y.origin <> 'backfill' and c.required_ref_system_id is not null
               and not exists (select 1 from perf.achievement_ref r where r.achievement_id = y.id
                               and r.system_id = c.required_ref_system_id and r.deleted_at is null)) then
    raise exception using errcode = 'P0001', message = 'achievement.ref_required',
      detail = (select s.key from perf.achievement y join perf.achievement_category c on c.id = y.category_id
                join work.ref_system s on s.id = c.required_ref_system_id where y.id = p_id);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from perf.achievement x where x.id = p_id),
                                       'request_id', req);
end
$$;
