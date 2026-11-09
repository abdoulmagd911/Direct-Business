-- FIX-03 (F137): Watch is disabled for the read-only role. A Viewer could follow a supplier record and be told of
-- its changes; the plan's R11 cell gives the Viewer no Watch. notify.follow_set now refuses to START a follow for a
-- Viewer (42501 follow.not_allowed); stopping a follow stays allowed, and following() is unchanged. The button is
-- disabled in the client (FollowButton), so the refusal is a backstop, never the first thing a Viewer meets.
-- Base: notify.follow_set as 20261007084000 wrote it (following a record yourself keeps the follow — a hand-over
-- follow becomes your own, until_on cleared), plus the Viewer refusal. The first draft copied the older
-- 20260929040000 body with "on conflict do nothing" and lost that keep; HAND-01 caught it.
-- Forward-only (V103).
-- Regression test: NTF-03 (supabase/tests/notify/) — extended with a Viewer leg.
create or replace function notify.follow_set(p_entity text, p_id uuid, p_on boolean) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity := core.can_see_record(p_entity, p_id);
begin
  if p_on and exists (select 1 from core.person p join core.role r on r.id = p.role_id
                      where p.id = me and r.key = 'viewer') then
    raise exception using errcode = '42501', message = 'follow.not_allowed';
  end if;
  if p_on then
    insert into notify.follow (person_id, entity_table, entity_id) values (me, e.table_name, p_id)
    on conflict (person_id, entity_table, entity_id) do update set until_on = null;
  else
    delete from notify.follow where person_id = me and entity_table = e.table_name and entity_id = p_id;
  end if;
  return p_on;
end
$$;
