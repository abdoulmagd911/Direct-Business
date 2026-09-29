-- v2 the doors of P3-8b-2: notes, mentions and Log activity with its next step (V401, V406), each dated by the day it
-- happened (V400); an organisation gone stale; files (register, upload, finish, list, download under their live name,
-- review date, remove), logos and photos; contracts and references on one side of an organisation (V98, V409); the
-- contract-expiring, stale and file-review alerts; the card, the lists and merge carry all of it. TECH-SPEC §3.3, §3.4;
-- V53, V55, V56, V61, V98, V400, V401, V406, V409, D10; V150–V155. Every function the Data API reaches is a
-- security-invoker wrapper (V124). Forward-only (V103).

-- ================================================================ owners, levels, visibility (V127, V98)
-- A note is owned by its author and by the owners of its record; seen by whoever sees its record, and changed as that
-- record allows. A contract, its terms and a reference go with their side (partner.row_level).
create function core.note_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select n.created_by from core.note n where n.id = p_id
  union
  select o from core.note n cross join lateral pg_catalog.unnest(core.owners_of(n.entity_table, n.entity_id)) o
  where n.id = p_id
$$;
create function core.note_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select authz.can_see_as(p_person, n.entity_table, n.entity_id) from core.note n where n.id = p_id), false) $$;
create function core.note_level(p_table text, p_id uuid, p_person uuid) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce((select authz.record_level(p_person, n.entity_table, n.entity_id) from core.note n where n.id = p_id),
                  'none'::core.level)
$$;
create function core.mention_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select core.note_visible(m.note_id, p_person) from core.mention m where m.id = p_id), false) $$;
create function core.mention_level(p_table text, p_id uuid, p_person uuid) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce((select core.note_level('core.note', m.note_id, p_person) from core.mention m where m.id = p_id),
                  'none'::core.level)
$$;
create function partner.contract_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.contract', p_id) $$;
create function partner.contract_term_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.contract_term', p_id) $$;
create function partner.reference_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.reference', p_id) $$;

-- ================================================================ who may add to a record
-- The signed-in person may add notes and files to a record: an admin; Full on it; Own on it and one of its owners. A
-- record type with neither page nor level of its own: its owners.
create function core.may_write(p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
  lv core.level;
begin
  select * into e from core.entity where table_name = p_table and active;
  if me is null or e.id is null then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  lv := case when e.page_key is null and e.level is null then 'own'::core.level
             else authz.record_level(me, p_table, p_id) end;
  return lv = 'full' or (lv >= 'own' and me = any (core.owners_of(p_table, p_id)));
end
$$;

-- One side of a live organisation the caller may add to (V98): Full on that side's page, or Own and that side's owner;
-- no side: the organisation as a whole (any side it has on). Archived and merged organisations are read-only.
create function partner.side_writable(p_partner uuid, p_side text) returns partner.partner
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  p partner.partner;
  lv core.level;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_side is not null and p_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = p_side;
  end if;
  select * into p from partner.partner where id = p_partner and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  lv := partner.level_of(me, p_partner, p_side);
  if not (authz.is_admin() or lv = 'full'
          or (lv >= 'own' and me in (select partner.side_owners(p_partner, p_side)))) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', coalesce(partner.side_page(p_side),
                 (select partner.side_page(s.side) from partner.partner_side s where s.partner_id = p_partner
                  and s.deleted_at is null order by s.side limit 1), 'clients'), 'level', 'own')::text;
  end if;
  if p.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'partner.archived';
  end if;
  return p;
end
$$;

