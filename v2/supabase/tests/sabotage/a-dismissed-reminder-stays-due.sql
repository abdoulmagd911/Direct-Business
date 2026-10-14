-- Sabotage: a-dismissed-reminder-stays-due
-- Breaks: sql:REM-01
-- Expect: a snoozed alert is not due
-- An alert already dismissed or put away by Later still counts as due, so the reminder keeps alerting (V632 Stage 2).
create or replace function core.reminders_due() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return pg_catalog.jsonb_build_object(
    'due', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', r.id, 'note_id', r.note_id, 'text', r.text, 'remind_at', r.remind_at, 'notification_id', n.id)
               order by r.remind_at, r.id)
      from core.reminder r
      -- its alert still open: not dismissed, not snoozed past now (an earlier alert put away by Later never counts)
      join lateral (select x.id from notify.notification x
                    where x.person_id = me and x.entity_table = 'core.reminder' and x.entity_id = r.id
                      and (x.snoozed_until is null or x.snoozed_until <= core.clock())
                    order by x.created_at desc, x.id limit 1) n on true
      where r.person_id = me and r.deleted_at is null and r.sent_at is not null), '[]'::jsonb),
    'next_at', (select pg_catalog.min(r.remind_at) from core.reminder r
                where r.person_id = me and r.deleted_at is null and r.sent_at is null));
end
$$;
