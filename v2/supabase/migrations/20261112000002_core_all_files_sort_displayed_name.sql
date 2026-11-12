-- Landing 15, Group B — two file-listing changes in the one migration assigned to the group
-- (20261112000002; the group was assigned a single number).
--
-- (1) F-B3-02 — Sort = Name sorts by the name the person actually sees. FIX-08 (20261109000005) sorted Name
-- by lower(core.file_display_name(...)) — the GENERATED display name ("Agreement · …", "Invoice · …"),
-- which groups by kind-pattern — while the rows show the stored original_name (FIX-38). Sort key and shown
-- name were different strings by design, so Name was not A–Z by the displayed file name. The two name-sort
-- keys now order by lower(original_name); the tie-break (added_at desc, seq desc) and the other sorts are
-- untouched. The signature is unchanged (p_locale stays: callers pass it, and the search and the display-name
-- outputs still read both locales), so CREATE OR REPLACE is enough — no drop, no new overload, grants kept.
-- Forward-only (V103): the 20261109000005 definition is not edited; this file replaces it whole.
--
-- (2) F-B6-02 message leg — the partner card now also carries the count of the partner's files the reader
-- cannot see, so the Files section can tell "no files" from "files exist but hidden from you". The count
-- mirrors the 'files' count's predicate exactly, with the visibility negated (same purpose filter, same
-- deleted_at guards) — so files + files_hidden is the partner's whole non-logo file count. The visibility
-- rule itself is untouched (D-3 stays open); only the count is newly visible. partner.partner_get is copied
-- from 20261012092000, that one counts key added, each exactly otherwise. Forward-only (V103).

-- (1) core.all_files: Name sorts by the stored name the row shows.
create or replace function core.all_files(
  p_entity text default null, p_record uuid default null, p_kind text default null,
  p_uploader uuid default null, p_from date default null, p_to date default null,
  p_purpose text default null, p_side text default null, p_status text default null,
  p_search text default null, p_sort text default 'added',
  p_limit int default 25, p_offset int default 0, p_locale text default 'en') returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v_entity text := case p_entity
    when 'my_note' then 'my.note'
    when 'campaign_code' then 'partner.campaign_code'
    when 'finance.import_batch' then 'work.import_batch'
    else p_entity end;
  v_search text := nullif(pg_catalog.btrim(coalesce(p_search, '')), ''::text);
  v_limit int := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if v_entity is not null and v_entity not in ('work.task', 'perf.achievement', 'my.note', 'partner.partner',
                                               'work.import_batch', 'partner.campaign_code') then
    raise exception using errcode = 'P0001', message = 'file.unknown_entity', detail = p_entity;
  end if;
  if p_kind is not null and not exists (select 1 from core.file_kind k
                                        where k.key = p_kind and k.active and k.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'file.unknown_kind', detail = p_kind;
  end if;
  if p_purpose is not null and p_purpose not in ('evidence', 'contract', 'agreement', 'attachment', 'iban_letter',
                                                 'render', 'logo', 'avatar', 'travel_policy', 'tender') then
    raise exception using errcode = 'P0001', message = 'file.unknown_purpose', detail = p_purpose;
  end if;
  if p_side is not null and p_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'file.unknown_side', detail = p_side;
  end if;
  if p_status is not null and p_status not in ('pending', 'stored') then
    raise exception using errcode = 'P0001', message = 'file.unknown_status', detail = p_status;
  end if;
  if p_sort not in ('added', 'name', 'size') then
    raise exception using errcode = 'P0001', message = 'file.unknown_sort', detail = p_sort;
  end if;
  if p_locale not in ('en', 'ar') then
    raise exception using errcode = 'P0001', message = 'file.unknown_locale', detail = p_locale;
  end if;
  return (
    with base as (
      select l.id as link_id, l.entity_table, l.entity_id, l.purpose, l.side,
             l.record_label, l.record_link, l.added_by_name,
             f.id, f.seq, f.original_name, f.mime, f.size_bytes, f.sensitivity, f.status, f.review_on,
             f.created_by as added_by, f.created_at as added_at,
             k.key as kind, k.name_en as kind_en, k.name_ar as kind_ar
      from core.file_link l
      join core.file f on f.id = l.file_id
      join core.file_kind k on k.id = f.kind_id
      where l.deleted_at is null and f.deleted_at is null
        and authz.file_visible(f.id)
        and (v_entity is null or l.entity_table = v_entity)
        and (p_record is null or l.entity_id = p_record)
        and (p_kind is null or k.key = p_kind)
        and (p_uploader is null or f.created_by = p_uploader)
        and (p_from is null or core.riyadh_day(f.created_at) >= p_from)
        and (p_to is null or core.riyadh_day(f.created_at) <= p_to)
        and (p_purpose is null or l.purpose = p_purpose)
        and (p_side is null or l.side = p_side)
        and (p_status is null or f.status = p_status)
        and (v_search is null
             or pg_catalog.strpos(pg_catalog.lower(f.original_name), pg_catalog.lower(v_search)) > 0
             or pg_catalog.strpos(pg_catalog.lower(coalesce(l.record_label, '')),
                                  pg_catalog.lower(v_search)) > 0
             or pg_catalog.strpos(pg_catalog.lower(core.file_display_name(f.id, 'en')),
                                  pg_catalog.lower(v_search)) > 0
             or pg_catalog.strpos(pg_catalog.lower(coalesce(core.file_display_name(f.id, 'ar'), '')),
                                  pg_catalog.lower(v_search)) > 0)
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*)::int from base),
      'rows', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'id', b.id, 'link_id', b.link_id,
                 'display_name', core.file_display_name(b.id, 'en'),
                 'display_name_ar', core.file_display_name(b.id, 'ar'),
                 'original_name', b.original_name,
                 'kind', b.kind, 'kind_en', b.kind_en, 'kind_ar', b.kind_ar,
                 'purpose', b.purpose, 'side', b.side,
                 'size', b.size_bytes, 'sensitivity', b.sensitivity, 'status', b.status,
                 'review_on', b.review_on,
                 'added_by', b.added_by,
                 'added_by_name', coalesce(b.added_by_name, core.file_person_name(b.added_by)),
                 'added_at', b.added_at,
                 'record_label', coalesce(b.record_label,
                   (core.file_record_label(b.entity_table, b.entity_id) ->> 'label')),
                 'record_link', coalesce(b.record_link,
                   (core.file_record_label(b.entity_table, b.entity_id) ->> 'link')),
                 'entity_table', b.entity_table, 'entity_id', b.entity_id)
                 order by case when p_sort = 'name' then pg_catalog.lower(b.original_name) end asc,
                          case when p_sort = 'size' then b.size_bytes end desc,
                          case when p_sort = 'added' then b.added_at end desc,
                          b.added_at desc, b.seq desc)
        from (select * from base
              order by case when p_sort = 'name' then pg_catalog.lower(original_name) end asc,
                       case when p_sort = 'size' then size_bytes end desc,
                       case when p_sort = 'added' then added_at end desc,
                       added_at desc, seq desc
              limit v_limit offset v_offset) b), '[]'::jsonb),
      'facets', pg_catalog.jsonb_build_object(
        'sides', coalesce((select pg_catalog.jsonb_agg(s.side order by s.side)
                                      from (select distinct side from base where side is not null) s), '[]'::jsonb),
        'purposes', coalesce((select pg_catalog.jsonb_agg(s.purpose order by s.purpose)
                                         from (select distinct purpose from base) s), '[]'::jsonb),
        'statuses', coalesce((select pg_catalog.jsonb_agg(s.status order by s.status)
                                         from (select distinct status from base) s), '[]'::jsonb)),
      'uploaders', coalesce((select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('id', u.added_by, 'name',
            coalesce(u.added_by_name, core.file_person_name(u.added_by)))
          order by coalesce(u.added_by_name, core.file_person_name(u.added_by)))
        from (select distinct added_by, added_by_name from base) u), '[]'::jsonb))
  );
