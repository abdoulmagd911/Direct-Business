-- Sabotage: a-restricted-file-shows-to-everyone
-- Breaks: sql:FILE-03
-- Expect: a team member sees the plain file and the logo
-- A restricted file (an IBAN letter, an agreement) shows to whoever sees its record, files.restricted or not.
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
  return exists (
    select 1 from core.file_link l
    where l.file_id = f.id and (l.deleted_at is null or f.deleted_at is not null)
      and case when l.side is not null
               then partner.level_of(p_person, l.entity_id, l.side) >= 'view'
                    or p_person in (select partner.side_owners(l.entity_id, l.side))
               else authz.can_see_as(p_person, l.entity_table, l.entity_id) end);
end
$$;
