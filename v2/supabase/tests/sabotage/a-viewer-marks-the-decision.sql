-- Sabotage: a-viewer-marks-the-decision
-- Breaks: sql:CMT-03
-- Expect: a viewer marks no decision
-- Anyone who sees the record marks its decision.
create or replace function work.comment_decide(p_id uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  c core.comment;
  e core.entity;
  req uuid;
  on_ boolean := coalesce(p_on, true);
begin
  select * into c from core.comment where id = p_id and deleted_at is null;
  if me is null or c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  e := work.comment_record(
    (select k.key from core.entity k where k.table_name = c.entity_table and k.active), c.entity_id);
  if false then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  if c.is_decision = on_ then
    raise exception using errcode = 'P0001', message = 'comment.decision_unchanged';
  end if;
  req := audit.begin('ui', case when on_ then 'comment.decision_marked' else 'comment.decision_unmarked' end,
                     pg_catalog.jsonb_build_object('entity', e.key));
  if on_ then
    update core.comment set is_decision = false, decided_by = null, decided_at = null
    where entity_table = c.entity_table and entity_id = c.entity_id and is_decision and deleted_at is null;
    update core.comment set is_decision = true, decided_by = me, decided_at = core.clock() where id = p_id;
  else
    update core.comment set is_decision = false, decided_by = null, decided_at = null where id = p_id;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'is_decision', on_, 'request_id', req);
end
$$;
