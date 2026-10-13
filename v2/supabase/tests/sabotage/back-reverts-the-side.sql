-- Sabotage: back-reverts-the-side
-- Breaks: sql:PIPE-03
-- Expect: the organisation keeps its status
-- Moving a card back from Onboarded silently reverts the organisation's status (OLD-WRK-069).
create or replace function pipeline.move(p_entity text, p_id uuid, p_stage text, p_happened_on date default null,
                              p_values jsonb default null, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  tbl text := case p_entity when 'tender' then 'pipeline.tender' when 'opportunity' then 'pipeline.opportunity' end;
  v_kind text := case p_entity when 'tender' then 'tender' else 'partnership' end;
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  card jsonb;
  cur pipeline.stage;
  s pipeline.stage;
  x pipeline.stage;
  d date := coalesce(p_happened_on, core.riyadh_today());
  last_on date;
  backward boolean;
  reason text := nullif(pg_catalog.btrim(v ->> 'note'), '');
  lost uuid;
  passed text[] := '{}';
  prev uuid;
  req uuid;
  offers text[] := '{}';
  reached text[];
  side_type uuid;
  logs_contract boolean := false;
  contract jsonb;
begin
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'pipeline.unknown_board', detail = p_entity;
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('note', 'lost_reason', 'awarded_value_sar', 'ticket_ref') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  perform pipeline.card_editable(tbl, p_id);
  execute pg_catalog.format('select pg_catalog.to_jsonb(c) from %s c where c.id = $1', tbl::regclass) into card using p_id;
  select * into cur from pipeline.stage where id = (card ->> 'stage_id')::uuid;
  s := pipeline.stage_of(v_kind, p_stage);
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'pipeline.unknown_stage', detail = p_stage;
  end if;
  if s.id = cur.id then
    raise exception using errcode = 'P0001', message = 'pipeline.same_stage';
  end if;
  if d > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  select pg_catalog.max(c.happened_on) into last_on from pipeline.stage_change c
  where c.entity_table = tbl and c.entity_id = p_id and c.deleted_at is null;
  if d < last_on then
    raise exception using errcode = 'P0001', message = 'pipeline.before_last_move', detail = last_on::text;
  end if;
  backward := s.sort < cur.sort;
  if backward and reason is null then
    raise exception using errcode = 'P0001', message = 'pipeline.backward_needs_reason';
  end if;
  if s.meaning in ('lost', 'cancelled') then
    lost := pipeline.list_id('pipeline.lost_reason', v_kind, v ->> 'lost_reason');
    if lost is null then
      raise exception using errcode = 'P0001', message = 'pipeline.lost_needs_reason';
    end if;
  end if;
  if p_version is not null then                          -- a drag on the board names none; the stage field does
    perform core.check_version(tbl, p_id, p_version, array['stage_id']);
  end if;

  -- the meanings reached: the target's, and on a forward move each required stage's on the way
  reached := array[s.meaning];
  if not backward and s.meaning not in ('lost', 'cancelled') then
    for x in select * from pipeline.stage y
             where y.kind = v_kind and y.deleted_at is null and y.active and not y.optional
               and y.meaning not in ('lost', 'cancelled') and y.sort > cur.sort and y.sort < s.sort
             order by y.sort loop
      passed := passed || x.id::text;
      reached := reached || x.meaning;
    end loop;
  end if;
  if v_kind = 'tender' and 'awarded' = any (reached)
     and coalesce(nullif(v ->> 'awarded_value_sar', '')::numeric, (card ->> 'awarded_value_sar')::numeric) is null then
    raise exception using errcode = 'P0001', message = 'tender.awarded_needs_value';
  end if;
  if v_kind = 'partnership' and 'handed_over' = any (reached)
     and coalesce(nullif(pg_catalog.btrim(v ->> 'ticket_ref'), ''), card ->> 'ticket_ref') is null then
    raise exception using errcode = 'P0001', message = 'opportunity.handover_needs_ticket';
  end if;

  -- V603: a tender moving forward into Signed logs its Contract signed in this request, unless it has one or its
  -- owner's department has no plan, or no Contract signed category, for the signing year
  logs_contract := v_kind = 'tender' and not backward and s.meaning = 'signed'
                   and perf.tender_contract(p_id) is null and perf.contract_category_for_tender(p_id, d) is not null;
  req := audit.begin('ui', case when logs_contract then 'tender.signed' else 'pipeline.moved' end,
                     pg_catalog.jsonb_build_object('number', card ->> 'number', 'stage', s.key), reason);
  perform audit.happened(p_happened_on);
  prev := cur.id;
  foreach k in array passed loop
    insert into pipeline.stage_change (entity_table, entity_id, from_stage_id, to_stage_id, passed, happened_on)
    values (tbl, p_id, prev, k::uuid, true, d);
    prev := k::uuid;
  end loop;
  insert into pipeline.stage_change (entity_table, entity_id, from_stage_id, to_stage_id, happened_on, note)
  values (tbl, p_id, prev, s.id, d, reason);

  if v_kind = 'tender' then
    update pipeline.tender t set
      stage_id = s.id,
      submitted_on = case when not backward and 'submitted' = any (reached) then d
                          when backward and s.sort < (select y.sort from pipeline.stage y where y.kind = 'tender'
                                                      and y.meaning = 'submitted' and y.deleted_at is null) then null
                          else t.submitted_on end,
      awarded_value_sar = coalesce(nullif(v ->> 'awarded_value_sar', '')::numeric, t.awarded_value_sar),
      awarded_on = case when not backward and 'awarded' = any (reached) then d
                        when backward and s.sort < (select y.sort from pipeline.stage y where y.kind = 'tender'
                                                    and y.meaning = 'awarded' and y.deleted_at is null) then null
                        else t.awarded_on end,
      signed_on = case when not backward and 'signed' = any (reached) then d
                       when backward and s.sort < (select y.sort from pipeline.stage y where y.kind = 'tender'
                                                   and y.meaning = 'signed' and y.deleted_at is null) then null
                       else t.signed_on end,
      lost_reason_id = case when s.meaning in ('lost', 'cancelled') then lost else null end
    where t.id = p_id;
    if logs_contract then
      contract := perf.contract_from_tender(p_id, d);
    end if;
    if s.meaning = 'signed' then
      offers := case when perf.tender_contract(p_id) is null then array['log_achievement', 'new_project']
                     else array['new_project'] end;
    end if;
  else
    update pipeline.opportunity o set
      stage_id = s.id,
      ticket_ref = coalesce(nullif(pg_catalog.btrim(v ->> 'ticket_ref'), ''), o.ticket_ref),
      signed_on = case when not backward and 'signed' = any (reached) then d
                       when backward and s.sort < (select y.sort from pipeline.stage y where y.kind = 'partnership'
                                                   and y.meaning = 'signed' and y.deleted_at is null) then null
                       else o.signed_on end,
      handed_over_on = case when not backward and 'handed_over' = any (reached) then d
                            when backward and s.sort < (select y.sort from pipeline.stage y where y.kind = 'partnership'
                                                        and y.meaning = 'handed_over' and y.deleted_at is null) then null
                            else o.handed_over_on end,
      onboarded_on = case when not backward and 'onboarded' = any (reached) then d
                          when backward and s.sort < (select y.sort from pipeline.stage y where y.kind = 'partnership'
                                                      and y.meaning = 'onboarded' and y.deleted_at is null) then null
                          else o.onboarded_on end,
      lost_reason_id = case when s.meaning = 'lost' then lost else null end
    where o.id = p_id;
    -- Onboarded: the organisation's side switched on when it is not, and Active from that day (V99)
    if s.meaning = 'onboarded' then
      side_type := (card ->> 'type_id')::uuid;
      if not partner.side_on((card ->> 'partner_id')::uuid, card ->> 'side') then
        perform partner.side_put((card ->> 'partner_id')::uuid, card ->> 'side',
          pg_catalog.jsonb_build_object('type_id', side_type, 'owner_id', card ->> 'owner_id'),
          'onboarded: ' || (card ->> 'number'));
      end if;
      if partner.status_of((card ->> 'partner_id')::uuid, card ->> 'side', d) is distinct from 'active' then
        insert into partner.side_status_change (partner_id, side, status, effective_on, note)
        values ((card ->> 'partner_id')::uuid, card ->> 'side', 'active', d, 'onboarded: ' || (card ->> 'number'));
      end if;
    end if;
    if backward and cur.meaning = 'onboarded' then
      insert into partner.side_status_change (partner_id, side, status, effective_on, note)
      values ((card ->> 'partner_id')::uuid, card ->> 'side', 'prospect', d, 'moved back');
    end if;
    if s.meaning = 'signed' then
      offers := array['log_achievement',
                      case card ->> 'side' when 'client' then 'corporate_onboarding' else 'supplier_onboarding' end];
    end if;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'stage', s.key, 'meaning', s.meaning,
    'passed', (select coalesce(pg_catalog.jsonb_agg(y.key order by y.sort), '[]'::jsonb) from pipeline.stage y
               where y.id::text = any (passed)),
    'offers', pg_catalog.to_jsonb(offers), 'achievement', contract, 'request_id', req);
end
$$;
