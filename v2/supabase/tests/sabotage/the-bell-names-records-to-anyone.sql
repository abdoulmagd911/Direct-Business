-- Sabotage: the-bell-names-records-to-anyone
-- Breaks: sql:NTF-04
-- Expect: so their bell gives no name for it
-- The bell names a notification's record to a reader who may not see it, so a task's title reaches them (QA-553's
-- rule, on the bell).
create or replace function notify.entity_title(p_table text, p_id uuid, p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  en text;
  ar text;
begin
  if p_table is null or p_id is null then
    return pg_catalog.jsonb_build_object('title', null, 'title_ar', null);
  end if;
  case p_table
    when 'work.task' then
      select t.number || ' · ' || t.title into en from work.task t where t.id = p_id and t.deleted_at is null;
    when 'work.project' then
      select p.number || ' · ' || p.name into en from work.project p where p.id = p_id and p.deleted_at is null;
    when 'pipeline.opportunity' then
      select o.number || ' · ' || o.title into en from pipeline.opportunity o where o.id = p_id and o.deleted_at is null;
    when 'pipeline.tender' then
      select t.number || ' · ' || t.title into en from pipeline.tender t where t.id = p_id and t.deleted_at is null;
    when 'partner.partner' then
      select p.trade_name_en, coalesce(p.trade_name_ar, p.trade_name_en) into en, ar
      from partner.partner p where p.id = p_id and p.deleted_at is null;
    else
      null;
  end case;
  return pg_catalog.jsonb_build_object('title', en, 'title_ar', coalesce(ar, en));
end
$$;
