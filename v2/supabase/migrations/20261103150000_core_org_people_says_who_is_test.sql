-- The Task screens' org list says which rows are TEST users (core.person.is_test, the data's own mark), so the
-- test-task Remove gate (taskIsTestOwned) can see them. One field added to core.org() as 20260929095500 wrote it;
-- nothing else changes. The People list (core.people()) already said this since 20261028130000; the org list did
-- not, so the Remove control never appeared live even though its unit test passed with hand-built people.
create or replace function core.org() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return pg_catalog.jsonb_build_object(
    'departments', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', d.id, 'code', d.code, 'name_en', d.name_en, 'name_ar', d.name_ar, 'head_person_id', d.head_person_id,
        'active', d.active, 'version', d.version) order by d.name_en)
      from core.department d where d.deleted_at is null), '[]'::jsonb),
    'teams', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', t.id, 'department_id', t.department_id, 'code', t.code, 'name_en', t.name_en, 'name_ar', t.name_ar,
        'lead_person_id', t.lead_person_id, 'active', t.active, 'retired_at', t.retired_at,
        'retired_into_team_id', t.retired_into_team_id, 'version', t.version) order by t.name_en)
      from core.team t), '[]'::jsonb),
    'roles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'sort', r.sort, 'is_admin', r.is_admin,
        'active', r.active, 'version', r.version) order by r.sort, r.key)
      from core.role r), '[]'::jsonb),
    'people', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
        'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
        'display_name_en', coalesce(pr.display_name_en, p.nickname_en, p.full_name_en),
        'display_name_ar', coalesce(pr.display_name_ar, p.nickname_ar, p.full_name_ar),
        'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
        'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
        'avatar_color', pr.avatar_color, 'avatar_file_id', pr.avatar_file_id, 'badge_kind', pr.badge_kind,
        'badge_value', pr.badge_value, 'account', p.account, 'is_test', p.is_test) order by pg_catalog.lower(p.full_name_en))
      from core.person p left join core.person_profile pr on pr.person_id = p.id
      where p.kind = 'staff' and p.active and p.deleted_at is null), '[]'::jsonb));
end
$$;
