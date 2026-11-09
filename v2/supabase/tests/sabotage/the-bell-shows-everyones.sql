-- Sabotage: the-bell-shows-everyones
-- Breaks: sql:NTF-02
-- Expect: another person's notifications are never in my bell
-- The bell forgets whose notifications it reads: everyone's show in everyone's bell.
-- Updated for Landing 1 (FIX-34): notify.list now returns the object
-- { rows, unread, unread_mentions, unread_assigned } (migration 20261109000001).
-- This sabotage returns that same shape, but with no person filter — everyone's
-- notifications (and counts) show in everyone's bell.
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
      where true
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
                   'fields', notify.changed_fields(x.kind, x.request_id, x.entity_table, x.entity_id, me))
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
