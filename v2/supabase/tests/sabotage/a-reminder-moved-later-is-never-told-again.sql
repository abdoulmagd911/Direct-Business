-- Sabotage: a-reminder-moved-later-is-never-told-again
-- Breaks: sql:REM-01
-- Expect: and the next one falls at 11:00
-- Later moves a reminder but leaves it marked sent, so it never alerts at its new time (V632 Stage 2).
create or replace function core.reminder_move(p_id uuid, p_at timestamptz) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r core.reminder;
  req uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into r from core.reminder x where x.id = p_id and x.person_id = me and x.deleted_at is null for update;
  if r.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_at is null then
    raise exception using errcode = 'P0001', message = 'reminder.time_required';
  end if;
  if p_at <= core.clock() then
    raise exception using errcode = 'P0001', message = 'reminder.time_passed';
  end if;
  req := audit.begin('ui', 'reminder.moved', pg_catalog.jsonb_build_object('from', r.remind_at, 'to', p_at));
  update core.reminder set remind_at = p_at where id = r.id;
  update notify.notification set read_at = core.clock()
  where person_id = me and entity_table = 'core.reminder' and entity_id = r.id and read_at is null;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', r.id, 'remind_at', p_at, 'request_id', req);
end
$$;
