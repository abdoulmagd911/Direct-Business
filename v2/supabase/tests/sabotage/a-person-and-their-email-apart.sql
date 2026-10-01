-- Sabotage: a-person-and-their-email-apart
-- Breaks: sql:PPL-03
-- Expect: the e-mail is allowed at once
-- Adding a person leaves their e-mail to a second request (ACC-093): two log entries, two Undos, and a person half made.
create or replace function core.person_create(p_person jsonb, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  pv jsonb;
  pid uuid;
  req uuid;
begin
  pv := core.person_fields(p_person - array['role_id', 'can_sign_in', 'email']);
  if not (pv ? 'full_name_en') then
    raise exception using errcode = 'P0001', message = 'person.full_name_required';
  end if;
  if not (pv ? 'department_id') then
    raise exception using errcode = 'P0001', message = 'person.department_required';
  end if;
  req := audit.begin('ui', 'person.created', null, p_reason);
  insert into core.person (full_name_en, full_name_ar, nickname_en, nickname_ar, job_title_en, job_title_ar,
                           department_id, team_id, manager_id, joined_on, left_on)
  select pg_catalog.btrim(x.full_name_en), x.full_name_ar, x.nickname_en, x.nickname_ar, x.job_title_en,
         x.job_title_ar, x.department_id, x.team_id, x.manager_id, x.joined_on, x.left_on
  from pg_catalog.jsonb_populate_record(null::core.person, pv) x
  returning id into pid;
  -- the allowed e-mail in the same request (ACC-093): one entry in the log, one Undo
  if coalesce(pg_catalog.btrim(p_person ->> 'email'), '') <> '' then
    null;
  end if;
  if p_person ->> 'role_id' is not null then
    perform core.access_set_person_role(pid, (p_person ->> 'role_id')::uuid, coalesce(p_reason, 'new person'));
  end if;
  if coalesce((p_person ->> 'can_sign_in')::boolean, false) then
    perform core.person_switch(pid, true, coalesce(p_reason, 'new person'));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', (select p.version from core.person p where p.id = pid),
                                       'email_id', (select e.id from core.person_email e
                                                    where e.person_id = pid and e.deleted_at is null limit 1),
                                       'request_id', req);
end
$$;
