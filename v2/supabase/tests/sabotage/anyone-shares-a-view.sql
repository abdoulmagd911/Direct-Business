-- Sabotage: anyone-shares-a-view
-- Breaks: sql:VIEW-01
-- Expect: sharing a view needs Full on the page
-- Anyone who can open a page shares views with everyone on it.
create or replace function core.view_save(p_id uuid, p_page text, p_name text, p_query jsonb, p_shared boolean default false,
                               p_sort int default 0, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require(p_page, 'view');
  v core.saved_view;
  req uuid;
begin
  if p_id is not null then
    select * into v from core.saved_view where id = p_id and deleted_at is null;
    if v.id is null or v.page_key <> p_page then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if v.owner_id <> me then
      raise exception using errcode = '42501', message = 'view.not_yours';
    end if;
  end if;
  if p_id is null then
    req := audit.begin('ui', 'view.saved', pg_catalog.jsonb_build_object('page', p_page, 'name', p_name), null);
    insert into core.saved_view (page_key, owner_id, name, query, shared, sort)
    values (p_page, me, pg_catalog.btrim(p_name), coalesce(p_query, '{}'), coalesce(p_shared, false),
            coalesce(p_sort, 0))
    returning * into v;
  else
    perform core.check_version('core.saved_view', p_id, p_version,
      array_remove(array[
        case when v.name is distinct from pg_catalog.btrim(p_name) then 'name' end,
        case when v.query is distinct from coalesce(p_query, '{}') then 'query' end,
        case when v.shared is distinct from coalesce(p_shared, false) then 'shared' end,
        case when v.sort is distinct from coalesce(p_sort, 0) then 'sort' end], null));
    req := audit.begin('ui', 'view.saved', pg_catalog.jsonb_build_object('page', p_page, 'name', p_name), null);
    update core.saved_view set name = pg_catalog.btrim(p_name), query = coalesce(p_query, '{}'),
                               shared = coalesce(p_shared, false), sort = coalesce(p_sort, 0)
    where id = p_id returning * into v;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', v.id, 'version', v.version, 'request_id', req);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'view.name_taken', detail = pg_catalog.btrim(p_name);
end
$$;
