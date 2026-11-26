-- Landing 55 — a team member changes their own organisations only (the owner's approved design of 22 Nov 2026:
-- "Member: can add, edit and delete anything for their own clients. Cannot edit someone else's work.").
-- Found on live after Landing 51: a TEST team member without the extra was offered Edit, + Add, Archive / Remove and
-- the file picker on organisations owned by other people. The cause is the role, not a door: the Team member role
-- held the Partners page and the Suppliers & partners page at Full, and Full changes every organisation.
--   1. The Team member role's level on those two pages goes from Full to Own (the role's own row only, and only
--      where it still reads Full; a level an admin set for one person or one team is their choice and is left alone).
--   2. At Own a person changes an organisation whose side they own — its names, details, contacts, client IDs,
--      files, archive and removal — and one they add is theirs. Until now those stayed with Full, so Own alone would
--      have taken a member's own organisations away too.
--   3. "Edit someone else's work — Allowed" (Landing 40) reaches all of it, as it reaches a side's rows.
-- Reading is not changed: Own still sees every organisation. Finance is not changed: the Finance page and an
-- organisation's Finance tab keep their own levels (Landing 34b) — "own clients only" on Finance is NOT built here.
-- A manager, a head and an admin keep Full. No data is changed besides the role's two rows.
-- Each function below that existed is the statement the database held, word for word, with only the marked lines
-- changed.

