-- FIX-34 Bell (F238/F237, D36(c)): one read, one count. The badge came from api.notifications_unread (an
-- uncapped count) and the panel/tab counts from the 100-row api.notifications list, read in two concurrent calls —
-- so above 100 rows they could never agree, and a notification landing between the two reads made them disagree
-- below 100 too. notify.list now returns the rows AND the counts from the same base set in the same statement:
--   { rows, unread, unread_mentions, unread_assigned }
-- The counts are over the full set (no limit); the rows are the newest N as before. The frontend derives the badge,
-- the All count and the tab counts from this one response and no longer calls notifications_unread. The per-tab
-- counts follow the panel's own tab rule (mentions = mentioned or note_mention; assigned = assigned or
-- helper_added), and they respect p_tab/p_before like the rows (minus the limit), so the counts are what the list
-- would count uncapped. The row shape, order and tab filters are unchanged (this is the 20261014231000 version,
-- with the record's name and the changed fields — not the 20260929040000 original). No signature change, so the
-- grants and the generated types are untouched. Forward-only (V103): nothing already on v2/main is edited here.
-- Regression tests: NTF-02 (updated to the new shape) and NTF-09 (the counts).

-- notify.list as 20261014231000 wrote it, plus the counts.
create or replace function notify.list(p_tab text default 'all', p_before timestamptz default null, p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_tab not in ('all', 'mentions', 'assigned') then
    raise exception using errcode = 'P0001', message = 'notify.unknown_tab', detail = p_tab;
  end if;
  return (
    with base as (
      select n.*, coalesce(e.key, n.entity_table) as entity,
             coalesce(pr.display_name_en, a.nickname_en, a.full_name_en) as actor_name_en,
             coalesce(pr.display_name_ar, a.nickname_ar, a.full_name_ar) as actor_name_ar
      from notify.notification n
      left join core.entity e on e.table_name = n.entity_table
      left join core.person a on a.id = n.actor_id
      left join core.person_profile pr on pr.person_id = n.actor_id
      where n.person_id = me
        and (n.snoozed_until is null or n.snoozed_until <= core.clock())
        and (p_before is null or n.created_at < p_before)
        and (p_tab = 'all' or (p_tab = 'mentions' and n.kind = 'mentioned')
             or (p_tab = 'assigned' and n.kind in ('assigned', 'helper_added')))
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(
                 jsonb_build_object(
                   'id', x.id, 'kind', x.kind, 'entity', x.entity, 'entity_id', x.entity_id,
                   'request_id', x.request_id, 'actor_id', x.actor_id, 'actor_name_en', x.actor_name_en,
                   'actor_name_ar', x.actor_name_ar, 'label_key', x.label_key, 'label_args', x.label_args,
                   'created_at', x.created_at, 'read_at', x.read_at,
                   -- what the request changed on the record (field names only), for "<who> changed <what> on
                   -- <record>"; like the name below, only for a reader who may see the record now
                   'fields', notify.changed_fields(x.kind, x.request_id, x.entity_table, x.entity_id, me))
                   -- the record by name, for a reader who may see it (Builder B's request, 13 Oct)
                   || notify.entity_title(x.entity_table, x.entity_id, me)
                 order by x.created_at desc, x.id)
               from (select * from base order by created_at desc, id
                     limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb),
      'unread', (select count(*)::int from base where read_at is null),
      'unread_mentions', (select count(*)::int from base where read_at is null
                          and kind in ('mentioned', 'note_mention')),
      'unread_assigned', (select count(*)::int from base where read_at is null
                          and kind in ('assigned', 'helper_added'))
    )
  );
end
$$;
