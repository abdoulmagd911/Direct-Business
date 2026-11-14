-- The bell, the 13 Nov sweep (G-shared). Forward-only (V103): both functions are redefined from their latest version.
--
-- (1) The Mentions tab never listed a note mention its own badge counted. notify.list (20261109000001) counted
--     unread mentions as kind in ('mentioned', 'note_mention') — the panel's tab rule, as its header says — but its
--     rows for p_tab = 'mentions' kept kind = 'mentioned' only: someone mentioned in a note saw "Mentions 1" and an
--     empty Mentions tab. The rows now follow the same rule as the count. Nothing else changes (row shape, order,
--     counts, the other tabs).
--
-- (2) A broken alert stopped without a word. notify.generate_alerts (20261014150000) runs each notify.alert_*()
--     on its own, so one that fails does not stop the others — but the failure was only a WARNING in the server's
--     log, and the job still "succeeded": an alert could stop for good and nobody would know. The failure is now also
--     written where an admin sees it: one job line in the whole change log (/activity), "An alert could not run",
--     naming the alert and the error — once per alert per Riyadh day, however often the job runs. The other alerts
--     still run and their notifications are kept.
-- No signature changes, so the grants and the generated types are untouched.

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
        -- the Mentions tab lists what its count counts: a mention on a record and a mention in a note
        and (p_tab = 'all' or (p_tab = 'mentions' and n.kind in ('mentioned', 'note_mention'))
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

create or replace function notify.generate_alerts() returns int
language plpgsql security definer set search_path = '' as $$
declare
  f record;
  k int;
  n int := 0;
  day date := core.riyadh_today();
  why text;
begin
  for f in
    select p.proname
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'notify' and p.proname like 'alert\_%' and p.proretset
      and p.prorettype = 'notify.alert'::regtype and p.pronargs = 0
    order by p.proname
  loop
    begin
      execute pg_catalog.format(
        'insert into notify.notification (person_id, kind, entity_table, entity_id, label_key, label_args, alert_key,'
        || ' alert_day) select a.person_id, %L, a.entity_table, a.entity_id, a.label_key, a.label_args, a.alert_key, $1'
        || ' from notify.%I() a where a.alert_key is not null and notify.may_notify(a.person_id, %L)'
        || ' and (a.entity_table is null or authz.can_see_as(a.person_id, a.entity_table, a.entity_id))'
        || ' on conflict do nothing',
        f.proname, f.proname, f.proname) using day;
      get diagnostics k = row_count;
      n := n + k;
    exception when others then
      why := pg_catalog.left(sqlerrm, 300);
      raise warning 'notify.generate_alerts: % failed: %', f.proname, why;
      -- said where an admin sees it, once a day per alert: a job line in the whole change log
      if not exists (select 1 from audit.request r
                     where r.label_key = 'alert.failed' and r.happened_on = day
                       and r.label_args ->> 'alert' = f.proname::text) then
        perform audit.begin('job', 'alert.failed',
                            pg_catalog.jsonb_build_object('alert', f.proname::text, 'error', why));
        perform audit.end();
      end if;
    end;
  end loop;
  return n;
end
$$;
