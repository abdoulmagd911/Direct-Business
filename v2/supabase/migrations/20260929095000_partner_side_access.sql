-- v2 the QA review of #94 and #96 (29 Sep, at d78f58f). V167–V168. Forward-only (V103).
--  · H1: a side's records are read and written only with that side's own page (V147) — a capability never stands in
--    for it, and being named a side's owner opens nothing without at least View on its page;
--  · M2: the card and the hover card name the owner of a side the reader sees, never another's;
--  · an agreement is restricted whatever the upload asks (D10), and a note's removed mention is kept, marked removed.
-- (M1, the contract-expiring alert, is closed by P3-6e: the alerts job asks authz.can_see_as — V163.)

-- ================================================================ a side's owner holds its page (H1)
-- A side's owners today, as P3-8b-1 wrote it — only those with at least View on that side's page: named the owner
-- without it, a person owns nothing of that side (no record of it, no alert of it, no Own writes on it).
create or replace function partner.side_owners(p_partner uuid, p_side text) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.person_id from partner.side_owner m
  where m.partner_id = p_partner and m.deleted_at is null and (p_side is null or m.side = p_side)
    and m.effective_from <= core.riyadh_today() and (m.effective_to is null or m.effective_to > core.riyadh_today())
    and authz.level_of(m.person_id, partner.side_page(m.side)) >= 'view'
$$;

create or replace function partner.side_owner_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select partner.owners_via('partner.side_owner', p_id)
  union
  select m.person_id from partner.side_owner m
  where m.id = p_id and authz.level_of(m.person_id, partner.side_page(m.side)) >= 'view'
$$;

-- ================================================================ reading a side (H1)
-- Whether a person sees one side's records of an organisation: at least View on that side's page — its owner too.
create or replace function partner.sees_side(p_person uuid, p_partner uuid, p_side text) returns boolean
language sql stable security definer set search_path = ''
as $$ select partner.level_of(p_person, p_partner, p_side) >= 'view' $$;

-- core.file_visible_as as P3-8b-2 wrote it, a side's file seen through partner.sees_side (the side's page, V147).
create or replace function core.file_visible_as(p_file uuid, p_person uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  f core.file;
begin
  select * into f from core.file where id = p_file;
  if p_person is null or f.id is null
     or not exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff' and p.active
                    and p.can_sign_in and p.deleted_at is null) then
    return false;
  end if;
  if f.created_by = p_person then
    return true;
  end if;
  if f.status <> 'stored' then
    return false;
  end if;
  if f.bucket = 'images' then
    return true;
  end if;
  if f.sensitivity = 'restricted' and not authz.can_of(p_person, 'files.restricted') then
    return false;
  end if;
  return exists (
    select 1 from core.file_link l
    where l.file_id = f.id and (l.deleted_at is null or f.deleted_at is not null)
      and case when l.side is not null then partner.sees_side(p_person, l.entity_id, l.side)
               else authz.can_see_as(p_person, l.entity_table, l.entity_id) end);
end
$$;

