-- FIX-03 (F243/F245, P1a): Commercial — anyone with Own or more on the page — may comment on an achievement or a
-- task they can open. The task rule asked for edit rights or a helper slot, so a Member (Own on Tasks) who could open
-- a task but neither owned it nor helped on it read a read-only Discussion; the achievement rule asked for Full or
-- Own-plus-owner through core.may_write, so the same Member read a read-only Discussion there. Both rules are now
-- "can see the record AND level >= 'own' on its page" — a Viewer ('view') stays read-only, and edit/delete of a
-- comment stay the author's alone (can_edit/can_remove in work.comments and work.task_comments are untouched).
-- core.may_write itself is NOT widened: it still gates file and note writes on a record. Forward-only (V103).
-- Regression tests: CMT-02 (supabase/tests/ — comment tests) extended with the Member legs.
create or replace function work.can_comment(p_person uuid, t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$
  select authz.can_see_as(p_person, 'work.task', t.id)
         and authz.level_of(p_person, 'tasks') >= 'own'
$$;

create or replace function work.comment_may_write(p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task;
  n my.note;
begin
  if me is null then
    return false;
  end if;
  if p_table = 'my.note' then
    select * into n from my.note where id = p_id and deleted_at is null;
    if n.id is not null and n.visibility = 'private' then
      return n.person_id = me;
    end if;
  end if;
  if p_table = 'perf.achievement' then
    return authz.can_see_as(me, p_table, p_id) and authz.level_of(me, 'kpis') >= 'own';
  end if;
  if p_table = 'work.task' then
    select * into t from work.task where id = p_id and deleted_at is null;
    if t.id is null then
      return false;
    end if;
    return work.can_comment(me, t);
  end if;
  return authz.can_see_as(me, p_table, p_id);
end
$$;
