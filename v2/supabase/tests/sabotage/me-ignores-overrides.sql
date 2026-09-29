-- Sabotage: me-ignores-overrides
-- Breaks: sql:ME-01
-- Expect: the person's override wins
-- api.me() reads only the role's defaults: a person's override is lost (D2).
create or replace function core.me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  p core.person := (select p from core.person p join core.person_auth a on a.person_id = p.id where a.auth_user_id = auth.uid());
  r core.role := (select r from core.role r where r.id = p.role_id);
begin
  return pg_catalog.jsonb_build_object('status', 'ok',
    'person', pg_catalog.jsonb_build_object('id', p.id, 'role', pg_catalog.jsonb_build_object('key', r.key)),
    'levels', (select pg_catalog.jsonb_object_agg(pg.key, coalesce(case when r.is_admin then 'full'::core.level end,
       (select l.level from core.role_page_level l where l.role_id = r.id and l.page_key = pg.key and l.deleted_at is null), 'none'))
       from core.page pg));
end
$$;
