-- Landing 3 (FIX-37 F008, D35): a question's author is told when it is answered. There was no
-- question-answered kind, so the fix is bigger than a trigger: the kind joins the notification kinds
-- (the check constraint below, and the registry sync that follows from the module registry), and
-- work.comment_answer pushes it to the question's author on answer — never the answerer (comment_add
-- refuses asking oneself), never on past work (the comment_add rule). The stuck-count half of F008
-- (F237/F238) gates on FIX-34 and is Landing 5, not here. Forward-only (V103).
alter table notify.notification drop constraint notification_kind_check;
alter table notify.notification add constraint notification_kind_check check (kind in (
  'assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change', 'decision_needed', 'report_issued',
  'report_for_review', 'appraisal_step', 'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
  'alert_invoice_unpaid', 'alert_kpi_checkin', 'escalated', 'alert_quiet_client', 'alert_project_no_update',
  'alert_activity_stale', 'alert_file_review', 'reminder', 'note_mention', 'alert_contact_reconfirm',
  'alert_due_tomorrow', 'task_commented', 'commented', 'asked', 'question_answered', 'escalation_acknowledged', 'alert_weekly_unlogged'));

-- Answer a question: copied from 20261107130000 exactly, plus the push to the question's author.
create or replace function work.comment_answer(p_id uuid, p_answer text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c core.comment;
  b text := pg_catalog.btrim(coalesce(p_answer, ''));
  req uuid;
  e core.entity;
  is_past boolean := false;
  t work.task;
begin
  select * into c from core.comment where id = p_id and deleted_at is null;
  if me is null or c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  e := work.comment_record(
    (select k.key from core.entity k where k.table_name = c.entity_table and k.active), c.entity_id);
  if c.asked_to is null or not c.question_open then
    raise exception using errcode = 'P0001', message = 'comment.not_open';
  end if;
  if c.asked_to <> me then
    raise exception using errcode = '42501', message = 'comment.not_asked';
  end if;
  if b = '' then
    raise exception using errcode = 'P0001', message = 'comment.body_required';
  end if;
  if pg_catalog.length(b) > 4000 then
    raise exception using errcode = 'P0001', message = 'comment.too_long';
  end if;
  if c.entity_table = 'work.task' then
    select * into t from work.task where id = c.entity_id;
    is_past := work.task_is_past(t);
  end if;
  req := audit.begin('ui', 'comment.answered', pg_catalog.jsonb_build_object('entity', e.key));
  perform audit.write_fields('core.comment', p_id,
    pg_catalog.jsonb_build_object('answer', b, 'answered_at', core.clock(), 'answered_by', me,
                                 'question_open', false));
  -- F008: the person who asked is told the question was answered; a comment on past work tells nobody.
  if not is_past then
    perform notify.push_assigned(c.created_by, 'question_answered', c.entity_table, c.entity_id,
      pg_catalog.jsonb_build_object('record', work.comment_record_label(c.entity_table, c.entity_id),
                                   'preview', pg_catalog.left(b, 120)));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;
