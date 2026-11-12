-- Landing 15 (F-B5-12, D-5 RULED: delete allowed) — a plan target can be removed. No Delete control existed:
-- target rows could only be zeroed, never removed, so the stranded test target (Count 0) sat on the screen.
-- Deleting a target orphans nothing (D-5 code proof): perf.achievement has NO reference to perf.target —
-- achievements link to category_id + plan/month, and "Achieved is READ, never stored" (20261109000040) — so the
-- target's expected count goes with it and the achievements already logged stay exactly as they are.
-- The shape is finance.code_use_remove's: the same door as target_save (settings.performance, full — admins),
-- a required reason, a soft delete (deleted_at/deleted_by/delete_reason, version moved on by the audit stamp),
-- one audit row ('target.removed') and one Undo. Forward-only (V103). No money touched; no ticket-system change.
create function perf.target_delete(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  why text := core.access_reason(p_reason);
  t perf.target;
  req uuid;
begin
  select * into t from perf.target x where x.id = p_id and x.deleted_at is null for update;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'target.removed',
                     pg_catalog.jsonb_build_object('category',
                       (select c.code from perf.achievement_category c where c.id = t.category_id),
                       'month', t.month), why);
  update perf.target x set deleted_at = now(), deleted_by = me, delete_reason = why, version = version + 1
  where x.id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', t.version + 1, 'request_id', req);
end
$$;

-- The Data API's door to the delete (V124: security-invoker wrapper over the definer function).
create function api.target_delete(p_id uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.target_delete(p_id, p_reason) $$;
grant execute on function perf.target_delete(uuid, text) to authenticated;
grant execute on function api.target_delete(uuid, text) to authenticated;