-- ================================================================ writing a side (H1)
-- partner.side_status_set as P3-8b-1 wrote it: the side itself must be writable by the caller (Full on its page, or Own
-- and its owner — partner.side_writable); a non-owner also needs the side's assign capability.
create or replace function partner.side_status_set(p_id uuid, p_side text, p_status text, p_effective_on date default null,
                                                   p_reason_id uuid default null, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.side_writable(p_id, p_side);
  me uuid := authz.me();
  req uuid;
  sid uuid;
begin
  if not (me in (select partner.side_owners(p_id, p_side))) then
    perform authz.require_capability(partner.side_page(p_side) || '.assign');
  end if;
  if p_status in ('at_risk', 'lost') and p_reason_id is null then
    raise exception using errcode = 'P0001', message = 'partner.status_reason_required';
  end if;
  req := audit.begin('ui', 'partner.status_set', pg_catalog.jsonb_build_object('side', p_side, 'status', p_status), p_note);
  insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
  values (p_id, p_side, p_status, coalesce(p_effective_on, core.riyadh_today()), p_reason_id, p_note)
  returning id into sid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', sid, 'status', partner.status_of(p_id, p_side), 'request_id', req);
end
$$;

-- partner.side_owner_set as P3-8b-1 wrote it: the side writable by the caller, and its assign capability.
create or replace function partner.side_owner_set(p_id uuid, p_side text, p_person uuid, p_from date default null,
                                                  p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.side_writable(p_id, p_side);
  req uuid;
begin
  perform authz.require_capability(partner.side_page(p_side) || '.assign');
  if not exists (select 1 from partner.partner_side s where s.partner_id = p_id and s.side = p_side and s.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = p_side;
  end if;
  req := audit.begin('ui', 'partner.owner_set', pg_catalog.jsonb_build_object('side', p_side), p_reason);
  perform partner.side_owner_set_inner(p_id, p_side, p_person, coalesce(p_from, core.riyadh_today()), p_reason);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- partner.identifier_add as P3-8b-1 wrote it: a client ID or a discount code is the Client side's — that side writable
-- by the caller, and clients.identify; a shared identifier, the organisation and the identify capability of a side on.
create or replace function partner.identifier_add(p_partner uuid, p_kind text, p_value text, p_reason text,
                                                  p_subkind text default null, p_valid_from date default null,
                                                  p_valid_to date default null, p_note text default null,
                                                  p_second_code boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  client_only boolean := p_kind in ('payments_client_id', 'discount_code');
  p partner.partner := case when client_only then partner.side_writable(p_partner, 'client')
                            else partner.writable(p_partner) end;
  why text;
  req uuid;
  iid uuid;
begin
  perform partner.require_cap(p_partner, case when client_only then 'client' end, 'identify');
  why := core.access_reason(p_reason);
  if p_kind = 'name' and p_subkind is distinct from 'alias' then
    raise exception using errcode = 'P0001', message = 'identifier.name_follows_partner';
  end if;
  if p_kind = 'discount_code'
     and coalesce((core.setting_at('partner.one_code_per_partner', null, core.riyadh_today()) #>> '{}')::boolean, true)
     and exists (select 1 from partner.identifier i where i.partner_id = p_partner and i.kind = 'discount_code'
                 and i.deleted_at is null
                 and pg_catalog.daterange(i.valid_from, i.valid_to, '[]') && pg_catalog.daterange(p_valid_from, p_valid_to, '[]')) then
    if not p_second_code then
      raise exception using errcode = 'P0001', message = 'identifier.one_code_per_partner';
    end if;
    perform authz.require_capability('clients.assign');
  end if;
  req := audit.begin('ui', 'identifier.added', pg_catalog.jsonb_build_object('kind', p_kind), why);
  iid := partner.identifier_insert(p_partner, p_kind, p_value, p_subkind, why, 'person', p_valid_from, p_valid_to, p_note);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', iid, 'request_id', req);
end
$$;

-- partner.identifier_remove as P3-8b-1 wrote it, with the same rule as adding.
create or replace function partner.identifier_remove(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  i partner.identifier;
  why text;
  req uuid;
begin
  select * into i from partner.identifier where id = p_id and deleted_at is null;
  if i.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if i.kind in ('payments_client_id', 'discount_code') then
    perform partner.side_writable(i.partner_id, 'client');
  else
    perform partner.writable(i.partner_id);
  end if;
  perform partner.require_cap(i.partner_id, case when i.kind in ('payments_client_id', 'discount_code') then 'client' end,
                              'identify');
  why := core.access_reason(p_reason);
  if i.kind = 'name' and i.subkind <> 'alias' then
    raise exception using errcode = 'P0001', message = 'identifier.name_follows_partner';
  end if;
  req := audit.begin('ui', 'identifier.removed', pg_catalog.jsonb_build_object('kind', i.kind), why);
  update partner.identifier set deleted_at = pg_catalog.now(), deleted_by = authz.me(), delete_reason = why where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- ================================================================ an owner the reader may see (M2)
-- The owner of the first side (Client before Supplier & partner) a person sees — the card's and the hover card's owner.
create function partner.owner_seen_by(p_partner uuid, p_person uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select o from partner.partner_side s cross join lateral partner.side_owners(p_partner, s.side) o
  where s.partner_id = p_partner and s.deleted_at is null and partner.sees_side(p_person, p_partner, s.side)
  order by s.side limit 1
$$;

-- partner.partner_get as P3-8b-2 wrote it, naming only the owner of a side the reader sees.
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
    'owner_id', partner.owner_seen_by(p.id, me),
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

-- partner.hover as P3-8b-1 wrote it, naming only the owner of a side the reader sees.
create or replace function partner.hover(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if not exists (select 1 from partner.partner p where p.id = p_id and p.deleted_at is null) then
    return null;
  end if;
  perform partner.require_level(p_id, null, 'view');
  return (select pg_catalog.jsonb_build_object(
      'id', p.id, 'number', p.number, 'trade_name_en', p.trade_name_en, 'trade_name_ar', p.trade_name_ar,
      'logo_file_id', p.logo_file_id, 'key_partner', p.key_partner,
      'owner_id', partner.owner_seen_by(p.id, me),
      'sides', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                  'side', s.side, 'type', t.key, 'status', partner.status_of(p.id, s.side)) order by s.side)
                from partner.partner_side s join partner.side_type t on t.id = s.type_id
                where s.partner_id = p.id and s.deleted_at is null and partner.side_on(p.id, s.side)
                  and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb))
    from partner.partner p where p.id = p_id);
end
$$;

-- ================================================================ agreements are restricted (D10)
-- An IBAN letter or an agreement is restricted, whatever the upload asked and whichever door linked it: by its kind
-- (agreement) or by the purpose it is attached for.
create function core.file_restricted_kind() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from core.file_kind k where k.id = new.kind_id and k.key = 'agreement') then
    new.sensitivity := 'restricted';
  end if;
  return new;
end
$$;
create trigger restricted_kind before insert or update of kind_id, sensitivity on core.file
  for each row execute function core.file_restricted_kind();

create function core.file_link_restricted() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.purpose in ('agreement', 'iban_letter') then
    update core.file set sensitivity = 'restricted' where id = new.file_id and sensitivity <> 'restricted';
  end if;
  return new;
end
$$;
create trigger restricted_purpose after insert on core.file_link
  for each row execute function core.file_link_restricted();

-- ================================================================ a removed mention is kept (V401)
alter table core.mention add column deleted_at timestamptz;
alter table core.mention add column deleted_by uuid references core.person (id);
alter table core.mention add column delete_reason text;
create index mention_deleted_by on core.mention (deleted_by);

-- core.mentions_add as P3-8b-2 wrote it: a person mentioned again after being taken off is told again.
create or replace function core.mentions_add(p_note uuid, p_people uuid[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n core.note;
  who uuid;
  k int := 0;
begin
  select * into n from core.note where id = p_note;
  foreach who in array coalesce(p_people, '{}') loop
    if exists (select 1 from core.mention m where m.note_id = p_note and m.person_id = who and m.deleted_at is null) then
      continue;
    end if;
    if not exists (select 1 from core.person p where p.id = who and p.kind = 'staff' and p.active and p.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = who::text;
    end if;
    if not authz.can_see_as(who, n.entity_table, n.entity_id) then
      raise exception using errcode = 'P0001', message = 'note.mention_cannot_see', detail = who::text;
    end if;
    insert into core.mention (note_id, person_id) values (p_note, who)
    on conflict (note_id, person_id) do update set deleted_at = null, deleted_by = null, delete_reason = null;
    perform notify.push(who, 'mentioned', n.entity_table, n.entity_id, 'notify.mentioned',
                        pg_catalog.jsonb_build_object('note_id', p_note, 'kind', n.kind));
    k := k + 1;
  end loop;
  return k;
end
$$;

-- core.note_edit as P3-8b-2 wrote it: a mention taken off is marked removed, never deleted.
create or replace function core.note_edit(p_id uuid, p_values jsonb, p_version int, p_mentions uuid[] default null)
  returns jsonb
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
    update core.mention set deleted_at = core.clock(), deleted_by = me, delete_reason = 'note.edited'
    where note_id = p_id and deleted_at is null and not (person_id = any (p_mentions));
    perform core.mentions_add(p_id, p_mentions);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from core.note x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- core.notes as P3-8b-2 wrote it: a note's live mentions only.
create or replace function core.notes(p_entity text, p_id uuid, p_kinds text[] default null, p_limit int default 50,
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
                            from core.mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb))
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

revoke all on function partner.owner_seen_by(uuid, uuid), core.file_restricted_kind(), core.file_link_restricted()
  from public;
