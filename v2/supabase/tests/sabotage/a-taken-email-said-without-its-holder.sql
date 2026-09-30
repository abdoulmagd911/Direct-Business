-- Sabotage: a-taken-email-said-without-its-holder
-- Breaks: sql:PPL-04
-- Expect: the same e-mail in other capitals is refused, naming who holds it
-- The refusal repeats the e-mail instead of naming who holds it.
create or replace function core.person_email_add(p_person uuid, p_email text, p_primary boolean default false,
                                      p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
  e core.person_email;
  holder text;
begin
  perform authz.require_admin();
  req := audit.begin('ui', 'person_email.added', pg_catalog.jsonb_build_object('email', p_email), p_reason);
  select p.full_name_en into holder from core.person_email x join core.person p on p.id = x.person_id
  where x.email operator(extensions.=) pg_catalog.btrim(p_email)::extensions.citext and x.deleted_at is null;
  if holder is not null then
    raise exception using errcode = '23505', message = 'people.email_taken', detail = p_email;
  end if;
  if p_primary then
    update core.person_email set is_primary = false where person_id = p_person and is_primary and deleted_at is null;
  end if;
  insert into core.person_email (person_id, email, is_primary)
  values (p_person, lower(pg_catalog.btrim(p_email)),
          p_primary or not exists (select 1 from core.person_email x where x.person_id = p_person and x.deleted_at is null))
  returning * into e;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', e.id, 'version', e.version, 'request_id', req);
end
$$;
