-- Mutant m02-me-unlinked-not-refused: api.me() no longer answers not_listed for a sign-in linked to no person
CREATE OR REPLACE FUNCTION core.me()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  a core.person_auth;
  p core.person;
  r core.role;
  pr core.person_profile;
  d core.device_session;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  if a.id is null or not exists (select 1 from core.person_email e
                                 where e.person_id = a.person_id and e.email operator(extensions.=) a.email
                                   and e.deleted_at is null) then
    null;
  end if;
  select * into p from core.person where id = a.person_id;
  if p.kind <> 'staff' or not p.active or not p.can_sign_in or p.deleted_at is not null then
    return pg_catalog.jsonb_build_object('status', 'switched_off');
  end if;
  select * into d from core.device_session s where s.auth_session_id = core.jwt_session_id() and s.auth_user_id = uid;
  if d.id is null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'unknown');
  end if;
  if d.signed_out_at is not null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', d.sign_out_reason);
  end if;
  if d.last_seen_at <= core.clock() - pg_catalog.make_interval(days => core.device_idle_days()) then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'inactive');
  end if;
  select * into r from core.role where id = p.role_id;
  select * into pr from core.person_profile where person_id = p.id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'session', pg_catalog.jsonb_build_object(
      'device_id', d.id, 'signed_in_at', d.signed_in_at, 'last_seen_at', d.last_seen_at, 'email', a.email),
    'person', pg_catalog.jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'version', p.version,
      'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
      'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
      'role', case when r.id is null then null else pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'is_admin', r.is_admin) end),
    'levels', coalesce((
      select pg_catalog.jsonb_object_agg(pg.key, authz.level_of(p.id, pg.key))
      from core.page pg where pg.active), '{}'::jsonb),
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(c.key order by c.key)
      from core.capability c where c.active and authz.can_of(p.id, c.key)), '[]'::jsonb),
    'departments', (
      select pg_catalog.jsonb_agg(ds.dep order by ds.dep)
      from (select p.department_id as dep
            union
            select pd.department_id from core.person_department pd
            where pd.person_id = p.id and pd.deleted_at is null) ds),
    'profile', case when pr.id is null then null else pg_catalog.jsonb_build_object(
      'display_name_en', pr.display_name_en, 'display_name_ar', pr.display_name_ar,
      'avatar_file_id', pr.avatar_file_id, 'avatar_color', pr.avatar_color,
      'badge_kind', pr.badge_kind, 'badge_value', pr.badge_value,
      'theme', pr.theme, 'density', pr.density, 'locale', pr.locale, 'start_page', pr.start_page,
      'drawer_pinned', pr.drawer_pinned, 'notify', pr.notify, 'version', pr.version) end
  );
end
$function$
;
