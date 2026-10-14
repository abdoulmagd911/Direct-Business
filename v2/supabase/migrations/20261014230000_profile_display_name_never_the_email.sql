-- A display name is never the person's own e-mail (the Architect's order of 14 Oct, from QA 2: My profile's Arabic name
-- showed the e-mail). No seed, sign-up or backfill writes one: the browser's password manager fills a saved sign-in
-- into the text box before My profile's password fields, and the box saves on blur. The screen now gives the browser
-- its own username box; here the database refuses to keep the e-mail as a name, whatever writes it, and empties any
-- display name that is just one of the person's e-mails, so the box shows empty and the person types their name.
-- Forward-only.

-- A display name equal (case and spaces aside) to one of the person's own e-mails is kept empty.
create function core.display_name_not_email() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.display_name_en is not null and exists (
       select 1 from core.person_email e
       where e.person_id = new.person_id and pg_catalog.lower(e.email) = pg_catalog.lower(pg_catalog.btrim(new.display_name_en))) then
    new.display_name_en := null;
  end if;
  if new.display_name_ar is not null and exists (
       select 1 from core.person_email e
       where e.person_id = new.person_id and pg_catalog.lower(e.email) = pg_catalog.lower(pg_catalog.btrim(new.display_name_ar))) then
    new.display_name_ar := null;
  end if;
  return new;
end
$$;

revoke all on function core.display_name_not_email() from public;

create trigger person_profile_display_name_not_email
  before insert or update of display_name_en, display_name_ar on core.person_profile
  for each row execute function core.display_name_not_email();

-- The names already kept that are just the person's e-mail: emptied, as one logged system change.
select audit.begin('system', 'profile.display_name_email_cleared');
update core.person_profile pr
set display_name_en = case when exists (select 1 from core.person_email e where e.person_id = pr.person_id
                                         and lower(e.email) = lower(btrim(pr.display_name_en)))
                           then null else pr.display_name_en end,
    display_name_ar = case when exists (select 1 from core.person_email e where e.person_id = pr.person_id
                                         and lower(e.email) = lower(btrim(pr.display_name_ar)))
                           then null else pr.display_name_ar end
where exists (select 1 from core.person_email e
              where e.person_id = pr.person_id
                and lower(e.email) in (lower(btrim(pr.display_name_en)), lower(btrim(pr.display_name_ar))));
select audit.end();