-- ================================================================ the dates rule (V400)
-- An entry is logged late when, after go-live, it was logged more than work.late_days after the day it happened;
-- entries dated before go-live never are.
create function core.logged_late(p_happened_on date, p_logged_at timestamptz) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(core.riyadh_day(p_logged_at) - p_happened_on
                    > coalesce((core.setting_at('work.late_days', null, core.riyadh_today()) #>> '{}')::int, 14)
                  and p_happened_on >= nullif(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', '')::date,
                  false)
$$;

-- ================================================================ notes and mentions (§3.4, V150)
-- Each person @mentioned is told once (notify.push 'mentioned', linked to the record) — and may be mentioned only when
-- they can see the record.
create function core.mentions_add(p_note uuid, p_people uuid[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n core.note;
  who uuid;
  k int := 0;
begin
  select * into n from core.note where id = p_note;
  foreach who in array coalesce(p_people, '{}') loop
    if exists (select 1 from core.mention m where m.note_id = p_note and m.person_id = who) then
      continue;
    end if;
    if not exists (select 1 from core.person p where p.id = who and p.kind = 'staff' and p.active and p.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = who::text;
    end if;
    if not authz.can_see_as(who, n.entity_table, n.entity_id) then
      raise exception using errcode = 'P0001', message = 'note.mention_cannot_see', detail = who::text;
    end if;
    insert into core.mention (note_id, person_id) values (p_note, who);
    perform notify.push(who, 'mentioned', n.entity_table, n.entity_id, 'notify.mentioned',
                        pg_catalog.jsonb_build_object('note_id', p_note, 'kind', n.kind));
    k := k + 1;
  end loop;
  return k;
end
$$;

-- The words of a refused note, by the rule it broke.
create function core.note_refused(p_constraint text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select case p_constraint
           when 'note_body_required' then 'note.body_required'
           when 'note_not_after_logged' then 'common.date_in_future'
           when 'note_next_step_has_day' then 'note.next_step_day_required'
           when 'note_next_step_after' then 'note.next_step_before_it'
           else 'note.invalid' end
$$;

-- A comment, an update or a meeting note on any record the person may add to, on the day it happened (today unless
-- said). Activities go through Log activity; escalations through Escalate (P5-1).
create function core.note_add(p_entity text, p_id uuid, p_kind text, p_body text, p_happened_on date default null,
                              p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  nid uuid;
  req uuid;
  what text;
begin
  if not core.may_write(e.table_name, p_id) then
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
$$;

-- An activity's outcome, of its type, by key or id; a type with outcomes needs one.
create function partner.outcome_of(p_type partner.activity_type, p_outcome text) returns partner.activity_outcome
language plpgsql stable security definer set search_path = ''
as $$
declare
  o partner.activity_outcome;
begin
  if p_outcome is null then
    if exists (select 1 from partner.activity_outcome x where x.activity_type_id = p_type.id and x.active
               and x.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'partner.outcome_required', detail = p_type.key;
    end if;
    return null;
  end if;
  select * into o from partner.activity_outcome x
  where x.activity_type_id = p_type.id and x.active and x.deleted_at is null and (x.key = p_outcome or x.id::text = p_outcome);
  if o.id is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_outcome', detail = p_outcome;
  end if;
  return o;
end
$$;

-- Log activity (V401): one click on an organisation — the type and its outcome from the settings lists, the day it
-- happened, an optional line and an optional next step with its day (the task on My day joins with tasks, P5-1). "Demo
-- set" needs the demo's day (V406); "meeting set" and "demo held" tell the screen what to offer.
create function partner.activity_log(p_partner uuid, p_type text, p_outcome text default null,
                                     p_happened_on date default null, p_body text default null,
                                     p_next_step text default null, p_next_step_on date default null,
                                     p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record('partner', p_partner);
  t partner.activity_type;
  o partner.activity_outcome;
  nid uuid;
  req uuid;
  what text;
begin
  if (select p.archived_at from partner.partner p where p.id = p_partner) is not null then
    raise exception using errcode = 'P0001', message = 'partner.archived';
  end if;
  if not core.may_write(e.table_name, p_partner) then
    perform partner.side_writable(p_partner, null);
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
  req := audit.begin('ui', 'partner.activity_logged', pg_catalog.jsonb_build_object('type', t.key, 'outcome', o.key), null);
  perform audit.happened(p_happened_on);
  begin
    insert into core.note (entity_table, entity_id, kind, body, happened_on, activity_type_id, outcome_id, next_step,
                           next_step_on)
    values ('partner.partner', p_partner, 'activity', nullif(pg_catalog.btrim(p_body), ''),
            coalesce(p_happened_on, core.riyadh_today()), t.id, o.id, nullif(pg_catalog.btrim(p_next_step), ''),
            p_next_step_on)
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = core.note_refused(what);
  end;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req, 'type', t.key, 'outcome', o.key,
    'meaning', o.meaning, 'counts_as_demo', coalesce(o.counts_as_demo, false),
    'offer_task', o.meaning = 'meeting_set', 'offer_close_demo_task', o.meaning = 'demo_held',
    'demo_on', case when o.meaning = 'demo_set' then p_next_step_on end);
end
$$;

-- Only its author edits a note (marked edited): its words, its day, and an activity's outcome and next step; new
-- mentions are told, removed ones dropped.
create function core.note_edit(p_id uuid, p_values jsonb, p_version int, p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n core.note;
  v jsonb := coalesce(p_values, '{}');
  k text;
  t partner.activity_type;
  o partner.activity_outcome;
  req uuid;
  what text;
begin
  select * into n from core.note where id = p_id and deleted_at is null;
  if me is null or n.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if n.created_by <> me then
    raise exception using errcode = '42501', message = 'note.not_yours';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('body', 'happened_on', 'outcome', 'next_step', 'next_step_on')
       or (n.kind <> 'activity' and k in ('outcome', 'next_step', 'next_step_on')) then
      raise exception using errcode = 'P0001', message = 'note.unknown_field', detail = k;
    end if;
  end loop;
  if v ? 'body' then
    v := v || pg_catalog.jsonb_build_object('body', nullif(pg_catalog.btrim(v ->> 'body'), ''));
  end if;
  if v ? 'next_step' then
    v := v || pg_catalog.jsonb_build_object('next_step', nullif(pg_catalog.btrim(v ->> 'next_step'), ''));
  end if;
  if v ? 'outcome' then
    select * into t from partner.activity_type where id = n.activity_type_id;
    o := partner.outcome_of(t, v ->> 'outcome');
    v := (v - 'outcome') || pg_catalog.jsonb_build_object('outcome_id', o.id);
  end if;
  perform core.check_version('core.note', p_id, p_version,
    (select pg_catalog.array_agg(x) from pg_catalog.jsonb_object_keys(v) x where (pg_catalog.to_jsonb(n) -> x) is distinct from (v -> x)));
  req := audit.begin('ui', 'note.edited', pg_catalog.jsonb_build_object('kind', n.kind), null);
  begin
    perform audit.write_fields('core.note', p_id, v || pg_catalog.jsonb_build_object('edited_at', core.clock()));
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = core.note_refused(what);
  end;
  if p_mentions is not null then
    delete from core.mention where note_id = p_id and not (person_id = any (p_mentions));
    perform core.mentions_add(p_id, p_mentions);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from core.note x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- Its author removes a note; so do admins and those with Full on its record. One request, one Undo.
create function core.notes_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n record;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  for n in select i.id, x.id as found, x.created_by, x.entity_table, x.entity_id
           from pg_catalog.unnest(p_ids) i(id) left join core.note x on x.id = i.id and x.deleted_at is null loop
    if n.found is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (n.created_by = me or authz.is_admin() or authz.record_level(me, n.entity_table, n.entity_id) = 'full') then
      raise exception using errcode = '42501', message = 'note.not_yours';
    end if;
  end loop;
  req := audit.begin('ui', 'note.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update core.note set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- A record's timeline, newest day first, for anyone who may see the record.
create function core.notes(p_entity text, p_id uuid, p_kinds text[] default null, p_limit int default 50,
                           p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'body', n.body, 'happened_on', n.happened_on, 'logged_at', n.logged_at,
      'logged_late', core.logged_late(n.happened_on, n.logged_at),
      'type', t.key, 'type_en', t.name_en, 'type_ar', t.name_ar,
      'outcome', o.key, 'outcome_en', o.name_en, 'outcome_ar', o.name_ar, 'meaning', o.meaning,
      'next_step', n.next_step, 'next_step_on', n.next_step_on, 'next_step_task_id', n.next_step_task_id,
      'author_id', n.created_by, 'edited_at', n.edited_at, 'version', n.version, 'mine', n.created_by = me,
      'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                            from core.mention m where m.note_id = n.id), '[]'::jsonb))
      order by n.happened_on desc, n.logged_at desc, n.id)
    from (select * from core.note x
          where x.entity_table = e.table_name and x.entity_id = p_id and x.deleted_at is null
            and (p_kinds is null or x.kind = any (p_kinds))
          order by x.happened_on desc, x.logged_at desc, x.id
          limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) n
    left join partner.activity_type t on t.id = n.activity_type_id
    left join partner.activity_outcome o on o.id = n.outcome_id), '[]'::jsonb);
end
$$;

-- ================================================================ an organisation gone stale (V401, V151)
-- The day an organisation goes stale: partner.stale_after_days (21) after its latest activity (by the day it happened;
-- with none yet, after its sides came on), and never before the day after its latest next step — an open next step
-- keeps it fresh. None while it is archived, or when every side it has on is Lost.
create function partner.stale_on(p_partner uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select case when p.archived_at is null and p.deleted_at is null
                   and exists (select 1 from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
                               and partner.side_on(p.id, s.side)
                               and partner.status_of(p.id, s.side) is distinct from 'lost')
              then greatest(coalesce(a.last_on, sd.since_on)
                              + coalesce((core.setting_at('partner.stale_after_days', null, core.riyadh_today()) #>> '{}')::int, 21),
                            a.next_on + 1) end
  from partner.partner p
  left join lateral (select pg_catalog.max(n.happened_on) as last_on, pg_catalog.max(n.next_step_on) as next_on
                     from core.note n
                     where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity'
                       and n.deleted_at is null) a on true
  left join lateral (select pg_catalog.min(s.since) as since_on from partner.partner_side s
                     where s.partner_id = p.id and s.deleted_at is null and partner.side_on(p.id, s.side)) sd on true
  where p.id = p_partner
$$;

create function partner.last_activity_on(p_partner uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.max(n.happened_on) from core.note n
  where n.entity_table = 'partner.partner' and n.entity_id = p_partner and n.kind = 'activity' and n.deleted_at is null
$$;

-- The alert (§3.3): the day an organisation goes stale, the owners of its live sides are told, once.
create function notify.alert_activity_stale() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select distinct o.person_id, 'activity_stale:' || p.id || ':' || core.riyadh_today(), 'partner.partner', p.id,
         'alert.activity_stale',
         pg_catalog.jsonb_build_object('partner_id', p.id, 'number', p.number,
                                       'last_activity_on', partner.last_activity_on(p.id))
  from partner.partner p
  join partner.partner_side s on s.partner_id = p.id and s.deleted_at is null
  cross join lateral partner.side_owners(p.id, s.side) o(person_id)
  where p.deleted_at is null and p.archived_at is null and partner.side_on(p.id, s.side)
    and partner.status_of(p.id, s.side) is distinct from 'lost'
    and partner.stale_on(p.id) = core.riyadh_today()
$$;

-- ================================================================ file names, live (V55)
-- A name's extension: lower case, letters and digits, '' when none.
create function core.file_ext(p_name text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select coalesce(pg_catalog.lower((pg_catalog.regexp_match(p_name, '\.([A-Za-z0-9]{1,10})$'))[1]), '') $$;

-- Each record type a file can belong to gives its tokens through <table>_file_tokens(id, locale); later steps add
-- theirs (an invoice's {number} and {amount} — P4).
create function partner.partner_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'partner', case when p_locale = 'ar' then coalesce(p.trade_name_ar, p.trade_name_en) else p.trade_name_en end,
    'partner official', case when p_locale = 'ar'
                             then coalesce(p.official_name_ar, p.official_name_en, p.trade_name_ar, p.trade_name_en)
                             else coalesce(p.official_name_en, p.trade_name_en) end,
    'number', p.number,
    'record', case when p_locale = 'ar' then coalesce(p.trade_name_ar, p.trade_name_en) else p.trade_name_en end)
  from partner.partner p where p.id = p_id
$$;

create function partner.contract_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select partner.partner_file_tokens(c.partner_id, p_locale) || pg_catalog.jsonb_build_object(
    'title', c.title, 'record', c.title,
    'start', pg_catalog.to_char(c.start_on, 'YYYY-MM-DD'),
    'end', coalesce(pg_catalog.to_char(c.end_on, 'YYYY-MM-DD'), case when p_locale = 'ar' then 'مفتوح' else 'open-ended' end))
  from partner.contract c where c.id = p_id
$$;

create function core.person_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('person', x.name, 'record', x.name)
  from (select case when p_locale = 'ar'
                    then coalesce(pr.display_name_ar, p.nickname_ar, p.full_name_ar, pr.display_name_en, p.nickname_en, p.full_name_en)
                    else coalesce(pr.display_name_en, p.nickname_en, p.full_name_en) end as name
        from core.person p left join core.person_profile pr on pr.person_id = p.id where p.id = p_id) x
$$;

-- The name a file is shown and downloaded under, now (V55): its kind's pattern in the locale, each token from the
-- records it is linked to ({date} is the upload day, {original} its original name, {kind} its kind); a token with no
-- value is dropped with its separator; characters a file system refuses become '-'; its extension kept.
create function core.file_display_name(p_file uuid, p_locale text default 'en') returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  f core.file;
  k core.file_kind;
  ext text;
  tok jsonb;
  t jsonb;
  l record;
  fn regprocedure;
  m text[];
  nm text := '';
begin
  select * into f from core.file where id = p_file;
  if f.id is null then
    return null;
  end if;
  select * into k from core.file_kind where id = f.kind_id;
  ext := core.file_ext(f.original_name);
  tok := pg_catalog.jsonb_build_object(
    'date', pg_catalog.to_char(core.riyadh_day(f.created_at), 'YYYY-MM-DD'),
    'original', case when ext = '' then f.original_name
                     else pg_catalog.left(f.original_name, pg_catalog.length(f.original_name) - pg_catalog.length(ext) - 1) end,
    'kind', case when p_locale = 'ar' then k.name_ar else k.name_en end);
  for l in select x.entity_table, x.entity_id from core.file_link x
           where x.file_id = f.id and x.deleted_at is null order by x.created_at, x.id loop
    fn := pg_catalog.to_regprocedure(l.entity_table || '_file_tokens(uuid, text)');
    if fn is not null then
      execute pg_catalog.format('select %s($1, $2)', fn::regproc) into t using l.entity_id, p_locale;
      tok := tok || coalesce(t, '{}');
    end if;
  end loop;
  for m in select pg_catalog.regexp_matches(case when p_locale = 'ar' then k.name_pattern_ar else k.name_pattern_en end,
                                            '\{[a-z ]+\}|[^{]+|\{', 'g') loop
    if m[1] ~ '^\{[a-z ]+\}$' then
      nm := nm || coalesce(tok ->> pg_catalog.substr(m[1], 2, pg_catalog.length(m[1]) - 2), '');
    else
      nm := nm || m[1];
    end if;
  end loop;
  nm := pg_catalog.regexp_replace(nm, '[\\/:*?"<>|[:cntrl:]]', '-', 'g');
  nm := pg_catalog.regexp_replace(nm, '\s+', ' ', 'g');
  nm := pg_catalog.regexp_replace(nm, '(\s*·\s*)+', ' · ', 'g');
  nm := pg_catalog.btrim(nm, ' ·');
  if nm = '' then
    nm := tok ->> 'original';
  end if;
  return pg_catalog.left(nm, 150) || case when ext <> '' then '.' || ext else '' end;
end
$$;

-- ================================================================ files: register, finish, list, download, change, remove
-- Whether the signed-in person may change or remove a file: its uploader, an admin, or whoever may add to a record it
-- is linked to (on one side of an organisation: Full on that side, or Own and its owner) — a person's photo only its
-- uploader or an admin.
create function core.file_may_change(p_file uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    return false;
  end if;
  return authz.is_admin()
      or exists (select 1 from core.file f where f.id = p_file and f.created_by = me)
      or exists (select 1 from core.file_link l
                 where l.file_id = p_file and l.deleted_at is null and l.purpose <> 'avatar'
                   and case when l.side is not null
                            then partner.level_of(me, l.entity_id, l.side) = 'full'
                                 or (partner.level_of(me, l.entity_id, l.side) >= 'own'
                                     and me in (select partner.side_owners(l.entity_id, l.side)))
                            else core.may_write(l.entity_table, l.entity_id) end);
end
$$;

-- Registers a pending file linked to a record — on an organisation, to one side of it or to both — and answers where
-- the browser uploads it (§3.4). A logo is an organisation's (Full on it), a photo the person's own; a travel policy a
-- client's, with its review date. Size cap and types: the settings files.max_mb and files.allowed_types; pictures at
-- most 2 MB, logos PNG or SVG (V53).
create function core.file_begin(p_entity text, p_id uuid, p_kind text, p_purpose text, p_original_name text,
                                p_size bigint, p_mime text, p_sensitivity text default null, p_side text default null,
                                p_review_on date default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
  k core.file_kind;
  nm text := pg_catalog.btrim(p_original_name);
  v_side text := p_side;
  b text;
  cap bigint;
  types jsonb;
  fid uuid := pg_catalog.gen_random_uuid();
  pth text;
  sens text;
  req uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_purpose is null or p_purpose not in ('evidence', 'contract', 'agreement', 'attachment', 'iban_letter', 'render',
                                            'logo', 'avatar', 'travel_policy', 'tender') then
    raise exception using errcode = 'P0001', message = 'file.unknown_purpose', detail = p_purpose;
  end if;
  if p_purpose = 'avatar' and (p_entity is distinct from 'person' or p_id is distinct from me) then
    raise exception using errcode = '42501', message = 'file.avatar_is_your_own';
  end if;
  e := core.can_see_record(p_entity, p_id);
  if v_side is not null and e.table_name <> 'partner.partner' then
    raise exception using errcode = 'P0001', message = 'file.side_only_on_organisations';
  end if;
  if p_purpose = 'travel_policy' then
    v_side := coalesce(v_side, 'client');
    if e.table_name <> 'partner.partner' or v_side <> 'client' then
      raise exception using errcode = 'P0001', message = 'file.travel_policy_is_a_clients';
    end if;
  end if;
  if p_purpose = 'avatar' then
    if e.table_name <> 'core.person' or p_id <> me then
      raise exception using errcode = '42501', message = 'file.avatar_is_your_own';
    end if;
  elsif p_purpose = 'logo' then
    if e.table_name <> 'partner.partner' or v_side is not null then
      raise exception using errcode = 'P0001', message = 'file.logo_is_an_organisations';
    end if;
    perform partner.writable(p_id);
  elsif e.table_name = 'partner.partner' then
    perform partner.side_writable(p_id, v_side);
  elsif not core.may_write(e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  select * into k from core.file_kind x where x.key = p_kind and x.active and x.deleted_at is null;
  if k.id is null then
    raise exception using errcode = 'P0002', message = 'file.unknown_kind', detail = p_kind;
  end if;
  if k.review_required and p_review_on is null then
    raise exception using errcode = 'P0001', message = 'file.review_date_required', detail = k.key;
  end if;
  if nm is null or nm = '' or pg_catalog.length(nm) > 255 or nm ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'file.name_invalid';
  end if;
  nm := pg_catalog.regexp_replace(nm, '[\\/]', '-', 'g');
  b := case when p_purpose in ('logo', 'avatar') then 'images' else 'files' end;
  cap := case when b = 'images' then 2097152
              else coalesce((core.setting_at('files.max_mb', null, core.riyadh_today()) #>> '{}')::bigint, 20) * 1048576 end;
  if p_size is null or p_size <= 0 or p_size > cap then
    raise exception using errcode = 'P0001', message = 'file.too_large', detail = (cap / 1048576)::text;
  end if;
  types := case p_purpose when 'logo' then '["image/png", "image/svg+xml"]'::jsonb
                          when 'avatar' then '["image/png", "image/jpeg", "image/webp"]'::jsonb
                          else core.setting_at('files.allowed_types', null, core.riyadh_today()) end;
  if not coalesce(types ? pg_catalog.lower(p_mime), false) then
    raise exception using errcode = 'P0001', message = 'file.type_not_allowed', detail = p_mime;
  end if;
  sens := case when p_purpose = 'iban_letter' then 'restricted' else coalesce(p_sensitivity, k.sensitivity) end;
  if sens not in ('normal', 'restricted') then
    raise exception using errcode = 'P0001', message = 'file.sensitivity_invalid', detail = sens;
  end if;
  pth := pg_catalog.to_char(core.riyadh_today(), 'YYYY/MM') || '/' || fid
         || case when core.file_ext(nm) <> '' then '.' || core.file_ext(nm) else '' end;
  req := audit.begin('ui', 'file.added', pg_catalog.jsonb_build_object('kind', k.key, 'purpose', p_purpose), null);
  insert into core.file (id, bucket, path, original_name, kind_id, mime, size_bytes, sensitivity, review_on)
  values (fid, b, pth, nm, k.id, pg_catalog.lower(p_mime), p_size, sens, p_review_on);
  insert into core.file_link (file_id, entity_table, entity_id, purpose, side)
  values (fid, e.table_name, p_id, p_purpose, v_side);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', fid, 'bucket', b, 'path', pth, 'request_id', req);
end
$$;

-- The uploader marks the file stored once Storage holds it, with its checksum. A logo becomes its organisation's logo,
-- a photo its owner's picture.
create function core.file_finish(p_id uuid, p_sha256 text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f core.file;
  l core.file_link;
  req uuid;
begin
  select * into f from core.file where id = p_id and deleted_at is null;
  if me is null or f.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if f.created_by <> me then
    raise exception using errcode = '42501', message = 'file.not_yours';
  end if;
  if f.status = 'stored' then
    raise exception using errcode = 'P0001', message = 'file.already_stored';
  end if;
  if p_sha256 is null or pg_catalog.lower(p_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'file.checksum_invalid';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = f.bucket and o.name = f.path) then
    raise exception using errcode = 'P0001', message = 'file.not_uploaded';
  end if;
  req := audit.begin('ui', 'file.stored', null, null);
  update core.file set status = 'stored', sha256 = pg_catalog.lower(p_sha256), stored_at = core.clock() where id = p_id;
  for l in select * from core.file_link x where x.file_id = p_id and x.deleted_at is null and x.purpose in ('logo', 'avatar') loop
    if l.purpose = 'logo' then
      update partner.partner set logo_file_id = p_id where id = l.entity_id;
    elsif exists (select 1 from core.person_profile pr where pr.person_id = l.entity_id) then
      update core.person_profile set avatar_file_id = p_id where person_id = l.entity_id;
    else
      insert into core.person_profile (person_id, avatar_file_id) values (l.entity_id, p_id);
    end if;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
    'display_name_en', core.file_display_name(p_id, 'en'), 'display_name_ar', core.file_display_name(p_id, 'ar'));
end
$$;

-- A record's files, for anyone who may see the record — each only where the file itself is visible; on an organisation,
-- one side's (and the shared ones) when a side is named. The original name shows while core.file_keep_original_name is on.
create function core.files(p_entity text, p_id uuid, p_side text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  keep boolean := coalesce((core.setting_at('core.file_keep_original_name', null, core.riyadh_today()) #>> '{}')::boolean, true);
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', f.id, 'link_id', l.id, 'kind', k.key, 'kind_en', k.name_en, 'kind_ar', k.name_ar, 'purpose', l.purpose,
      'side', l.side, 'display_name_en', core.file_display_name(f.id, 'en'),
      'display_name_ar', core.file_display_name(f.id, 'ar'),
      'original_name', case when keep then f.original_name end, 'mime', f.mime, 'size_bytes', f.size_bytes,
      'sensitivity', f.sensitivity, 'status', f.status, 'review_on', f.review_on,
      'review_due', f.review_on <= core.riyadh_today(), 'added_by', f.created_by, 'added_at', f.created_at,
      'version', f.version) order by f.created_at desc, f.id)
    from core.file_link l join core.file f on f.id = l.file_id join core.file_kind k on k.id = f.kind_id
    where l.entity_table = e.table_name and l.entity_id = p_id and l.deleted_at is null and f.deleted_at is null
      and (p_side is null or l.side is null or l.side = p_side) and authz.file_visible(f.id)), '[]'::jsonb);
end
$$;

-- What the browser needs to download a file (§3.4): where it is and the name to save it under — its display name in
-- the reader's language while core.file_download_display_name is on, else its original name. The browser then asks
-- Storage for a signed URL (600 s for documents, 24 h for pictures) with that name; Storage's own rule checks again.
create function core.file_download(p_id uuid, p_locale text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f core.file;
  loc text;
begin
  select * into f from core.file where id = p_id and deleted_at is null;
  if me is null or f.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not authz.file_visible(p_id) then
    raise exception using errcode = '42501', message = 'file.cannot_see';
  end if;
  if f.status <> 'stored' then
    raise exception using errcode = 'P0001', message = 'file.not_stored';
  end if;
  loc := coalesce(p_locale, (select pr.locale from core.person_profile pr where pr.person_id = me), 'en');
  return pg_catalog.jsonb_build_object('bucket', f.bucket, 'path', f.path, 'mime', f.mime,
    'download_name', case when coalesce((core.setting_at('core.file_download_display_name', null, core.riyadh_today()) #>> '{}')::boolean, true)
                          then core.file_display_name(f.id, loc) else f.original_name end,
    'expires_in', case when f.bucket = 'images' then 86400 else 600 end);
end
$$;

-- A file's review date (a travel policy's next review — V401), changed by whoever may change the file.
create function core.file_review_set(p_id uuid, p_review_on date, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  f core.file;
  req uuid;
begin
  select * into f from core.file where id = p_id and deleted_at is null;
  if authz.me() is null or f.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not core.file_may_change(p_id) then
    raise exception using errcode = '42501', message = 'file.not_yours';
  end if;
  if p_review_on is null and (select k.review_required from core.file_kind k where k.id = f.kind_id) then
    raise exception using errcode = 'P0001', message = 'file.review_date_required';
  end if;
  perform core.check_version('core.file', p_id, p_version,
    case when f.review_on is distinct from p_review_on then array['review_on'] end);
  req := audit.begin('ui', 'file.review_set', null, null);
  perform audit.write_fields('core.file', p_id, pg_catalog.jsonb_build_object('review_on', p_review_on));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from core.file x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- Removes files (and their links): whoever may change each. A logo or photo removed leaves its organisation or person
-- without one. One request, one Undo.
create function core.files_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f record;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  for f in select i.id, x.id as found from pg_catalog.unnest(p_ids) i(id)
           left join core.file x on x.id = i.id and x.deleted_at is null loop
    if f.found is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not core.file_may_change(f.id) then
      raise exception using errcode = '42501', message = 'file.not_yours';
    end if;
  end loop;
  req := audit.begin('ui', 'file.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update partner.partner set logo_file_id = null where logo_file_id = any (p_ids);
  update core.person_profile set avatar_file_id = null where avatar_file_id = any (p_ids);
  update core.file_link set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason
  where file_id = any (p_ids) and deleted_at is null;
  update core.file set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- The alert (§3.3, V401): on a file's review day, its uploader and the owners of the records it belongs to (on one side
-- of an organisation: that side's owner) are told, once.
create function notify.alert_file_review() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  with f as (
    select x.id, x.created_by, x.review_on from core.file x
    where x.deleted_at is null and x.status = 'stored' and x.review_on = core.riyadh_today()
  ), who as (
    select f.id as file_id, f.created_by as person_id from f
    union
    select f.id, o from f join core.file_link l on l.file_id = f.id and l.deleted_at is null
      cross join lateral pg_catalog.unnest(case when l.side is not null
                                                then array(select partner.side_owners(l.entity_id, l.side))
                                                else core.owners_of(l.entity_table, l.entity_id) end) o
  )
  select w.person_id, 'file_review:' || f.id || ':' || f.review_on, 'core.file', f.id, 'alert.file_review',
         pg_catalog.jsonb_build_object('file_id', f.id, 'review_on', f.review_on)
  from who w join f on f.id = w.file_id
  where w.person_id is not null
$$;

-- ================================================================ contracts, per side (V56, V98, V153)
-- A contract's status on a day, computed, never stored: Not started, Active, Expires in N days (from
-- partner.contract_expiring_from_days before its end, its last day included), Expired.
create function partner.contract_state(p_start date, p_end date, p_on date default null) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'status', case when p_start > x.d then 'not_started'
                   when p_end < x.d then 'expired'
                   when p_end - x.d <= coalesce((core.setting_at('partner.contract_expiring_from_days', null, x.d) #>> '{}')::int, 30)
                     then 'expiring'
                   else 'active' end,
    'days_left', p_end - x.d)
  from (select coalesce(p_on, core.riyadh_today()) as d) x
$$;

-- Add or change a contract on one side of an organisation, with its terms in the same request (V56): values side (on
-- adding; it never changes), kind, title, start_on, end_on, reminders_on, reminder_days, notes, and terms
-- [{term, before, after}] — terms left out are removed. Full on that side, or Own and its owner.
create function partner.contract_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null,
                                      p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}') - 'terms';
  c partner.contract;
  p partner.partner;
  k text;
  cid uuid;
  req uuid;
  t jsonb;
  tm partner.term;
  cur partner.contract_term;
  keep uuid[] := '{}';
  what text;
begin
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('side', 'kind', 'title', 'start_on', 'end_on', 'reminders_on', 'reminder_days', 'notes') then
      raise exception using errcode = 'P0001', message = 'contract.unknown_field', detail = k;
    end if;
  end loop;
  if p_values ? 'terms' and pg_catalog.jsonb_typeof(p_values -> 'terms') <> 'array' then
    raise exception using errcode = 'P0001', message = 'contract.terms_list_expected';
  end if;
  if p_id is null then
    if v ->> 'side' is null then
      raise exception using errcode = 'P0001', message = 'contract.side_required';
    end if;
    p := partner.side_writable(p_partner, v ->> 'side');
  else
    select * into c from partner.contract x where x.id = p_id and x.partner_id = p_partner and x.deleted_at is null;
    if c.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if v ? 'side' and v ->> 'side' is distinct from c.side then
      raise exception using errcode = 'P0001', message = 'partner.side_fixed';
    end if;
    p := partner.side_writable(p_partner, c.side);
    v := v - 'side';
    perform core.check_version('partner.contract', p_id, p_version,
      (select pg_catalog.array_agg(x) from pg_catalog.jsonb_object_keys(v) x where (pg_catalog.to_jsonb(c) -> x) is distinct from (v -> x)));
  end if;
  req := audit.begin('ui', 'contract.saved', pg_catalog.jsonb_build_object('partner', p.number,
                                                                            'side', coalesce(c.side, v ->> 'side')), p_reason);
  begin
    if p_id is null then
      insert into partner.contract (partner_id, side, kind, title, start_on, end_on, reminders_on, reminder_days, notes)
      select p_partner, x.side, coalesce(x.kind, 'contract'), pg_catalog.btrim(x.title), x.start_on, x.end_on,
             coalesce(x.reminders_on, true), x.reminder_days, x.notes
      from pg_catalog.jsonb_populate_record(null::partner.contract, v) x
      returning id into cid;
    else
      perform audit.write_fields('partner.contract', p_id, v);
      cid := p_id;
    end if;
    if p_values ? 'terms' then
      for t in select * from pg_catalog.jsonb_array_elements(p_values -> 'terms') loop
        select * into tm from partner.term x where x.key = t ->> 'term' and x.active and x.deleted_at is null;
        if tm.id is null then
          raise exception using errcode = 'P0002', message = 'contract.unknown_term', detail = t ->> 'term';
        end if;
        keep := keep || tm.id;
        select * into cur from partner.contract_term x where x.contract_id = cid and x.term_id = tm.id and x.deleted_at is null;
        if cur.id is null then
          insert into partner.contract_term (contract_id, term_id, value_before, value_after)
          values (cid, tm.id, (t ->> 'before')::numeric, (t ->> 'after')::numeric);
        else
          perform audit.write_fields('partner.contract_term', cur.id,
            pg_catalog.jsonb_build_object('value_before', t -> 'before', 'value_after', t -> 'after'));
        end if;
      end loop;
      update partner.contract_term set deleted_at = core.clock(), deleted_by = me,
                                       delete_reason = coalesce(p_reason, 'term removed')
      where contract_id = cid and deleted_at is null and not (term_id = any (keep));
    end if;
  exception
    when not_null_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = what;
    when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = what;
    when data_exception then
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = sqlerrm;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'version', (select x.version from partner.contract x where x.id = cid),
                                       'request_id', req);
end
$$;

create function partner.contracts_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c record;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  for c in select i.id, x.id as found, x.partner_id, x.side from pg_catalog.unnest(p_ids) i(id)
           left join partner.contract x on x.id = i.id and x.deleted_at is null loop
    if c.found is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform partner.side_writable(c.partner_id, c.side);
  end loop;
  req := audit.begin('ui', 'contract.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update partner.contract set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- Whether a person sees one side's records of an organisation: View on that side's page, or its owner.
create function partner.sees_side(p_person uuid, p_partner uuid, p_side text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_side is null and partner.level_of(p_person, p_partner, null) >= 'view'
      or p_side is not null and (partner.level_of(p_person, p_partner, p_side) >= 'view'
                                 or p_person in (select partner.side_owners(p_partner, p_side)))
$$;

-- An organisation's contracts for the card and the evidence picker — those on the sides the reader sees (one side
-- when named): status, reminder days in force, terms before → after (and whether each is logged as an achievement),
-- and the documents the reader may see.
create function partner.contracts(p_partner uuid, p_side text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := partner.require_level(p_partner, null, 'view');
  days jsonb := core.setting_at('partner.contract_reminder_days', null, core.riyadh_today());
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', c.id, 'side', c.side, 'kind', c.kind, 'title', c.title, 'start_on', c.start_on, 'end_on', c.end_on,
      'reminders_on', c.reminders_on, 'reminder_days', c.reminder_days,
      'reminder_days_in_force', case when c.reminders_on and c.end_on is not null
                                     then coalesce(pg_catalog.to_jsonb(c.reminder_days), days) else '[]'::jsonb end,
      'renewal_task_id', c.renewal_task_id, 'notes', c.notes, 'version', c.version,
      'terms', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', t.id, 'term', tm.key, 'name_en', tm.name_en, 'name_ar', tm.name_ar, 'unit', tm.unit,
          'before', t.value_before, 'after', t.value_after, 'achievement_id', t.achievement_id,
          'logged', t.achievement_id is not null, 'version', t.version) order by tm.sort, tm.key)
        from partner.contract_term t join partner.term tm on tm.id = t.term_id
        where t.contract_id = c.id and t.deleted_at is null), '[]'::jsonb),
      'files', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', f.id, 'purpose', l.purpose, 'display_name_en', core.file_display_name(f.id, 'en'),
          'display_name_ar', core.file_display_name(f.id, 'ar'), 'mime', f.mime, 'size_bytes', f.size_bytes,
          'sensitivity', f.sensitivity) order by f.created_at, f.id)
        from core.file_link l join core.file f on f.id = l.file_id
        where l.entity_table = 'partner.contract' and l.entity_id = c.id and l.deleted_at is null
          and f.deleted_at is null and authz.file_visible(f.id)), '[]'::jsonb))
      || partner.contract_state(c.start_on, c.end_on)
      order by c.start_on desc, c.id)
    from partner.contract c
    where c.partner_id = p_partner and c.deleted_at is null and (p_side is null or c.side = p_side)
      and partner.sees_side(me, p_partner, c.side)), '[]'::jsonb);
end
$$;

-- The contract-expiring alert (V56, §3.3): on each reminder day before a contract's end (its own days, else the
-- setting; none when its reminders are off, or its side is off), its side's owner (the account manager on the Client
-- side, the relationship owner on the other), the followers of the organisation or the contract and — when
-- partner.contract_notify says so — the head of that owner's department (the commercial manager). Once per person,
-- contract and reminder day.
create function notify.alert_contract_expiring() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  with s as (
    select coalesce(core.setting_at('partner.contract_notify', null, core.riyadh_today()), '{}'::jsonb) as who,
           (select pg_catalog.array_agg(x::int) from pg_catalog.jsonb_array_elements_text(
              core.setting_at('partner.contract_reminder_days', null, core.riyadh_today())) x) as days
  ), c as (
    select k.id, k.partner_id, k.side, k.title, k.end_on, k.end_on - core.riyadh_today() as days_left, p.number
    from partner.contract k join partner.partner p on p.id = k.partner_id
    where k.deleted_at is null and k.reminders_on and k.end_on is not null and p.deleted_at is null
      and p.archived_at is null and partner.side_on(k.partner_id, k.side)
      and (k.end_on - core.riyadh_today()) = any (coalesce(k.reminder_days, (select s.days from s)))
  ), who as (
    select c.id as contract_id, o.person_id from c cross join lateral partner.side_owners(c.partner_id, c.side) o(person_id)
    where coalesce(((select s.who from s) ->> 'account_manager')::boolean, true)
    union
    select c.id, f.person_id from c join notify.follow f
      on (f.entity_table = 'partner.partner' and f.entity_id = c.partner_id)
      or (f.entity_table = 'partner.contract' and f.entity_id = c.id)
    where coalesce(((select s.who from s) ->> 'followers')::boolean, true)
    union
    select c.id, d.head_person_id from c cross join lateral partner.side_owners(c.partner_id, c.side) o(person_id)
      join core.person pe on pe.id = o.person_id join core.department d on d.id = pe.department_id
    where coalesce(((select s.who from s) ->> 'commercial_manager')::boolean, false) and d.head_person_id is not null
  )
  select w.person_id, 'contract_expiring:' || c.id || ':' || c.days_left, 'partner.contract', c.id,
         'alert.contract_expiring',
         pg_catalog.jsonb_build_object('partner_id', c.partner_id, 'number', c.number, 'side', c.side, 'title', c.title,
                                       'days', c.days_left, 'end_on', c.end_on)
  from who w join c on c.id = w.contract_id
$$;

-- ================================================================ references to Direct's systems (V98, V409, V154)
-- Add or change a reference: values side (on adding: a side, or none for both; it never changes), system (key or id),
-- value, url. Anything that looks like a password is refused. Full on that side, or Own and its owner.
create function partner.reference_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null,
                                       p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v jsonb := coalesce(p_values, '{}');
  r partner.reference;
  p partner.partner;
  k text;
  sys uuid;
  rid uuid;
  req uuid;
  what text;
begin
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('side', 'system', 'value', 'url') then
      raise exception using errcode = 'P0001', message = 'reference.unknown_field', detail = k;
    end if;
  end loop;
  if v ? 'system' then
    select x.id into sys from work.ref_system x
    where (x.key = v ->> 'system' or x.id::text = v ->> 'system') and x.active and x.deleted_at is null;
    if sys is null then
      raise exception using errcode = 'P0002', message = 'reference.unknown_system', detail = v ->> 'system';
    end if;
    v := (v - 'system') || pg_catalog.jsonb_build_object('system_id', sys);
  end if;
  if v ? 'value' then
    v := v || pg_catalog.jsonb_build_object('value', pg_catalog.btrim(v ->> 'value'));
  end if;
  if v ? 'url' then
    v := v || pg_catalog.jsonb_build_object('url', nullif(pg_catalog.btrim(v ->> 'url'), ''));
  end if;
  if p_id is null then
    p := partner.side_writable(p_partner, v ->> 'side');
  else
    select * into r from partner.reference x where x.id = p_id and x.partner_id = p_partner and x.deleted_at is null;
    if r.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if v ? 'side' and v ->> 'side' is distinct from r.side then
      raise exception using errcode = 'P0001', message = 'partner.side_fixed';
    end if;
    p := partner.side_writable(p_partner, r.side);
    v := v - 'side';
    perform core.check_version('partner.reference', p_id, p_version,
      (select pg_catalog.array_agg(x) from pg_catalog.jsonb_object_keys(v) x where (pg_catalog.to_jsonb(r) -> x) is distinct from (v -> x)));
  end if;
  req := audit.begin('ui', 'reference.saved', pg_catalog.jsonb_build_object('partner', p.number), p_reason);
  begin
    if p_id is null then
      insert into partner.reference (partner_id, side, system_id, value, url)
      select p_partner, x.side, x.system_id, x.value, x.url
      from pg_catalog.jsonb_populate_record(null::partner.reference, v) x
      returning id into rid;
    else
      perform audit.write_fields('partner.reference', p_id, v);
      rid := p_id;
    end if;
  exception
    when check_violation then
      get stacked diagnostics what = constraint_name;
      if what = 'reference_no_secrets' then
        raise exception using errcode = 'P0001', message = 'partner.no_secrets',
          detail = 'Cards hold references to Direct''s systems, never passwords.';
      end if;
      raise exception using errcode = 'P0001', message = 'reference.invalid', detail = what;
    when not_null_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'reference.invalid', detail = what;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'version', (select x.version from partner.reference x where x.id = rid),
                                       'request_id', req);
end
$$;

create function partner.references_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r record;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  for r in select i.id, x.id as found, x.partner_id, x.side from pg_catalog.unnest(p_ids) i(id)
           left join partner.reference x on x.id = i.id and x.deleted_at is null loop
    if r.found is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform partner.side_writable(r.partner_id, r.side);
  end loop;
  req := audit.begin('ui', 'reference.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update partner.reference set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- An organisation's references the reader sees (the shared ones, and those of the sides they see), each with its link:
-- its own URL, else the system's URL pattern filled with the value.
create function partner.references(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := partner.require_level(p_partner, null, 'view');
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', r.id, 'side', r.side, 'system', s.key, 'system_en', s.name_en, 'system_ar', s.name_ar, 'value', r.value,
      'url', r.url, 'link', coalesce(r.url, pg_catalog.replace(s.url_template, '{value}', r.value)),
      'version', r.version) order by s.sort, s.key, r.value)
    from partner.reference r join work.ref_system s on s.id = r.system_id
    where r.partner_id = p_partner and r.deleted_at is null and partner.sees_side(me, p_partner, r.side)), '[]'::jsonb);
end
$$;

-- ================================================================ the card, the lists, merge (V98, V155)
-- Each row's computed flags, most urgent first, for its one status chip: stale, then contract expiring (a live contract
-- on a side the reader sees, one side when named, inside its expiring days). Collection due, Quiet, Sent to legal and
-- Tender open join with their steps.
create function partner.flags(p_partner uuid, p_person uuid, p_side text default null) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(x.flag order by x.pri), '[]'::jsonb)
  from (select 'stale' as flag, 1 as pri where partner.stale_on(p_partner) <= core.riyadh_today()
        union all
        select 'contract_expiring', 2 where exists (
          select 1 from partner.contract k
          where k.partner_id = p_partner and k.deleted_at is null and (p_side is null or k.side = p_side)
            and partner.side_on(p_partner, k.side) and partner.sees_side(p_person, p_partner, k.side)
            and partner.contract_state(k.start_on, k.end_on) ->> 'status' = 'expiring')) x
$$;

-- partner.partners_list as P3-8b-1 wrote it, each row adding its last activity and its flags.
create or replace function partner.partners_list(p_filters jsonb default '{}', p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  f jsonb := coalesce(p_filters, '{}');
  v_side text := f ->> 'side';
  me uuid;
  q text := norm.fold(f ->> 'q');
begin
  if v_side is not null and v_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = v_side;
  end if;
  if v_side is not null then
    me := authz.require(partner.side_page(v_side), 'view');
  else
    me := authz.me();
    if me is null then
      raise exception using errcode = '42501', message = 'auth.no_active_person';
    end if;
  end if;
  return (
    with base as (
      select p.*, sd.type_key, sd.tier_id as side_tier_id, sd.status, sd.owner_id
      from partner.partner p
      left join lateral (select t.key as type_key, s.tier_id, partner.status_of(p.id, s.side) as status,
                                (select x from partner.side_owners(p.id, s.side) x limit 1) as owner_id
                         from partner.partner_side s join partner.side_type t on t.id = s.type_id
                         where s.partner_id = p.id and s.side = v_side and s.deleted_at is null) sd on v_side is not null
      where p.deleted_at is null and (coalesce((f ->> 'include_archived')::boolean, false) or p.archived_at is null)
        and case when v_side is not null then partner.side_on(p.id, v_side)
                 else partner.level_of(me, p.id) >= 'view' end
    ), hit as (
      select b.* from base b
      where (q is null or norm.fold(b.trade_name_en) like '%' || q || '%' or norm.fold(b.trade_name_ar) like '%' || q || '%'
             or norm.fold(b.number) like '%' || q || '%')
        and (f -> 'types' is null or b.type_key in (select x from pg_catalog.jsonb_array_elements_text(f -> 'types') x))
        and (f -> 'tiers' is null or b.side_tier_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'tiers') x))
        and (f -> 'owners' is null or b.owner_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'owners') x))
        and (f -> 'statuses' is null or coalesce(b.status, 'none') in (select x from pg_catalog.jsonb_array_elements_text(f -> 'statuses') x))
        and (f -> 'priorities' is null or b.priority_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'priorities') x))
        and (f ->> 'key_partner' is null or b.key_partner = (f ->> 'key_partner')::boolean)
        and (f ->> 'stale' is null or (partner.stale_on(b.id) <= core.riyadh_today()) = (f ->> 'stale')::boolean)
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*) from hit),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', h.id, 'number', h.number, 'trade_name_en', h.trade_name_en, 'trade_name_ar', h.trade_name_ar,
          'type', h.type_key, 'status', h.status, 'owner_id', h.owner_id,
          'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(h.id, s.side) order by s.side)
                             from partner.partner_side s where s.partner_id = h.id and s.deleted_at is null
                               and partner.side_on(h.id, s.side)
                               and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
          'priority_id', h.priority_id, 'key_partner', h.key_partner, 'logo_file_id', h.logo_file_id,
          'last_activity_on', partner.last_activity_on(h.id), 'flags', partner.flags(h.id, me, v_side),
          'archived', h.archived_at is not null, 'version', h.version)
          order by pg_catalog.lower(h.trade_name_en), h.id)
        from (select * from hit order by pg_catalog.lower(hit.trade_name_en), hit.id
              limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(coalesce(p_offset, 0), 0)) h), '[]'::jsonb)));
