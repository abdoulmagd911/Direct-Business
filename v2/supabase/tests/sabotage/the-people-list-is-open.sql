-- Sabotage: the-people-list-is-open
-- Breaks: sql:ORGR-01
-- Expect: a member cannot open the people list
-- The people list, with emails and sign-ins, is open to everyone signed in.
create or replace function core.people() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.me();
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar, 'nickname_en', p.nickname_en,
      'nickname_ar', p.nickname_ar, 'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id, 'joined_on', p.joined_on,
      'left_on', p.left_on, 'can_sign_in', p.can_sign_in, 'active', p.active, 'version', p.version,
      'role', case when r.id is null then null
                   else pg_catalog.jsonb_build_object('id', r.id, 'key', r.key, 'is_admin', r.is_admin) end,
      'emails', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                  'id', e.id, 'email', e.email, 'is_primary', e.is_primary) order by e.is_primary desc, e.email)
                from core.person_email e where e.person_id = p.id and e.deleted_at is null), '[]'::jsonb),
      'last_sign_in_at', (select pg_catalog.max(l.at) from core.sign_in_log l
                          where l.person_id = p.id and l.result = 'ok'))
      order by pg_catalog.lower(p.full_name_en))
    from core.person p left join core.role r on r.id = p.role_id
    where p.kind = 'staff' and p.deleted_at is null), '[]'::jsonb);
end
$$;
