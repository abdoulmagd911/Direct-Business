-- Sabotage: the-bell-shows-everyones
-- Breaks: sql:NTF-02
-- Expect: another person's notifications are never in my bell
-- The bell forgets whose notifications it reads: everyone's show in everyone's bell.
create or replace function notify.list(p_tab text default 'all', p_before timestamptz default null, p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_tab not in ('all', 'mentions', 'assigned') then
    raise exception using errcode = 'P0001', message = 'notify.unknown_tab', detail = p_tab;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', x.id, 'kind', x.kind, 'entity', x.entity, 'entity_id', x.entity_id, 'request_id', x.request_id,
             'actor_id', x.actor_id, 'actor_name_en', x.actor_name_en, 'actor_name_ar', x.actor_name_ar,
             'label_key', x.label_key, 'label_args', x.label_args, 'created_at', x.created_at, 'read_at', x.read_at)
             order by x.created_at desc, x.id)
    from (
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
      order by n.created_at desc, n.id
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) x), '[]'::jsonb);
end
$$;