end
$$;

-- partner.partner_get as P3-8b-1 wrote it, adding the last activity, the day it goes stale and the open next step, the
-- flags, the references the reader sees and the tab counts.
create or replace function partner.partner_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  p partner.partner;
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.require_level(p_id, null, 'view');
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.to_jsonb(p) - array['deleted_at', 'deleted_by', 'delete_reason'] || pg_catalog.jsonb_build_object(
    'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(p.id, s.side) || pg_catalog.jsonb_build_object(
        'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', c.id, 'status', c.status, 'effective_on', c.effective_on, 'reason_id', c.reason_id, 'note', c.note,
            'set_by', c.created_by, 'set_at', c.created_at) order by c.effective_on desc, c.created_at desc)
          from partner.side_status_change c where c.partner_id = p.id and c.side = s.side and c.deleted_at is null), '[]'::jsonb),
        'owners', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', m.id, 'person_id', m.person_id, 'from', m.effective_from, 'to', m.effective_to, 'reason', m.reason)
            order by m.effective_from desc)
          from partner.side_owner m where m.partner_id = p.id and m.side = s.side and m.deleted_at is null), '[]'::jsonb))
        order by s.side)
      from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
        and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
    'identifiers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'subkind', i.subkind, 'value', i.value_raw, 'valid_from', i.valid_from,
        'valid_to', i.valid_to, 'source', i.source, 'reason', i.reason, 'added_by', i.created_by, 'added_at', i.created_at)
        order by i.kind, i.created_at)
      from partner.identifier i where i.partner_id = p.id and i.deleted_at is null
        and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))), '[]'::jsonb),
    'owner_id', (select x from partner.owners(p.id) x limit 1),
    'contacts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) - array['deleted_at', 'deleted_by',
        'delete_reason', 'created_by', 'updated_by'] order by c.is_primary desc, c.name_en)
      from partner.contact c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb),
    'credit_limits', case when sees_client and authz.level_of(me, 'finance') >= 'view' then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', c.id, 'amount_sar', c.amount_sar, 'prepaid_only', c.amount_sar = 0, 'effective_from', c.effective_from,
          'approved_by', c.approved_by, 'reason', c.reason) order by c.effective_from desc)
        from partner.credit_limit c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb) end,
    'references', partner.references(p.id),
    'last_activity_on', partner.last_activity_on(p.id),
    'stale_on', partner.stale_on(p.id),
    'next_step', (select pg_catalog.jsonb_build_object('note_id', n.id, 'text', n.next_step, 'on', n.next_step_on)
                  from core.note n
                  where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity'
                    and n.deleted_at is null and n.next_step_on >= core.riyadh_today()
                  order by n.next_step_on, n.logged_at limit 1),
    'flags', partner.flags(p.id, me),
    'counts', pg_catalog.jsonb_build_object(
      'contracts', (select pg_catalog.count(*) from partner.contract c where c.partner_id = p.id and c.deleted_at is null
                      and partner.sees_side(me, p.id, c.side)),
      'files', (select pg_catalog.count(*) from core.file_link l join core.file f on f.id = l.file_id
                where l.entity_table = 'partner.partner' and l.entity_id = p.id and l.deleted_at is null
                  and f.deleted_at is null and l.purpose <> 'logo' and authz.file_visible(f.id)),
      'notes', (select pg_catalog.count(*) from core.note n
                where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.deleted_at is null)));