-- ---------------------------------------------------------------- the one rule
create function partner.may_change(p_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  -- a side that is on: Full on its page, or Own and its owner — or the extra "Edit someone else's work"
  if exists (select 1 from partner.partner_side s
             where s.partner_id = p_id and s.deleted_at is null and partner.side_on(p_id, s.side)
               and (authz.level_of(me, partner.side_page(s.side)) = 'full'
                    or (authz.level_of(me, partner.side_page(s.side)) >= 'own'
                        and (me in (select partner.side_owners(p_id, s.side))
                             or core.extra_access(me, 'records.edit_others'))))) then
    return true;
  end if;
  -- no side on at all: as before, Full on either page
  return not exists (select 1 from partner.partner_side s
                     where s.partner_id = p_id and s.deleted_at is null and partner.side_on(p_id, s.side))
     and greatest(authz.level_of(me, 'clients'), authz.level_of(me, 'suppliers_partners')) = 'full';
end
$$;
comment on function partner.may_change(uuid) is 'Landing 55: whether the caller may change an organisation — Full on a side that is on, or Own and that side''s owner, or the extra records.edit_others; never by reading alone.';
revoke all on function partner.may_change(uuid) from public;

create function partner.require_change(p_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if partner.may_change(p_id) then
    return;
  end if;
  -- below Own: the refusal a reader always had
  if partner.level_of(me, p_id, null) < 'own' then
    perform partner.require_level(p_id, null, 'full');
  end if;
  -- at Own, and not theirs
  raise exception using errcode = '42501', message = 'access.needs_level',
    detail = pg_catalog.jsonb_build_object('page', coalesce(
               (select partner.side_page(s.side) from partner.partner_side s where s.partner_id = p_id
                and s.deleted_at is null order by s.side limit 1), 'clients'), 'level', 'own')::text;
end
$$;
comment on function partner.require_change(uuid) is 'Landing 55: refuses, in the words every access refusal uses, a caller who may not change this organisation (partner.may_change).';
revoke all on function partner.require_change(uuid) from public;

-- ---------------------------------------------------------------- the doors
CREATE OR REPLACE FUNCTION partner.writable(p_id uuid)
 RETURNS partner.partner
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p partner.partner;
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  -- Landing 55: Full on a side that is on, or Own and that side's owner (or the extra "Edit someone else's work").
  perform partner.require_change(p_id);
  if p.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'partner.archived';
  end if;
  return p;
end
$function$;

CREATE OR REPLACE FUNCTION partner.partner_remove(p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  req uuid;
  k int;
begin
  if not exists (select 1 from partner.partner where id = p_id and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  -- Landing 55: Full on a side that is on, or Own and that side's owner (or the extra "Edit someone else's work").
  perform partner.require_change(p_id);
  req := audit.begin('ui', 'partner.removed', pg_catalog.jsonb_build_object('id', p_id), p_reason);
  update partner.partner set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = p_reason
    where id = p_id;
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION partner.partner_unarchive(p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  req uuid;
begin
  if not exists (select 1 from partner.partner where id = p_id and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  -- Landing 55: Full on a side that is on, or Own and that side's owner (or the extra "Edit someone else's work").
  perform partner.require_change(p_id);
  if not exists (select 1 from partner.partner where id = p_id and archived_at is not null) then
    raise exception using errcode = 'P0001', message = 'partner.not_archived';
  end if;
  req := audit.begin('ui', 'partner.unarchived', pg_catalog.jsonb_build_object('id', p_id), p_reason);
  update partner.partner set archived_at = null where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION partner.partner_create(p_partner jsonb, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  pv jsonb;
  fmt jsonb := core.setting_at('partner.id_format', null, core.riyadh_today());
  pid uuid;
  num text;
  req uuid;
  s jsonb;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if pg_catalog.jsonb_typeof(p_partner -> 'sides') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_partner -> 'sides') = 0 then
    raise exception using errcode = 'P0001', message = 'partner.side_required';
  end if;
  for s in select * from pg_catalog.jsonb_array_elements(p_partner -> 'sides') loop
    if s ->> 'side' is null or s ->> 'side' not in ('client', 'supplier_partner') then
      raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = s ->> 'side';
    end if;
    -- Landing 55: Own is enough — the person who adds an organisation becomes its side's owner (partner.side_put).
    perform authz.require(partner.side_page(s ->> 'side'), 'own');
  end loop;
  pv := partner.fields(p_partner - 'sides');
  if not (pv ? 'trade_name_en') then
    raise exception using errcode = 'P0001', message = 'partner.trade_name_required';
  end if;
  req := audit.begin('ui', 'partner.created', null, p_reason);
  -- organisation numbers never restart: the counter's year 2000 row is their all-time row
  num := (fmt ->> 'prefix') || '-' || pg_catalog.lpad(core.next_number('partner', 2000)::text, coalesce((fmt ->> 'width')::int, 4), '0');
  insert into partner.partner (number, trade_name_en, trade_name_ar, official_name_en, official_name_ar, priority_id,
                               key_partner, website, city, country, address, notes, client_since)
  select num, pg_catalog.btrim(x.trade_name_en), x.trade_name_ar, x.official_name_en, x.official_name_ar, x.priority_id,
         coalesce(x.key_partner, false), x.website, x.city, x.country, x.address, x.notes, x.client_since
  from pg_catalog.jsonb_populate_record(null::partner.partner, pv) x
  returning id into pid;
  perform partner.names_sync(pid, p_reason);
  for s in select * from pg_catalog.jsonb_array_elements(p_partner -> 'sides') loop
    perform partner.side_put(pid, s ->> 'side', s - 'side', p_reason);
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'number', num, 'version', 1, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION partner.side_set(p_id uuid, p_side text, p_values jsonb, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p partner.partner := partner.writable(p_id);
  req uuid;
  sid uuid;
begin
  -- Landing 55: a side that is on is changed by who may write it (Full, or Own and its owner); a side not yet on
  -- is added by who may change the organisation (partner.writable above) and holds that side's page at Own or above.
  if partner.side_on(p_id, p_side) then
    perform partner.side_writable(p_id, p_side);
  else
    perform partner.require_level(p_id, p_side, 'own');
  end if;
  req := audit.begin('ui', 'partner.side_set', pg_catalog.jsonb_build_object('side', p_side), p_reason);
  sid := partner.side_put(p_id, p_side, p_values, p_reason);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', sid, 'version', (select x.version from partner.partner_side x where x.id = sid),
                                       'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION partner.side_off(p_id uuid, p_side text, p_until date DEFAULT NULL::date, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p partner.partner := partner.writable(p_id);
  cur partner.partner_side;
  day date := coalesce(p_until, core.riyadh_today());
  req uuid;
begin
  -- Landing 55: who may write that side (Full, or Own and its owner).
  if partner.side_on(p_id, p_side) then
    perform partner.side_writable(p_id, p_side);
  else
    perform partner.require_level(p_id, p_side, 'own');
  end if;
  select * into cur from partner.partner_side s where s.partner_id = p_id and s.side = p_side and s.deleted_at is null;
  if cur.id is null or not partner.side_on(p_id, p_side) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = p_side;
  end if;
  if not exists (select 1 from partner.partner_side s where s.partner_id = p_id and s.side <> p_side
                 and s.deleted_at is null and partner.side_on(p_id, s.side)) then
    raise exception using errcode = 'P0001', message = 'partner.last_side';
  end if;
  if cur.since is not null and day < cur.since then
    raise exception using errcode = 'P0001', message = 'partner.side_off_before_on';
  end if;
  req := audit.begin('ui', 'partner.side_off', pg_catalog.jsonb_build_object('side', p_side), p_reason);
  perform audit.write_fields('partner.partner_side', cur.id, pg_catalog.jsonb_build_object('until', day));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION partner.credit_limit_set(p_partner uuid, p_amount numeric, p_effective_from date, p_approved_by uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p partner.partner := partner.writable(p_partner);
  me uuid := authz.require_capability('finance.credit_control');
  why text := core.access_reason(p_reason);
  req uuid;
  cid uuid;
begin
  -- Landing 55: who may write the Client side (Full, or Own and its owner) — and the capability above.
  perform partner.side_writable(p_partner, 'client');
  if p_approved_by is null or not exists (select 1 from core.person x where x.id = p_approved_by and x.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'credit.approver_required';
  end if;
  req := audit.begin('ui', 'credit_limit.set', null, why);
  update partner.credit_limit set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
  where partner_id = p_partner and effective_from = coalesce(p_effective_from, core.riyadh_today()) and deleted_at is null;
  insert into partner.credit_limit (partner_id, amount_sar, effective_from, approved_by, reason)
  values (p_partner, p_amount, coalesce(p_effective_from, core.riyadh_today()), p_approved_by, why)
  returning id into cid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
exception when check_violation then
  raise exception using errcode = 'P0001', message = 'credit.amount_invalid';
end
$function$;

CREATE OR REPLACE FUNCTION partner.bulk_assign(p_ids uuid[], p_side text, p_owner uuid, p_priority uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- Landing 55: Own is enough to start; each organisation is checked below (partner.writable).
  me uuid := authz.require(partner.side_page(p_side), 'own');
  pid uuid;
  req uuid;
  n int := 0;
  can_all boolean;
begin
  can_all := authz.can(partner.side_page(p_side) || '.assign');
  if not can_all and not authz.can(partner.side_page(p_side) || '.assign_own') then
    perform authz.require_capability(partner.side_page(p_side) || '.assign');
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_priority is not null and not exists (select 1 from work.priority x where x.id = p_priority and x.active) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'partner.bulk_assigned',
                     pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids), 'side', p_side), p_reason);
  foreach pid in array p_ids loop
    perform partner.writable(pid);
    if not partner.side_on(pid, p_side) then
      raise exception using errcode = 'P0001', message = 'partner.side_not_on',
        detail = (select x.number from partner.partner x where x.id = pid);
    end if;
    if not can_all and not (me = any (select partner.side_owners(pid, p_side))) then
      raise exception using errcode = '42501', message = 'access.needs_capability',
        detail = pg_catalog.jsonb_build_object('capability', partner.side_page(p_side) || '.assign')::text;
    end if;
    if p_owner is not null then
      perform partner.side_owner_set_inner(pid, p_side, p_owner, core.riyadh_today(), p_reason);
    end if;
    if p_priority is not null then
      update partner.partner set priority_id = p_priority where id = pid;
    end if;
    if partner.status_of(pid, p_side) is null then
      insert into partner.side_status_change (partner_id, side, status, effective_on)
      values (pid, p_side, 'prospect', core.riyadh_today());
    end if;
    n := n + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$function$;

-- ---------------------------------------------------------------- a person's own entries on an organisation
-- Logging a call or a meeting, or writing a note, adds the writer's own entry and changes nothing of the
-- organisation's. It stays open to everyone who holds the page at Own or above, as it was while members held Full.
CREATE OR REPLACE FUNCTION partner.activity_log(p_partner uuid, p_type text, p_outcome text DEFAULT NULL::text, p_happened_on date DEFAULT NULL::date, p_body text DEFAULT NULL::text, p_next_step text DEFAULT NULL::text, p_next_step_on date DEFAULT NULL::date, p_mentions uuid[] DEFAULT NULL::uuid[], p_ticket_ref text DEFAULT NULL::text, p_internal text DEFAULT NULL::text, p_share_team boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  e core.entity;
  ip partner.internal_counterpart;
  t partner.activity_type;
  o partner.activity_outcome;
  nid uuid;
  req uuid;
  what text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- V645 (1): with an organisation, or with someone inside Direct (a team or a system from the Settings list) — one
  if (p_partner is null) = (p_internal is null) then
    raise exception using errcode = 'P0001', message = 'activity.with_whom_required';
  end if;
  if p_internal is not null then
    select * into ip from partner.internal_counterpart x
    where (x.key = p_internal or x.id::text = p_internal) and x.active and x.deleted_at is null;
    if ip.id is null then
      raise exception using errcode = 'P0002', message = 'activity.unknown_internal_counterpart', detail = p_internal;
    end if;
  else
    if coalesce(p_share_team, false) then
      raise exception using errcode = 'P0001', message = 'activity.share_team_internal_only';
    end if;
    e := core.can_see_record('partner', p_partner);
    if (select p.archived_at from partner.partner p where p.id = p_partner) is not null then
      raise exception using errcode = 'P0001', message = 'partner.archived';
    end if;
    -- Landing 55: a logged activity is the writer's own entry — Own or above on the organisation's page is enough.
    if not core.may_write(e.table_name, p_partner) and partner.level_of(me, p_partner, null) < 'own' then
      perform partner.side_writable(p_partner, null);
    end if;
  end if;
  select * into t from partner.activity_type x
  where (x.key = p_type or x.id::text = p_type) and x.active and x.deleted_at is null;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_activity_type', detail = p_type;
  end if;
  o := partner.outcome_of(t, p_outcome);
  if o.meaning = 'demo_set' and p_next_step_on is null then
    raise exception using errcode = 'P0001', message = 'partner.demo_day_required';
  end if;
  req := audit.begin('ui', 'partner.activity_logged',
                     pg_catalog.jsonb_build_object('type', t.key, 'outcome', o.key, 'internal', ip.key), null);
  perform audit.happened(p_happened_on);
  begin
    -- an activity inside Direct sits on its author's own record: it has no organisation (V645 (1))
    insert into core.note (entity_table, entity_id, kind, body, happened_on, activity_type_id, outcome_id, next_step,
                           next_step_on, internal_counterpart_id, ticket_ref, shared_with_team)
    values (case when ip.id is null then 'partner.partner' else 'core.person' end, coalesce(p_partner, me), 'activity',
            nullif(pg_catalog.btrim(p_body), ''),
            coalesce(p_happened_on, core.riyadh_today()), t.id, o.id, nullif(pg_catalog.btrim(p_next_step), ''),
            p_next_step_on, ip.id, nullif(pg_catalog.btrim(p_ticket_ref), ''), coalesce(p_share_team, false))
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = core.note_refused(what);
  end;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req, 'type', t.key, 'outcome', o.key,
    'internal', ip.key,
    'meaning', o.meaning, 'counts_as_demo', coalesce(o.counts_as_demo, false),
    'offer_task', o.meaning = 'meeting_set', 'offer_close_demo_task', o.meaning = 'demo_held',
    'demo_on', case when o.meaning = 'demo_set' then p_next_step_on end);
end
$function$;

CREATE OR REPLACE FUNCTION core.note_add(p_entity text, p_id uuid, p_kind text, p_body text, p_happened_on date DEFAULT NULL::date, p_mentions uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  nid uuid;
  req uuid;
  what text;
begin
  -- Landing 55: a note on an organisation is the writer's own entry — Own or above on its page is enough.
  if not core.may_write(e.table_name, p_id)
     and not (e.table_name = 'partner.partner' and partner.level_of(authz.me(), p_id, null) >= 'own') then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  if p_kind is null or p_kind not in ('comment', 'update', 'meeting_note') then
    raise exception using errcode = 'P0001', message = 'note.kind_invalid', detail = p_kind;
  end if;
  req := audit.begin('ui', 'note.added', pg_catalog.jsonb_build_object('kind', p_kind), null);
  perform audit.happened(p_happened_on);
  begin
    insert into core.note (entity_table, entity_id, kind, body, happened_on)
    values (e.table_name, p_id, p_kind, pg_catalog.btrim(p_body), coalesce(p_happened_on, core.riyadh_today()))
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = core.note_refused(what);
  end;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'version', 1, 'request_id', req);
end
$function$;

-- ---------------------------------------------------------------- the role
-- The Team member role: Own on the two organisation pages. Only the role's own row, and only where it still reads
-- Full (what the registry wrote); person and team levels are an admin's own choices and are left alone.
update core.role_page_level set level = 'own'
where page_key in ('clients', 'suppliers_partners') and deleted_at is null and level = 'full'
  and role_id in (select id from core.role where key = 'member');
