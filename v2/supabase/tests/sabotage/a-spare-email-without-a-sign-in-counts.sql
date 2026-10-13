-- Sabotage: a-spare-email-without-a-sign-in-counts
-- Breaks: sql:SIGN-12
-- Expect: a spare e-mail with no sign-in keeps nobody in: the one they sign in with is still refused
-- Any other live e-mail counts, even one nobody can sign in with, so an admin removes the one they sign in with and is
-- locked out (QA 1, 7 Oct).
create or replace function core.person_email_keep_own_last() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.deleted_at is null and (tg_op = 'DELETE' or new.deleted_at is not null)
     and old.person_id = authz.me()
     and not exists (select 1 from core.person_email e
                     where e.person_id = old.person_id and e.id <> old.id and e.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'people.own_last_email';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;
