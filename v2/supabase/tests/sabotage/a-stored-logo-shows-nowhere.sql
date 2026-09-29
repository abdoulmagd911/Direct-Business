-- Sabotage: a-stored-logo-shows-nowhere
-- Breaks: sql:FILE-04
-- Expect: then it is the partner's logo
-- A logo or photo is stored but never becomes the partner's logo or the person's avatar.
create or replace function core.file_finish(p_id uuid, p_sha256 text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f core.file;
  l core.file_link;
  req uuid;
begin
  select * into f from core.file where id = p_id and deleted_at is null;
  if me is null or f.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if f.created_by <> me then
    raise exception using errcode = '42501', message = 'file.not_yours';
  end if;
  if f.status = 'stored' then
    raise exception using errcode = 'P0001', message = 'file.already_stored';
  end if;
  if p_sha256 is null or pg_catalog.lower(p_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'file.checksum_invalid';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = f.bucket and o.name = f.path) then
    raise exception using errcode = 'P0001', message = 'file.not_uploaded';
  end if;
  req := audit.begin('ui', 'file.stored', null, null);
  update core.file set status = 'stored', sha256 = pg_catalog.lower(p_sha256), stored_at = pg_catalog.now() where id = p_id;
  for l in select * from core.file_link x where false loop
    if l.purpose = 'logo' then
      update partner.partner set logo_file_id = p_id where id = l.entity_id;
    elsif exists (select 1 from core.person_profile pr where pr.person_id = l.entity_id) then
      update core.person_profile set avatar_file_id = p_id where person_id = l.entity_id;
    else
      insert into core.person_profile (person_id, avatar_file_id) values (l.entity_id, p_id);
    end if;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
    'display_name_en', core.file_display_name(p_id, 'en'), 'display_name_ar', core.file_display_name(p_id, 'ar'));
end
$$;