end
$$;

-- partner.partner_merge as P3-8b-1 wrote it (V136), now also moving the merged organisation's timeline, files,
-- contracts and references to the kept one — its logo too when the kept one has none; a file already linked to the
-- kept one for the same purpose is not linked twice. Still one request, so one Undo.
create or replace function partner.partner_merge(p_kept uuid, p_merged uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  kept partner.partner := partner.writable(p_kept);
  gone partner.partner := partner.writable(p_merged);
  me uuid := partner.require_cap(p_kept, null, 'merge');
  why text := core.access_reason(p_reason);
  i partner.identifier;
  s partner.partner_side;
  st text;
  req uuid;
begin
  if p_kept = p_merged then
    raise exception using errcode = 'P0001', message = 'partner.merge_itself';
  end if;
  req := audit.begin('ui', 'partner.merged', pg_catalog.jsonb_build_object('kept', kept.number, 'merged', gone.number), why);
  insert into partner.merge (kept_id, merged_id, reason, request_id) values (p_kept, p_merged, why, req);
  for s in select * from partner.partner_side x where x.partner_id = p_merged and x.deleted_at is null loop
    continue when exists (select 1 from partner.partner_side y where y.partner_id = p_kept and y.side = s.side
                          and y.deleted_at is null);
    insert into partner.partner_side (partner_id, side, type_id, tier_id, field_values, since, until)
    values (p_kept, s.side, s.type_id, s.tier_id, s.field_values, s.since, s.until);
    perform partner.side_owner_set_inner(p_kept, s.side, (select x from partner.side_owners(p_merged, s.side) x limit 1),
                                         core.riyadh_today(), why);
    st := partner.status_of(p_merged, s.side);
    if st is not null then
      insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
      select p_kept, s.side, c.status, core.riyadh_today(), c.reason_id, 'merged from ' || gone.number
      from partner.side_status_change c where c.partner_id = p_merged and c.side = s.side and c.deleted_at is null
        and c.effective_on <= core.riyadh_today()
      order by c.effective_on desc, c.created_at desc limit 1;
    end if;
  end loop;
  for i in select * from partner.identifier x where x.partner_id = p_merged and x.deleted_at is null order by x.created_at loop
    update partner.identifier set deleted_at = core.clock(), deleted_by = me,
                                  delete_reason = 'merged into ' || kept.number
    where id = i.id;
    if not exists (select 1 from partner.identifier x where x.partner_id = p_kept and x.kind = i.kind
                   and x.value_key = i.value_key and x.deleted_at is null) then
      insert into partner.identifier (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source,
                                      valid_from, valid_to, note)
      values (p_kept, i.kind, case when i.kind = 'name' then 'alias' else i.subkind end, i.value_raw, i.value_key,
              i.norm_version, why, 'merge', i.valid_from, i.valid_to, i.note);
    end if;
  end loop;
  update partner.contact set partner_id = p_kept, is_primary = false where partner_id = p_merged and deleted_at is null;
  update partner.contract set partner_id = p_kept where partner_id = p_merged and deleted_at is null;
  update partner.reference set partner_id = p_kept where partner_id = p_merged and deleted_at is null;
  update core.note set entity_id = p_kept
  where entity_table = 'partner.partner' and entity_id = p_merged and deleted_at is null;
  if kept.logo_file_id is null and gone.logo_file_id is not null then
    update partner.partner set logo_file_id = gone.logo_file_id where id = p_kept;
  end if;
  update core.file_link l set entity_id = p_kept
  where l.entity_table = 'partner.partner' and l.entity_id = p_merged and l.deleted_at is null
    and (l.purpose <> 'logo' or (kept.logo_file_id is null and l.file_id = gone.logo_file_id))
    and not exists (select 1 from core.file_link x where x.file_id = l.file_id and x.entity_table = 'partner.partner'
                    and x.entity_id = p_kept and x.purpose = l.purpose and x.deleted_at is null);
  update partner.partner set archived_at = core.clock(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$$;

-- ================================================================ grants and the door (V124)
grant execute on function
  core.note_add(text, uuid, text, text, date, uuid[]), core.note_edit(uuid, jsonb, int, uuid[]),
  core.notes_remove(uuid[], text), core.notes(text, uuid, text[], int, int),
  partner.activity_log(uuid, text, text, date, text, text, date, uuid[]),
  core.file_begin(text, uuid, text, text, text, bigint, text, text, text, date), core.file_finish(uuid, text),
  core.files(text, uuid, text), core.file_download(uuid, text), core.file_review_set(uuid, date, int),
  core.files_remove(uuid[], text),
  partner.contract_save(uuid, uuid, jsonb, int, text), partner.contracts_remove(uuid[], text),
  partner.contracts(uuid, text),
  partner.reference_save(uuid, uuid, jsonb, int, text), partner.references_remove(uuid[], text),
  partner.references(uuid)
  to authenticated;

create function api.note_add(p_entity text, p_id uuid, p_kind text, p_body text, p_happened_on date default null,
                             p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.note_add(p_entity, p_id, p_kind, p_body, p_happened_on, p_mentions) $$;
create function api.note_edit(p_id uuid, p_values jsonb, p_version int, p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.note_edit(p_id, p_values, p_version, p_mentions) $$;
create function api.notes_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.notes_remove(p_ids, p_reason) $$;
create function api.notes(p_entity text, p_id uuid, p_kinds text[] default null, p_limit int default 50,
                          p_offset int default 0) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.notes(p_entity, p_id, p_kinds, p_limit, p_offset) $$;
create function api.activity_log(p_partner uuid, p_type text, p_outcome text default null, p_happened_on date default null,
                                 p_body text default null, p_next_step text default null, p_next_step_on date default null,
                                 p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.activity_log(p_partner, p_type, p_outcome, p_happened_on, p_body, p_next_step, p_next_step_on, p_mentions) $$;
create function api.file_begin(p_entity text, p_id uuid, p_kind text, p_purpose text, p_original_name text, p_size bigint,
                               p_mime text, p_sensitivity text default null, p_side text default null,
                               p_review_on date default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.file_begin(p_entity, p_id, p_kind, p_purpose, p_original_name, p_size, p_mime, p_sensitivity, p_side, p_review_on) $$;
create function api.file_finish(p_id uuid, p_sha256 text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.file_finish(p_id, p_sha256) $$;
create function api.files(p_entity text, p_id uuid, p_side text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.files(p_entity, p_id, p_side) $$;
create function api.file_download(p_id uuid, p_locale text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.file_download(p_id, p_locale) $$;
create function api.file_review_set(p_id uuid, p_review_on date, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.file_review_set(p_id, p_review_on, p_version) $$;
create function api.files_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.files_remove(p_ids, p_reason) $$;
create function api.contract_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null,
                                  p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.contract_save(p_partner, p_id, p_values, p_version, p_reason) $$;
create function api.contracts_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.contracts_remove(p_ids, p_reason) $$;
create function api.contracts(p_partner uuid, p_side text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select partner.contracts(p_partner, p_side) $$;
create function api.reference_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null,
                                   p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.reference_save(p_partner, p_id, p_values, p_version, p_reason) $$;
create function api.references_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.references_remove(p_ids, p_reason) $$;
create function api.partner_references(p_partner uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select partner.references(p_partner) $$;

grant execute on function
  api.note_add(text, uuid, text, text, date, uuid[]), api.note_edit(uuid, jsonb, int, uuid[]),
  api.notes_remove(uuid[], text), api.notes(text, uuid, text[], int, int),
  api.activity_log(uuid, text, text, date, text, text, date, uuid[]),
  api.file_begin(text, uuid, text, text, text, bigint, text, text, text, date), api.file_finish(uuid, text),
  api.files(text, uuid, text), api.file_download(uuid, text), api.file_review_set(uuid, date, int),
  api.files_remove(uuid[], text),
  api.contract_save(uuid, uuid, jsonb, int, text), api.contracts_remove(uuid[], text), api.contracts(uuid, text),
  api.reference_save(uuid, uuid, jsonb, int, text), api.references_remove(uuid[], text), api.partner_references(uuid)
  to authenticated;

-- ================================================================ the starting file kinds (generic words)
select audit.begin('system', 'core.file_kinds_seeded');
insert into core.file_kind (key, name_en, name_ar, name_pattern_en, name_pattern_ar, sensitivity, review_required, sort) values
  ('invoice', 'Invoice', 'فاتورة', '{number} · {partner} · {amount} SAR · {date}', '{number} · {partner} · {amount} ر.س · {date}', 'normal', false, 10),
  ('contract', 'Contract', 'عقد', 'Contract · {partner official} · {title} · {start} to {end}',
   'عقد · {partner official} · {title} · {start} إلى {end}', 'normal', false, 20),
  ('agreement', 'Agreement', 'اتفاقية', 'Agreement · {partner official} · {title} · {start} to {end}',
   'اتفاقية · {partner official} · {title} · {start} إلى {end}', 'restricted', false, 30),
  ('rate_sheet', 'Rate sheet', 'جدول الأسعار', 'Rate sheet · {partner} · {date}', 'جدول الأسعار · {partner} · {date}', 'normal', false, 40),
  ('certificate', 'Certificate', 'شهادة', 'Certificate · {partner} · {date}', 'شهادة · {partner} · {date}', 'normal', false, 50),
  ('meeting_note', 'Meeting note', 'محضر اجتماع', 'Meeting note · {record} · {date}', 'محضر اجتماع · {record} · {date}', 'normal', false, 60),
  ('travel_policy', 'Travel policy', 'سياسة السفر', 'Travel policy · {partner} · {date}', 'سياسة السفر · {partner} · {date}', 'normal', true, 65),
  ('tender_document', 'Tender document', 'وثيقة مناقصة', 'Tender document · {record} · {date}', 'وثيقة مناقصة · {record} · {date}', 'normal', false, 68),
  ('evidence', 'Evidence', 'دليل', 'Evidence · {record} · {date}', 'دليل · {record} · {date}', 'normal', false, 70),
  ('report', 'Report', 'تقرير', 'Report · {record} · {date}', 'تقرير · {record} · {date}', 'normal', false, 80),
  ('legacy_report', 'Legacy report', 'تقرير سابق', '{original}', '{original}', 'normal', false, 90),
  ('logo', 'Logo', 'شعار', 'Logo · {partner}', 'شعار · {partner}', 'normal', false, 100),
  ('avatar', 'Photo', 'صورة', 'Photo · {person}', 'صورة · {person}', 'normal', false, 110),
  ('other', 'Other', 'أخرى', '{original}', '{original}', 'normal', false, 120);
select audit.end();
