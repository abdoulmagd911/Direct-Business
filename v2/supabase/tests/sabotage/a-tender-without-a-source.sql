-- Sabotage: a-tender-without-a-source
-- Breaks: sql:PIPE-01
-- Expect: a tender without a Source is refused
-- A tender is saved without saying where it came from (V99).
create or replace function pipeline.tender_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  t pipeline.tender;
  v_partner uuid;
  v_owner uuid;
  dept uuid;
  first_stage pipeline.stage;
  tid uuid;
  req uuid;
  what text;
  d date := coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today());
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('title', 'partner_id', 'segment_reason', 'etimad_ref', 'tender_no', 'submission_due_on', 'value_sar',
                 'owner_id', 'source', 'project_id', 'notes', 'happened_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if p_id is not null then
    perform pipeline.card_editable('pipeline.tender', p_id);
    select * into t from pipeline.tender where id = p_id;
    if v ? 'happened_on' then
      raise exception using errcode = 'P0001', message = 'pipeline.date_is_the_moves';
    end if;
  else
    perform authz.require('pipeline', 'own');
  end if;
  v_partner := coalesce(nullif(v ->> 'partner_id', '')::uuid, t.partner_id);
  if v_partner is null then
    raise exception using errcode = 'P0001', message = 'tender.partner_required';
  end if;
  if (p_id is null or v_partner is distinct from t.partner_id)
     and not authz.can_see_as(me, 'partner.partner', v_partner) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  -- a government entity's (V80); another segment needs Full on the Pipeline and a reason
  if not pipeline.is_government(v_partner)
     and (p_id is null or v_partner is distinct from t.partner_id or v ? 'segment_reason') then
    if authz.level_of(me, 'pipeline') < 'full' then
      raise exception using errcode = '42501', message = 'tender.not_government';
    end if;
    if nullif(pg_catalog.btrim(coalesce(v ->> 'segment_reason', t.segment_reason)), '') is null then
      raise exception using errcode = 'P0001', message = 'tender.segment_reason_required';
    end if;
  end if;
  v_owner := coalesce(nullif(v ->> 'owner_id', '')::uuid, t.owner_id, me);
  if v_owner is distinct from coalesce(t.owner_id, me) and not authz.can('pipeline.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'pipeline.assign';
  end if;
  if nullif(v ->> 'project_id', '') is not null and work.row_level('work.project', (v ->> 'project_id')::uuid, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.project';
  end if;
  begin
    if p_id is null then
      select x.department_id into dept from core.person x where x.id = v_owner;
      first_stage := (select s from pipeline.stage s where s.kind = 'tender' and s.meaning = 'identified'
                      and s.deleted_at is null);
      req := audit.begin('ui', 'tender.created', null);
      perform audit.happened(nullif(v ->> 'happened_on', '')::date);
      insert into pipeline.tender (number, title, partner_id, segment_reason, etimad_ref, tender_no, submission_due_on,
                                   value_sar, stage_id, owner_id, department_id, source_id, project_id, notes)
      values (core.format_number('TND', pg_catalog.date_part('year', core.riyadh_today())::int,
                                 core.next_number('tender', pg_catalog.date_part('year', core.riyadh_today())::int), 3),
              pg_catalog.btrim(v ->> 'title'), v_partner,
              case when pipeline.is_government(v_partner) then null else pg_catalog.btrim(v ->> 'segment_reason') end,
              nullif(pg_catalog.btrim(v ->> 'etimad_ref'), ''), nullif(pg_catalog.btrim(v ->> 'tender_no'), ''),
              nullif(v ->> 'submission_due_on', '')::date, nullif(v ->> 'value_sar', '')::numeric, first_stage.id, v_owner,
              dept, coalesce(pipeline.list_id('pipeline.source', null, v ->> 'source'), (select x.id from pipeline.source x order by x.sort limit 1)), nullif(v ->> 'project_id', '')::uuid,
              nullif(pg_catalog.btrim(v ->> 'notes'), ''))
      returning id into tid;
      insert into pipeline.stage_change (entity_table, entity_id, to_stage_id, happened_on)
      values ('pipeline.tender', tid, first_stage.id, d);
    else
      perform core.check_version('pipeline.tender', p_id, p_version, array(select pg_catalog.jsonb_object_keys(v)));
      req := audit.begin('ui', 'tender.changed', pg_catalog.jsonb_build_object('number', t.number));
      update pipeline.tender set
        title = case when v ? 'title' then pg_catalog.btrim(v ->> 'title') else title end,
        partner_id = case when v ? 'partner_id' then v_partner else partner_id end,
        segment_reason = case when pipeline.is_government(v_partner) then null
                              when v ? 'segment_reason' then pg_catalog.btrim(v ->> 'segment_reason') else segment_reason end,
        etimad_ref = case when v ? 'etimad_ref' then nullif(pg_catalog.btrim(v ->> 'etimad_ref'), '') else etimad_ref end,
        tender_no = case when v ? 'tender_no' then nullif(pg_catalog.btrim(v ->> 'tender_no'), '') else tender_no end,
        submission_due_on = case when v ? 'submission_due_on' then nullif(v ->> 'submission_due_on', '')::date
                                 else submission_due_on end,
        value_sar = case when v ? 'value_sar' then nullif(v ->> 'value_sar', '')::numeric else value_sar end,
        owner_id = v_owner,
        source_id = case when v ? 'source' then pipeline.list_id('pipeline.source', null, v ->> 'source') else source_id end,
        project_id = case when v ? 'project_id' then nullif(v ->> 'project_id', '')::uuid else project_id end,
        notes = case when v ? 'notes' then nullif(pg_catalog.btrim(v ->> 'notes'), '') else notes end
      where id = p_id;
      tid := p_id;
    end if;
  exception
    when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = pipeline.refused(what);
    when not_null_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'pipeline.' || what || '_required';
    when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
      raise exception using errcode = 'P0001', message = 'common.invalid', detail = sqlerrm;
  end;
  if v_owner is distinct from t.owner_id then
    perform notify.push_assigned(v_owner, 'assigned', 'pipeline.tender', tid);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', tid, 'request_id', req,
    'number', (select x.number from pipeline.tender x where x.id = tid),
    'version', (select x.version from pipeline.tender x where x.id = tid));
end
$$;
