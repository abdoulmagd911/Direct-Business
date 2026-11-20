-- Sabotage: anyone-reads-the-teams-streaks
-- Breaks: sql:STR-01
-- Expect: a person who manages nobody reads no team streaks
-- Every staff member is listed to every reader.
create or replace function work.team_streaks() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'person_id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
             'days', (x.s ->> 'days')::int, 'today_done', (x.s ->> 'today_done')::int)
             order by (x.s ->> 'days')::int desc, pg_catalog.lower(p.full_name_en), p.id)
    from core.person p cross join lateral (select work.streak_of(p.id) as s) x
    where p.kind = 'staff' and p.active and p.deleted_at is null), '[]'::jsonb);
end
$$;
