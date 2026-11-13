-- Owner 13 Nov, Clients audit (B-partners) — two fixes to the organisation card, in partner.partner_get.
--
-- (1) A contact belongs to one or both sides (partner.contact.sides — V148, V401). The card listed every contact of
-- the organisation, so a reader who may see only the Supplier side was shown the Client side's contacts (and the
-- header's Contacts figure counted them). A contact now reaches the card when at least one of its sides is a side the
-- reader may see (the same level rule the card's own 'sides' use: the side's page at View or above).
--
-- (2) A side's custom fields (partner.side_field) reached the screen as bare keys: the record printed
-- "payment_terms" and a select's stored key, because the card carried the values (sides[].fields) but never the
-- definitions with their English and Arabic labels. The card now carries 'side_fields' — each live definition of a
-- side the reader may see, with its labels, type and options — so the screen words each field in the reader's
-- language and a select or a yes/no value by its meaning. Nothing is computed; a definition retired after a value was
-- stored simply is not listed (the screen then falls back to the key).
--
-- partner.partner_get is copied whole from 20261112000002 (the latest definition) with only these two changes. The
-- signature is unchanged, so CREATE OR REPLACE keeps the grants. Forward-only (V103).

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
    -- (2) the definitions of the custom fields of the sides the reader may see, with their two labels
    'side_fields', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'side', f.side, 'key', f.key, 'label_en', f.label_en, 'label_ar', f.label_ar, 'type', f.type,
        'options', f.options) order by f.side, f.sort, f.key)
      from partner.side_field f where f.deleted_at is null
        and authz.level_of(me, partner.side_page(f.side)) >= 'view'), '[]'::jsonb),
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
    -- (1) a contact reaches the card when one of its sides is a side the reader may see
    'contacts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) - array['deleted_at', 'deleted_by',
        'delete_reason', 'created_by', 'updated_by'] order by c.is_primary desc, c.name_en)
      from partner.contact c where c.partner_id = p.id and c.deleted_at is null
        and exists (select 1 from pg_catalog.unnest(c.sides) cs (side)
                    where authz.level_of(me, partner.side_page(cs.side)) >= 'view')), '[]'::jsonb),
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
