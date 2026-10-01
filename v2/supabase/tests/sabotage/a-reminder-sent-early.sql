-- Sabotage: a-reminder-sent-early
-- Breaks: sql:NOTE-06
-- Expect: the 10:00 run sends nothing
-- A run sends what falls due before the next one, so a 10:03 reminder goes at 10:00.
create or replace function notify.send_reminders() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r core.reminder;
  k int := 0;
begin
  if not exists (select 1 from core.reminder x
                 where x.remind_at <= core.clock() + interval '5 minutes' and x.sent_at is null and x.deleted_at is null) then
    return 0;
  end if;
  perform audit.begin('job', 'reminder.sent');
  for r in select * from core.reminder x
           where x.remind_at <= core.clock() + interval '5 minutes' and x.sent_at is null and x.deleted_at is null
           order by x.remind_at, x.id for update skip locked loop
    perform notify.push(r.person_id, 'reminder', 'core.reminder', r.id, 'notify.reminder',
                        pg_catalog.jsonb_build_object('reminder_id', r.id, 'note_id', r.note_id, 'text', r.text,
                                                      'remind_at', r.remind_at));
    update core.reminder set sent_at = core.clock() where id = r.id;
    k := k + 1;
  end loop;
  perform audit.end();
  return k;
end
$$;
