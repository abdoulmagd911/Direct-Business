-- QA-208, the database half (V219): nobody removes their own last allowed e-mail they can sign in with. The screen
-- offers no Remove beside it (V219, the screen half); the database refuses it whatever the caller — a removal, or an
-- Undo that would take the row away — since an admin who did so would lock themselves out. Only another live e-mail
-- with a sign-in of its own (an auth user with that address) counts: a spare one nobody can sign in with keeps nobody
-- in (QA 1, 7 Oct). Another person's last e-mail may still be removed: that is how a person's sign-in is taken away.
-- Forward-only.
create function core.person_email_keep_own_last() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.deleted_at is null and (tg_op = 'DELETE' or new.deleted_at is not null)
     and old.person_id = authz.me()
     and not exists (select 1 from core.person_email e
                     join auth.users u on pg_catalog.lower(u.email) = pg_catalog.lower(e.email::text)
                     where e.person_id = old.person_id and e.id <> old.id and e.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'people.own_last_email';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;
create trigger keep_own_last before update of deleted_at or delete on core.person_email
  for each row execute function core.person_email_keep_own_last();
