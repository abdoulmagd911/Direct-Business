-- P5-8 (part 1) · the Pipeline: tenders and partnership opportunities (TECH-SPEC §3.7a; V80, V99, V457, V481, V503).
--  · Lists: the stages of each kind on locked meanings with editable names and an optional flag; the Source every card
--    needs; the lost reasons of each kind (V476's tender seeds).
--  · A tender — a government entity's, numbered TND-2026-001; another segment needs Full and a reason — and a partnership
--    opportunity — an organisation and the side it would become, numbered OPP-2026-001 — each with its owner, Source,
--    stage and history (V96: the whole team sees them; Own changes one's own).
--  · Moving a card is one request dated by its happened_on (V400): a forward move records each required stage passed on
--    the same date, never an optional one skipped (V99, V481); a backward move needs a reason, keeps its history and
--    never reverts the organisation's status (OLD-034, OLD-WRK-069). Submitted dates the submission; Awarded needs its
--    value; Signed dates the signing (V503); Lost and Cancelled need a reason; a partnership reaching Onboarded switches
--    the side on and sets it Active from that day (V99); Handed to Product needs the Direct ticket (V457).
-- Part 2 brings bulk assign, the measures, Log achievement at Signed, the offered templates and the card's Work tab.
create schema pipeline;   -- tenders and partnership opportunities (§3.7a)
comment on schema pipeline is 'Tenders and partnership opportunities: the Pipeline page''s two boards (TECH-SPEC §3.7a, V80).';
revoke all on schema pipeline from public;

-- ================================================================ the lists (V80, V99, V457, V481, V503)
create table pipeline.stage (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('tender', 'partnership')),
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  meaning text not null,
  optional boolean not null default false,
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  unique (kind, key),
  constraint stage_meaning_of_its_kind check (case kind
    when 'tender' then meaning in ('identified', 'preparing', 'submitted', 'clarifying', 'awarded', 'signed', 'lost',
                                   'cancelled')
    else meaning in ('open', 'signed', 'handed_over', 'onboarded', 'lost') end)
);
create unique index stage_one_per_meaning on pipeline.stage (kind, meaning) where deleted_at is null and meaning <> 'open';
comment on table pipeline.stage is
  'The stages of each board on locked meanings (V99, V457): names, order and the optional flag are an admin''s; a skipped optional stage is never recorded as passed.';

create table pipeline.source (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table pipeline.source is 'Where a card came from (V99): every tender and opportunity names one.';

create table pipeline.lost_reason (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('tender', 'partnership')),
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  unique (kind, key)
);
comment on table pipeline.lost_reason is 'Why a card was lost or cancelled, per board (V476).';

-- A stage keeps its board and its meaning, a lost reason its board.
create function pipeline.kind_fixed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind
     or (tg_table_name = 'stage' and (pg_catalog.to_jsonb(new) ->> 'meaning') is distinct from (pg_catalog.to_jsonb(old) ->> 'meaning')) then
    raise exception using errcode = 'P0001', message = 'list.meaning_locked';
  end if;
  return new;
end
$$;
create trigger kind_fixed before update on pipeline.stage for each row execute function pipeline.kind_fixed();
create trigger kind_fixed before update on pipeline.lost_reason for each row execute function pipeline.kind_fixed();

-- ================================================================ the cards (§3.7a)
create table pipeline.tender (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  title text not null check (pg_catalog.btrim(title) <> '' and pg_catalog.length(title) <= 200),
  partner_id uuid not null references partner.partner (id),
  segment_reason text check (segment_reason is null or (pg_catalog.btrim(segment_reason) <> ''
                                                         and pg_catalog.length(segment_reason) <= 500)),
  etimad_ref text check (etimad_ref is null or (pg_catalog.btrim(etimad_ref) <> '' and pg_catalog.length(etimad_ref) <= 100)),
  tender_no text check (tender_no is null or (pg_catalog.btrim(tender_no) <> '' and pg_catalog.length(tender_no) <= 100)),
  submission_due_on date,
  submitted_on date,
  value_sar numeric(16, 2) check (value_sar is null or value_sar >= 0),
  awarded_value_sar numeric(16, 2) check (awarded_value_sar is null or awarded_value_sar >= 0),
  awarded_on date,
  signed_on date,
  stage_id uuid not null references pipeline.stage (id),
  owner_id uuid not null references core.person (id),
  department_id uuid not null references core.department (id),
  source_id uuid not null references pipeline.source (id),
  project_id uuid references work.project (id),
  lost_reason_id uuid references pipeline.lost_reason (id),
  notes text check (notes is null or pg_catalog.length(notes) <= 20000),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create index tender_department on pipeline.tender (department_id) where deleted_at is null;
comment on table pipeline.tender is
  'A tender (§3.7a, V80): a government entity''s, with its Etimad reference and numbers; it counts as a contract at signing (V503).';

create table pipeline.opportunity (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  title text not null check (pg_catalog.btrim(title) <> '' and pg_catalog.length(title) <= 200),
  partner_id uuid not null references partner.partner (id),
  side text not null check (side in ('client', 'supplier_partner')),
  type_id uuid not null references partner.side_type (id),
  stage_id uuid not null references pipeline.stage (id),
  owner_id uuid not null references core.person (id),
  department_id uuid not null references core.department (id),
  source_id uuid not null references pipeline.source (id),
  ticket_ref text check (ticket_ref is null or (pg_catalog.btrim(ticket_ref) <> '' and pg_catalog.length(ticket_ref) <= 100)),
  expected_value_sar numeric(16, 2) check (expected_value_sar is null or expected_value_sar >= 0),
  next_step text check (next_step is null or (pg_catalog.btrim(next_step) <> '' and pg_catalog.length(next_step) <= 500)),
  next_step_on date,
  signed_on date,
  handed_over_on date,
  onboarded_on date,
  lost_reason_id uuid references pipeline.lost_reason (id),
  notes text check (notes is null or pg_catalog.length(notes) <= 20000),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create index opportunity_department on pipeline.opportunity (department_id) where deleted_at is null;
comment on table pipeline.opportunity is
  'A partnership opportunity (§3.7a, V99): an organisation and the side it would become — a client of a segment, or a supplier & partner of a type.';

-- The history the measures read (V400): every stage a card entered, on the day it happened; `passed` marks a required
-- stage recorded on the way past it.
create table pipeline.stage_change (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null check (entity_table in ('pipeline.tender', 'pipeline.opportunity')),
  entity_id uuid not null,
  from_stage_id uuid references pipeline.stage (id),
  to_stage_id uuid not null references pipeline.stage (id),
  passed boolean not null default false,
  seq bigint generated always as identity,                 -- the order the stages were entered, within one day
  happened_on date not null,
  logged_at timestamptz not null default core.clock(),
  note text check (note is null or (pg_catalog.btrim(note) <> '' and pg_catalog.length(note) <= 1000)),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint stage_change_not_after_logged check (happened_on <= core.riyadh_day(logged_at))
);
create index stage_change_entity on pipeline.stage_change (entity_table, entity_id, happened_on desc, logged_at desc)
  where deleted_at is null;

do $$
declare
  t text;
begin
  foreach t in array array['pipeline.stage', 'pipeline.source', 'pipeline.lost_reason', 'pipeline.tender',
                           'pipeline.opportunity', 'pipeline.stage_change'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('pipeline');

-- A card's stage is one of its own board's; an opportunity's type is of its side; a lost reason of its board.
create function pipeline.card_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text := case tg_table_name when 'tender' then 'tender' else 'partnership' end;
  j jsonb := pg_catalog.to_jsonb(new);
begin
  if not exists (select 1 from pipeline.stage s where s.id = new.stage_id and s.kind = v_kind) then
    raise exception using errcode = 'P0001', message = 'pipeline.stage_of_other_board';
  end if;
  if new.lost_reason_id is not null
     and not exists (select 1 from pipeline.lost_reason r where r.id = new.lost_reason_id and r.kind = v_kind) then
    raise exception using errcode = 'P0001', message = 'pipeline.reason_of_other_board';
  end if;
  if tg_table_name = 'opportunity'
     and not exists (select 1 from partner.side_type t where t.id = (j ->> 'type_id')::uuid and t.side = j ->> 'side') then
    raise exception using errcode = 'P0001', message = 'opportunity.type_of_other_side';
  end if;
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    perform work.require_person(new.owner_id);
  end if;
  return new;
end
$$;
create trigger guard before insert or update on pipeline.tender for each row execute function pipeline.card_guard();
create trigger guard before insert or update on pipeline.opportunity for each row execute function pipeline.card_guard();

-- ================================================================ the seeds (V80, V99, V457, V476, V481, V503)
select audit.begin('system', 'list.seeded', null, 'P5-8: the Pipeline''s stages, sources and lost reasons');
insert into pipeline.stage (kind, key, name_en, name_ar, meaning, optional, sort) values
  ('tender', 'identified', 'Identified', 'محدّدة', 'identified', false, 10),
  ('tender', 'preparing', 'Preparing', 'قيد الإعداد', 'preparing', false, 20),
  ('tender', 'submitted', 'Submitted', 'مقدّمة', 'submitted', false, 30),
  ('tender', 'clarifying', 'Clarification / negotiation', 'استيضاح وتفاوض', 'clarifying', true, 40),
  ('tender', 'awarded', 'Awarded', 'مُرسّاة', 'awarded', false, 50),
  ('tender', 'signed', 'Signed', 'موقّعة', 'signed', false, 60),
  ('tender', 'lost', 'Lost', 'خاسرة', 'lost', false, 90),
  ('tender', 'cancelled', 'Cancelled', 'ملغاة', 'cancelled', false, 95),
  ('partnership', 'contacted', 'Contacted', 'تم التواصل', 'open', false, 10),
  ('partnership', 'demo', 'Demo', 'عرض توضيحي', 'open', false, 20),
  ('partnership', 'proposal', 'Proposal', 'عرض سعر', 'open', true, 30),
  ('partnership', 'signed', 'Signed', 'موقّعة', 'signed', false, 40),
  ('partnership', 'handed_over', 'Handed to Product', 'سُلّمت للمنتج', 'handed_over', true, 50),
  ('partnership', 'onboarded', 'Onboarded', 'مفعّلة', 'onboarded', false, 60),
  ('partnership', 'lost', 'Lost', 'خاسرة', 'lost', false, 90);
insert into pipeline.source (key, name_en, name_ar, sort) values
  ('referral', 'Referral', 'إحالة', 10), ('event', 'Event', 'فعالية', 20),
  ('inbound_ticket', 'Inbound ticket', 'تذكرة واردة', 30), ('outbound', 'Outbound', 'تواصل مباشر', 40),
  ('tender_portal', 'Tender portal', 'بوابة المنافسات', 50);
insert into pipeline.lost_reason (kind, key, name_en, name_ar, sort) values
  ('tender', 'technically_non_compliant', 'Technically non-compliant', 'غير مطابق فنيًا', 10),
  ('tender', 'price', 'Price', 'السعر', 20),
  ('tender', 'cancelled_by_entity', 'Cancelled by the entity', 'ألغتها الجهة', 30),
  ('partnership', 'no_response', 'No response', 'لا استجابة', 10),
  ('partnership', 'price', 'Price', 'السعر', 20),
  ('partnership', 'competitor', 'Went with a competitor', 'اختار منافسًا', 30),
  ('partnership', 'not_a_fit', 'Not a fit', 'غير مناسب', 40);
select audit.end();

-- ================================================================ who sees and who changes (V96, §5)
-- The whole team sees every card of its departments (V96): a person's level on one is their Pipeline level while it
-- belongs to one of their departments.
create function pipeline.row_of(p_table text, p_id uuid, out card_table text, out card_id uuid, out department_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
begin
  case p_table
    when 'pipeline.tender' then card_table := p_table; card_id := p_id;
    when 'pipeline.opportunity' then card_table := p_table; card_id := p_id;
    when 'pipeline.stage_change' then select x.entity_table, x.entity_id into card_table, card_id
                                      from pipeline.stage_change x where x.id = p_id;
    else null;
  end case;
  department_id := case card_table
    when 'pipeline.tender' then (select x.department_id from pipeline.tender x where x.id = card_id)
    when 'pipeline.opportunity' then (select x.department_id from pipeline.opportunity x where x.id = card_id) end;
end
$$;
create function pipeline.row_level(p_table text, p_id uuid, p_person uuid) returns core.level
language plpgsql stable security definer set search_path = ''
as $$
declare
  o record;
begin
  select * into o from pipeline.row_of(p_table, p_id);
  if o.department_id is null or not work.sees_department(p_person, o.department_id) then
    return 'none';
  end if;
  return authz.level_of(p_person, 'pipeline');
end
$$;

-- A card's own people (§3.3): its owner and its maker.
create function pipeline.card_owners(p_table text, p_id uuid) returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_table = 'pipeline.tender' then
    return query select x.owner_id from pipeline.tender x where x.id = p_id union select x.created_by from pipeline.tender x where x.id = p_id;
  elsif p_table = 'pipeline.opportunity' then
    return query select x.owner_id from pipeline.opportunity x where x.id = p_id
                 union select x.created_by from pipeline.opportunity x where x.id = p_id;
  end if;
end
$$;
create function pipeline.tender_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select pipeline.card_owners('pipeline.tender', p_id) $$;
create function pipeline.opportunity_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select pipeline.card_owners('pipeline.opportunity', p_id) $$;
create function pipeline.stage_change_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select pipeline.card_owners(x.entity_table, x.entity_id) from pipeline.stage_change x where x.id = p_id $$;

-- The card a person may change: Full on the Pipeline, or Own and its owner or maker.
create function pipeline.card_editable(p_table text, p_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  lvl core.level;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  lvl := pipeline.row_level(p_table, p_id, me);
  if lvl < 'view' or not exists (select 1 from pipeline.row_of(p_table, p_id) o where o.card_id is not null)
     or (p_table = 'pipeline.tender' and not exists (select 1 from pipeline.tender x where x.id = p_id and x.deleted_at is null))
     or (p_table = 'pipeline.opportunity'
         and not exists (select 1 from pipeline.opportunity x where x.id = p_id and x.deleted_at is null)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not (lvl = 'full' or (lvl = 'own' and me in (select pipeline.card_owners(p_table, p_id)))) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'pipeline', 'level', 'own')::text;
  end if;
end
$$;

-- ================================================================ lookups
create function pipeline.stage_of(p_kind text, p text) returns pipeline.stage
language sql stable security definer set search_path = ''
as $$
  select s from pipeline.stage s
  where s.kind = p_kind and (s.key = p or s.id::text = p) and s.active and s.deleted_at is null
$$;
create function pipeline.list_id(p_table text, p_kind text, p text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  r uuid;
begin
  if p is null or p = '' then
    return null;
  end if;
  execute pg_catalog.format('select t.id from %s t where (t.key = $1 or t.id::text = $1) and t.active and t.deleted_at is null'
                            || case when p_kind is null then '' else ' and t.kind = $2' end,
                            pg_catalog.to_regclass(p_table))
    into r using p, p_kind;
  if r is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = p_table || ':' || p;
  end if;
  return r;
end
$$;

-- Whether an organisation is in the Government segment: its Client side is of type government (V64).
create function pipeline.is_government(p_partner uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from partner.partner_side s join partner.side_type t on t.id = s.type_id
                 where s.partner_id = p_partner and s.side = 'client' and s.deleted_at is null and t.key = 'government')
$$;

create function pipeline.refused(p_constraint text) returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_constraint like '%title_check' then 'pipeline.title_required'
    when p_constraint like '%value_sar_check' then 'pipeline.value_invalid'
    when p_constraint = 'stage_change_not_after_logged' then 'common.date_in_future'
    else 'common.invalid' end
$$;

-- ================================================================ a tender: create and change (§3.7a, V80)
create function pipeline.tender_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
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
  if (p_id is null and nullif(v ->> 'source', '') is null) or (v ? 'source' and nullif(v ->> 'source', '') is null) then
    raise exception using errcode = 'P0001', message = 'pipeline.source_required';
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
              dept, pipeline.list_id('pipeline.source', null, v ->> 'source'), nullif(v ->> 'project_id', '')::uuid,
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

-- ================================================================ an opportunity: create and change (§3.7a, V99)
create function pipeline.opportunity_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  o pipeline.opportunity;
  v_partner uuid;
  v_side text;
  v_type uuid;
  v_owner uuid;
  dept uuid;
  first_stage pipeline.stage;
  v_id uuid;
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
    if k not in ('title', 'partner_id', 'side', 'type', 'owner_id', 'source', 'ticket_ref', 'expected_value_sar',
                 'next_step', 'next_step_on', 'notes', 'happened_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if p_id is not null then
    perform pipeline.card_editable('pipeline.opportunity', p_id);
    select * into o from pipeline.opportunity where id = p_id;
    if v ? 'happened_on' then
      raise exception using errcode = 'P0001', message = 'pipeline.date_is_the_moves';
    end if;
    if v ? 'partner_id' and (v ->> 'partner_id')::uuid is distinct from o.partner_id then
      raise exception using errcode = 'P0001', message = 'opportunity.partner_fixed';
    end if;
  else
    perform authz.require('pipeline', 'own');
  end if;
  v_partner := coalesce(nullif(v ->> 'partner_id', '')::uuid, o.partner_id);
  if v_partner is null then
    raise exception using errcode = 'P0001', message = 'opportunity.partner_required';
  end if;
  if p_id is null and not authz.can_see_as(me, 'partner.partner', v_partner) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  v_side := coalesce(nullif(v ->> 'side', ''), o.side);
  if v_side is null or v_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'opportunity.side_required';
  end if;
  v_type := case when v ? 'type' then partner.side_entry('partner.side_type', v_side, v ->> 'type') else o.type_id end;
  if v_type is null then
    raise exception using errcode = 'P0001', message = 'opportunity.type_required';
  end if;
  if (p_id is null and nullif(v ->> 'source', '') is null) or (v ? 'source' and nullif(v ->> 'source', '') is null) then
    raise exception using errcode = 'P0001', message = 'pipeline.source_required';
  end if;
  v_owner := coalesce(nullif(v ->> 'owner_id', '')::uuid, o.owner_id, me);
  if v_owner is distinct from coalesce(o.owner_id, me) and not authz.can('pipeline.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'pipeline.assign';
  end if;
  begin
    if p_id is null then
      select x.department_id into dept from core.person x where x.id = v_owner;
      first_stage := (select s from pipeline.stage s where s.kind = 'partnership' and s.meaning = 'open' and s.active
                      and s.deleted_at is null order by s.sort, s.key limit 1);
      req := audit.begin('ui', 'opportunity.created', null);
      perform audit.happened(nullif(v ->> 'happened_on', '')::date);
      insert into pipeline.opportunity (number, title, partner_id, side, type_id, stage_id, owner_id, department_id,
                                        source_id, ticket_ref, expected_value_sar, next_step, next_step_on, notes)
      values (core.format_number('OPP', pg_catalog.date_part('year', core.riyadh_today())::int,
                                 core.next_number('opportunity', pg_catalog.date_part('year', core.riyadh_today())::int), 3),
              pg_catalog.btrim(v ->> 'title'), v_partner, v_side, v_type, first_stage.id, v_owner, dept,
              pipeline.list_id('pipeline.source', null, v ->> 'source'), nullif(pg_catalog.btrim(v ->> 'ticket_ref'), ''),
              nullif(v ->> 'expected_value_sar', '')::numeric, nullif(pg_catalog.btrim(v ->> 'next_step'), ''),
              nullif(v ->> 'next_step_on', '')::date, nullif(pg_catalog.btrim(v ->> 'notes'), ''))
      returning id into v_id;
      insert into pipeline.stage_change (entity_table, entity_id, to_stage_id, happened_on)
      values ('pipeline.opportunity', v_id, first_stage.id, d);
    else
      perform core.check_version('pipeline.opportunity', p_id, p_version, array(select pg_catalog.jsonb_object_keys(v)));
      req := audit.begin('ui', 'opportunity.changed', pg_catalog.jsonb_build_object('number', o.number));
      update pipeline.opportunity set
        title = case when v ? 'title' then pg_catalog.btrim(v ->> 'title') else title end,
        side = case when v ? 'side' then v_side else side end,
        type_id = v_type,
        owner_id = v_owner,
        source_id = case when v ? 'source' then pipeline.list_id('pipeline.source', null, v ->> 'source') else source_id end,
        ticket_ref = case when v ? 'ticket_ref' then nullif(pg_catalog.btrim(v ->> 'ticket_ref'), '') else ticket_ref end,
        expected_value_sar = case when v ? 'expected_value_sar' then nullif(v ->> 'expected_value_sar', '')::numeric
                                  else expected_value_sar end,
        next_step = case when v ? 'next_step' then nullif(pg_catalog.btrim(v ->> 'next_step'), '') else next_step end,
        next_step_on = case when v ? 'next_step_on' then nullif(v ->> 'next_step_on', '')::date else next_step_on end,
        notes = case when v ? 'notes' then nullif(pg_catalog.btrim(v ->> 'notes'), '') else notes end
      where id = p_id;
      v_id := p_id;
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
  if v_owner is distinct from o.owner_id then
    perform notify.push_assigned(v_owner, 'assigned', 'pipeline.opportunity', v_id);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', v_id, 'request_id', req,
    'number', (select x.number from pipeline.opportunity x where x.id = v_id),
    'version', (select x.version from pipeline.opportunity x where x.id = v_id));
end
$$;

-- ================================================================ moving a card (§3.7a)
-- One request, dated by its happened_on (V400): today by default, never after today, never before the card's last move.
-- Forward: each required stage between is recorded as passed on the same day (an optional one skipped is not — V99,
-- V481), and each stage reached or passed does what its meaning asks. Backward needs a reason; the dates of the stages
-- moved back over are cleared on the card and kept in its history; the organisation's status is never reverted.
create function pipeline.move(p_entity text, p_id uuid, p_stage text, p_happened_on date default null,
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

  req := audit.begin('ui', 'pipeline.moved', pg_catalog.jsonb_build_object('number', card ->> 'number', 'stage', s.key),
                     reason);
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
    if s.meaning = 'signed' then
      offers := array['log_achievement', 'new_project'];
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
    if s.meaning = 'signed' then
      offers := array['log_achievement',
                      case card ->> 'side' when 'client' then 'corporate_onboarding' else 'supplier_onboarding' end];
    end if;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'stage', s.key, 'meaning', s.meaning,
    'passed', (select coalesce(pg_catalog.jsonb_agg(y.key order by y.sort), '[]'::jsonb) from pipeline.stage y
               where y.id::text = any (passed)),
    'offers', pg_catalog.to_jsonb(offers), 'request_id', req);
end
$$;

-- Remove cards (soft; Undo restores them): Full, or Own and one's own.
create function pipeline.remove(p_entity text, p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  tbl text := case p_entity when 'tender' then 'pipeline.tender' when 'opportunity' then 'pipeline.opportunity' end;
  i uuid;
  req uuid;
  k int;
begin
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'pipeline.unknown_board', detail = p_entity;
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  foreach i in array p_ids loop
    perform pipeline.card_editable(tbl, i);
  end loop;
  req := audit.begin('ui', case p_entity when 'tender' then 'tender.removed' else 'opportunity.removed' end,
                     pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  execute pg_catalog.format('update %s set deleted_at = core.clock(), deleted_by = $1, delete_reason = $2 where id = any ($3)',
                            tbl::regclass) using me, p_reason, p_ids;
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- ================================================================ reading
-- A card as the board and the list show it, for a reader who sees it.
create function pipeline.card_row(p_table text, p_id uuid, p_reader uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb;
  s pipeline.stage;
begin
  execute pg_catalog.format('select pg_catalog.to_jsonb(c) from %s c where c.id = $1 and c.deleted_at is null',
                            p_table::regclass) into c using p_id;
  if c is null then
    return null;
  end if;
  select * into s from pipeline.stage where id = (c ->> 'stage_id')::uuid;
  return pg_catalog.jsonb_build_object(
    'id', c -> 'id', 'number', c -> 'number', 'title', c -> 'title', 'partner_id', c -> 'partner_id',
    'partner_number', (select p.number from partner.partner p where p.id = (c ->> 'partner_id')::uuid),
    'owner_id', c -> 'owner_id', 'department_id', c -> 'department_id',
    'stage', s.key, 'stage_en', s.name_en, 'stage_ar', s.name_ar, 'meaning', s.meaning,
    'source', (select x.key from pipeline.source x where x.id = (c ->> 'source_id')::uuid),
    'lost_reason', (select x.key from pipeline.lost_reason x where x.id = (c ->> 'lost_reason_id')::uuid),
    'value_sar', coalesce(c -> 'value_sar', c -> 'expected_value_sar'),
    'since', (select pg_catalog.max(h.happened_on) from pipeline.stage_change h
              where h.entity_table = p_table and h.entity_id = p_id and h.deleted_at is null),
    'level', pipeline.row_level(p_table, p_id, p_reader), 'version', c -> 'version')
    || (c - array['id', 'number', 'title', 'partner_id', 'owner_id', 'department_id', 'stage_id', 'source_id',
                  'lost_reason_id', 'value_sar', 'expected_value_sar', 'version', 'created_at', 'created_by',
                  'updated_at', 'updated_by', 'deleted_at', 'deleted_by', 'delete_reason']);
end
$$;

-- One card with its history, for a reader who sees it.
create function pipeline.card(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  tbl text := case p_entity when 'tender' then 'pipeline.tender' when 'opportunity' then 'pipeline.opportunity' end;
  r jsonb;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if tbl is null or pipeline.row_level(tbl, p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  r := pipeline.card_row(tbl, p_id, me);
  if r is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return r || pg_catalog.jsonb_build_object('history', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', h.id, 'from', f.key, 'to', t.key, 'to_en', t.name_en, 'to_ar', t.name_ar, 'passed', h.passed,
      'happened_on', h.happened_on, 'logged_at', h.logged_at, 'note', h.note, 'by', h.created_by)
      order by h.happened_on, h.seq)
    from pipeline.stage_change h join pipeline.stage t on t.id = h.to_stage_id
    left join pipeline.stage f on f.id = h.from_stage_id
    where h.entity_table = tbl and h.entity_id = p_id and h.deleted_at is null), '[]'::jsonb));
end
$$;

-- A board: each stage of the kind in order, with its cards (the reader's departments), their count and value. Filters:
-- side (client | supplier_partner, partnerships — OLD-WRK-066), owner_id, partner_id, mine.
create function pipeline.board(p_entity text, p_filter jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  tbl text := case p_entity when 'tender' then 'pipeline.tender' when 'opportunity' then 'pipeline.opportunity' end;
  v_kind text := case p_entity when 'tender' then 'tender' else 'partnership' end;
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  cards jsonb;
begin
  perform authz.require('pipeline', 'view');
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'pipeline.unknown_board', detail = p_entity;
  end if;
  execute pg_catalog.format($q$
    select coalesce(pg_catalog.jsonb_agg(pipeline.card_row(%1$L, c.id, $1) order by c.number), '[]'::jsonb)
    from %2$s c
    where c.deleted_at is null and work.sees_department($1, c.department_id)
      and ($2 ->> 'owner_id' is null or c.owner_id = ($2 ->> 'owner_id')::uuid)
      and ($2 ->> 'partner_id' is null or c.partner_id = ($2 ->> 'partner_id')::uuid)
      and (not coalesce(($2 ->> 'mine')::boolean, false) or $1 in (c.owner_id, c.created_by))
      %3$s$q$, tbl, tbl::regclass,
      case when v_kind = 'partnership' then 'and ($2 ->> ''side'' is null or c.side = $2 ->> ''side'')' else '' end)
    into cards using me, f;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'stage', s.key, 'name_en', s.name_en, 'name_ar', s.name_ar, 'meaning', s.meaning, 'optional', s.optional,
      'count', (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(cards) c where c ->> 'stage' = s.key),
      'value_sar', (select coalesce(pg_catalog.sum((c ->> 'value_sar')::numeric), 0)
                    from pg_catalog.jsonb_array_elements(cards) c where c ->> 'stage' = s.key),
      'cards', (select coalesce(pg_catalog.jsonb_agg(c), '[]'::jsonb)
                from pg_catalog.jsonb_array_elements(cards) c where c ->> 'stage' = s.key)) order by s.sort, s.key)
    from pipeline.stage s where s.kind = v_kind and s.deleted_at is null and s.active), '[]'::jsonb);
end
$$;

-- ================================================================ bulk assign (V472, V456)
-- Cards given to one owner in one request, each new owner told once per card, one Undo; pipeline.assign, and every card
-- one the caller sees. A card the owner already holds is left alone.
create function pipeline.bulk_assign(p_entity text, p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  tbl text := case p_entity when 'tender' then 'pipeline.tender' when 'opportunity' then 'pipeline.opportunity' end;
  i uuid;
  req uuid;
  k int := 0;
  changed boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'pipeline.unknown_board', detail = p_entity;
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_owner is null then
    raise exception using errcode = 'P0001', message = 'pipeline.owner_required';
  end if;
  perform authz.require_capability('pipeline.assign');
  foreach i in array p_ids loop
    if pipeline.row_level(tbl, i, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
  end loop;
  req := audit.begin('ui', case p_entity when 'tender' then 'tender.assigned' else 'opportunity.assigned' end,
                     pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  foreach i in array p_ids loop
    execute pg_catalog.format('update %s set owner_id = $1 where id = $2 and deleted_at is null and owner_id <> $1',
                              tbl::regclass) using p_owner, i;
    get diagnostics changed = row_count;
    if changed then
      perform notify.push_assigned(p_owner, 'assigned', tbl, i);
      k := k + 1;
    end if;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- An organisation's tenders and opportunities for its card's Work tab (§3.7a): those the reader sees, open first.
create function pipeline.partner_cards(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if not authz.can_see_as(me, 'partner.partner', p_partner) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(x.r || pg_catalog.jsonb_build_object('entity', x.entity)
                                order by x.r ->> 'meaning' in ('lost', 'cancelled', 'signed', 'onboarded'), x.r ->> 'number')
    from (select 'tender' as entity, pipeline.card_row('pipeline.tender', t.id, me) as r
          from pipeline.tender t
          where t.partner_id = p_partner and t.deleted_at is null and pipeline.row_level('pipeline.tender', t.id, me) >= 'view'
          union all
          select 'opportunity', pipeline.card_row('pipeline.opportunity', o.id, me)
          from pipeline.opportunity o
          where o.partner_id = p_partner and o.deleted_at is null
            and pipeline.row_level('pipeline.opportunity', o.id, me) >= 'view') x), '[]'::jsonb);
end
$$;

-- ================================================================ the doors (V124)
revoke all on function pipeline.bulk_assign(text, uuid[], uuid, text), pipeline.partner_cards(uuid) from public;
grant execute on function pipeline.bulk_assign(text, uuid[], uuid, text), pipeline.partner_cards(uuid) to authenticated;
create function api.opportunity_bulk_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select pipeline.bulk_assign('opportunity', p_ids, p_owner, p_reason) $$;
create function api.tender_bulk_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select pipeline.bulk_assign('tender', p_ids, p_owner, p_reason) $$;
create function api.partner_pipeline(p_partner uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select pipeline.partner_cards(p_partner) $$;
grant execute on function api.opportunity_bulk_assign(uuid[], uuid, text), api.tender_bulk_assign(uuid[], uuid, text),
  api.partner_pipeline(uuid) to authenticated;
revoke all on function pipeline.kind_fixed(), pipeline.card_guard(), pipeline.row_of(text, uuid),
  pipeline.row_level(text, uuid, uuid), pipeline.card_owners(text, uuid), pipeline.tender_owners(uuid),
  pipeline.opportunity_owners(uuid), pipeline.stage_change_owners(uuid), pipeline.card_editable(text, uuid),
  pipeline.stage_of(text, text), pipeline.list_id(text, text, text), pipeline.is_government(uuid),
  pipeline.refused(text), pipeline.tender_save(uuid, jsonb, int), pipeline.opportunity_save(uuid, jsonb, int),
  pipeline.move(text, uuid, text, date, jsonb, int), pipeline.remove(text, uuid[], text),
  pipeline.card_row(text, uuid, uuid), pipeline.card(text, uuid), pipeline.board(text, jsonb) from public;
grant usage on schema pipeline to authenticated;
grant execute on function pipeline.tender_save(uuid, jsonb, int), pipeline.opportunity_save(uuid, jsonb, int),
  pipeline.move(text, uuid, text, date, jsonb, int), pipeline.remove(text, uuid[], text), pipeline.card(text, uuid),
  pipeline.board(text, jsonb) to authenticated;

create function api.tender_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select pipeline.tender_save(p_id, p_values, p_version) $$;
create function api.opportunity_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select pipeline.opportunity_save(p_id, p_values, p_version) $$;
create function api.pipeline_move(p_entity text, p_id uuid, p_stage text, p_happened_on date default null,
                                  p_values jsonb default null, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select pipeline.move(p_entity, p_id, p_stage, p_happened_on, p_values, p_version) $$;
create function api.pipeline_remove(p_entity text, p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select pipeline.remove(p_entity, p_ids, p_reason) $$;
create function api.pipeline_card(p_entity text, p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select pipeline.card(p_entity, p_id) $$;
create function api.pipeline_board(p_entity text, p_filter jsonb default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select pipeline.board(p_entity, p_filter) $$;
grant execute on function api.tender_save(uuid, jsonb, int), api.opportunity_save(uuid, jsonb, int),
  api.pipeline_move(text, uuid, text, date, jsonb, int), api.pipeline_remove(text, uuid[], text),
  api.pipeline_card(text, uuid), api.pipeline_board(text, jsonb) to authenticated;
