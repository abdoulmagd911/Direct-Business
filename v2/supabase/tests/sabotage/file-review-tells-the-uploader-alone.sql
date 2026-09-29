-- Sabotage: file-review-tells-the-uploader-alone
-- Breaks: sql:FILE-05
-- Expect: its uploader and the Client side
-- A travel policy's review day tells its uploader alone, not the Client side's owner.
create or replace function notify.alert_file_review() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  with f as (
    select x.id, x.created_by, x.review_on from core.file x
    where x.deleted_at is null and x.status = 'stored' and x.review_on = core.riyadh_today()
  ), who as (
    select f.id as file_id, f.created_by as person_id from f

  )
  select w.person_id, 'file_review:' || f.id || ':' || f.review_on, 'core.file', f.id, 'alert.file_review',
         pg_catalog.jsonb_build_object('file_id', f.id, 'review_on', f.review_on)
  from who w join f on f.id = w.file_id
  where w.person_id is not null
$$;
