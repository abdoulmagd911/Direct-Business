-- Sabotage: a-restricted-file-shows-to-everyone
-- Breaks: sql:FILE-03
-- Expect: a team member sees the plain file and the logo
-- A restricted file (an IBAN letter, an agreement) shows to everyone who sees its record.
create or replace function authz.file_visible(p_file uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f core.file;
begin
  select * into f from core.file where id = p_file and deleted_at is null;
  if me is null or f.id is null then
    return false;
  end if;
  if f.created_by = me then
    return true;
  end if;
  if f.status <> 'stored' then
    return false;
  end if;
  if f.bucket = 'images' then
    return true;
  end if;
  return exists (select 1 from core.file_link l
                 where l.file_id = f.id and l.deleted_at is null and core.may_see(me, l.entity_table, l.entity_id));
end
$$;
