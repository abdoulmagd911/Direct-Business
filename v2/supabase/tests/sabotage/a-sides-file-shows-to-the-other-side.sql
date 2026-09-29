-- Sabotage: a-sides-file-shows-to-the-other-side
-- Breaks: sql:FILE-05
-- Expect: the client desk sees the Client side's file, not the supplier's
-- A file on one side shows to whoever sees the organisation, whichever side they may see.
create or replace function core.file_visible_as(p_file uuid, p_person uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  f core.file;
begin
  select * into f from core.file where id = p_file;
  if p_person is null or f.id is null
     or not exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff' and p.active
                    and p.can_sign_in and p.deleted_at is null) then
    return false;
  end if;
  if f.created_by = p_person then
    return true;
  end if;
  if f.status <> 'stored' then
    return false;
  end if;
  if f.bucket = 'images' then
    return true;
  end if;
  if f.sensitivity = 'restricted' and not authz.can_of(p_person, 'files.restricted') then
    return false;
  end if;
  return exists (
    select 1 from core.file_link l
    where l.file_id = f.id and (l.deleted_at is null or f.deleted_at is not null)
      and authz.can_see_as(p_person, l.entity_table, l.entity_id));
end
$$;