end
$$;

-- (2) partner.partner_get: the card's counts gain files_hidden (F-B6-02).
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
        'valid_to', i.valid_to, 'closed_on', i.closed_on,
        'open', i.kind <> 'payments_client_id' or i.closed_on is null or i.closed_on >= core.riyadh_today(),
        'money', case when i.kind = 'name' and i.subkind is distinct from 'alias' then 'suggest' else 'match' end,
        'source', i.source, 'reason', i.reason, 'added_by', i.created_by, 'added_at', i.created_at)
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
    -- the nearest next step: an activity's, or the due day of the nearest open task on it (D5)
    'next_step', (select pg_catalog.jsonb_build_object('note_id', s.note_id, 'task_id', s.task_id, 'text', s.text, 'on', s.on_day)
                  from (select n.id as note_id, null::uuid as task_id, n.next_step as text, n.next_step_on as on_day,
                               n.logged_at as at
                        from core.note n
                        where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity'
                          and n.deleted_at is null and n.next_step_on >= core.riyadh_today()
                        union all
                        select null, t.id, t.title, t.due_on, t.created_at
                        from work.task t
                        where t.partner_id = p.id and t.deleted_at is null and t.closed_at is null and t.due_on is not null
                          and not work.task_is_past(t)
                          -- a task's title reaches only those who may see the task (QA-553)
                          and work.row_level('work.task', t.id, me) >= 'view') s
                  order by s.on_day, s.at limit 1),
    -- D5: the tasks on it the reader may see, open first, for the Related list
    'tasks', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', t.id, 'number', t.number,
                         'title', t.title, 'due_on', t.due_on, 'owner_id', t.owner_id, 'closed_at', t.closed_at)
                         order by t.closed_at is not null, t.due_on nulls last, t.number)
                       from (select * from work.task t0
                             where t0.partner_id = p.id and t0.deleted_at is null
                               and work.row_level('work.task', t0.id, me) >= 'view'
                             order by t0.closed_at is not null, t0.due_on nulls last, t0.number limit 20) t), '[]'::jsonb),
    'flags', partner.flags(p.id, me),
    'counts', pg_catalog.jsonb_build_object(
      'contracts', (select pg_catalog.count(*) from partner.contract c where c.partner_id = p.id and c.deleted_at is null
                      and partner.sees_side(me, p.id, c.side)),
      'files', (select pg_catalog.count(*) from core.file_link l join core.file f on f.id = l.file_id
                where l.entity_table = 'partner.partner' and l.entity_id = p.id and l.deleted_at is null
                  and f.deleted_at is null and l.purpose <> 'logo' and authz.file_visible(f.id)),
      'files_hidden', (select pg_catalog.count(*) from core.file_link l join core.file f on f.id = l.file_id
                where l.entity_table = 'partner.partner' and l.entity_id = p.id and l.deleted_at is null
                  and f.deleted_at is null and l.purpose <> 'logo' and not authz.file_visible(f.id)),
      'notes', (select pg_catalog.count(*) from core.note n
                where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.deleted_at is null
                  and (n.event_type is null
                       or work.row_level('work.task', n.event_task_id, me) >= 'view'))));
end
$$;
