-- FIX-03 (F088): a Member may Move their own achievement. perf.achievement_move required row_level >= 'full'
-- on KPIs, so only a manager or head could move one — the record menu hid Move from a Member even on their own
-- achievement. perf.achievement_editable (called first) already enforces perf.can_edit: Full, or Own plus one of
-- the achievement's own people (owner, creator, participant). The extra Full-only check is dropped; the move
-- keeps its reason, earlier-only and version rules, and Give owner stays Full-only. Forward-only (V103).
-- Regression test: FIX03-01 (supabase/tests/fix03/).
create or replace function perf.achievement_move(p_id uuid, p_to date, p_reason text, p_version int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a perf.achievement := perf.achievement_editable(p_id);
  req uuid;
begin
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if a.happened_on is null or p_to is null or core.month_of(p_to) >= core.month_of(a.happened_on) then
    raise exception using errcode = 'P0001', message = 'achievement.move_earlier_only';
  end if;
  perform core.check_version('perf.achievement', p_id, p_version, array['happened_on']);
  req := audit.begin('ui', 'achievement.moved', null, pg_catalog.btrim(p_reason));
  perform perf.quiet_if_past(array[p_id]);
  begin
    update perf.achievement set happened_on = p_to,
      period_moved_from = coalesce(period_moved_from, a.happened_on), period_move_reason = pg_catalog.btrim(p_reason),
      period_moved_by = me
    where id = p_id;
  exception when check_violation then
    raise exception using errcode = 'P0001', message = 'achievement.before_2025';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from perf.achievement x where x.id = p_id),
                                       'request_id', req);
end
$$;
