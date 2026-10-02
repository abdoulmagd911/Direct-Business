-- Sabotage: an-achievement-removed-without-a-reason
-- Breaks: sql:ACH-03
-- Expect: no reason, no removal
-- Removing no longer asks why (the brief: remove with a reason).
create or replace function perf.achievements_remove(p_ids uuid[], p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  i uuid;
  req uuid;
  k int;
begin
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if false then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  foreach i in array p_ids loop
    perform perf.achievement_editable(i);
  end loop;
  req := audit.begin('ui', 'achievement.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     pg_catalog.btrim(p_reason));
  perform perf.quiet_if_past(p_ids);
  update perf.achievement set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = pg_catalog.btrim(p_reason)
  where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;
