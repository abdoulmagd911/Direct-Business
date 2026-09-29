-- Sabotage: the-last-visit-is-always-now
-- Breaks: sql:SEEN-01
-- Expect: the first visit has no last visit
-- Opening a page answers the time of this visit, so "since your last visit" is always empty.
create or replace function core.page_seen(p_page text) returns timestamptz
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  before timestamptz;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if authz.level_of(me, p_page) = 'none' then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', p_page, 'level', 'view')::text;
  end if;
  select s.seen_at into before from core.person_last_seen s where s.person_id = me and s.page_key = p_page;
  insert into core.person_last_seen (person_id, page_key, seen_at) values (me, p_page, core.clock())
  on conflict (person_id, page_key) do update set seen_at = excluded.seen_at;
  return core.clock();
end
$$;
