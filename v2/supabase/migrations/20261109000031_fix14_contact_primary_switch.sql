-- FIX-14 — the Primary switch saves (F114). contact_save never unset the partner's existing primary contact, so
-- making another contact primary always hit the contact_one_primary partial unique index and came back as an error
-- (which had no wording of its own). Now, when the incoming values make a contact primary, the partner's other
-- primary contacts are unset in the same request — the person_email_add precedent — under the same audit request, so
-- the switch succeeds and the old primary's change is on the record's history. The unique-violation mapping stays as
-- a safety net. Nothing else in the function changes.
create or replace function partner.contact_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  c partner.contact;
  k text;
  req uuid;
  cid uuid;
begin
  for k in select pg_catalog.jsonb_object_keys(coalesce(p_values, '{}')) loop
    if k not in ('name_en', 'name_ar', 'job_title', 'email', 'phone', 'notes', 'is_primary', 'role_id', 'sides') then
      raise exception using errcode = 'P0001', message = 'contact.unknown_field', detail = k;
    end if;
  end loop;
  if p_values ? 'role_id' and p_values ->> 'role_id' is not null
     and not exists (select 1 from partner.contact_role r where r.id = (p_values ->> 'role_id')::uuid and r.active
                     and r.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'contact.unknown_role';
  end if;
  begin
    if p_id is null then
      req := audit.begin('ui', 'contact.saved', null, null);
      if coalesce((p_values ->> 'is_primary')::boolean, false) then
        update partner.contact set is_primary = false
          where partner_id = p_partner and is_primary and deleted_at is null and id is distinct from p_id;
      end if;
      insert into partner.contact (partner_id, name_en, name_ar, job_title, email, phone, notes, is_primary, role_id, sides)
      select p_partner, x.name_en, x.name_ar, x.job_title, x.email, x.phone, x.notes, coalesce(x.is_primary, false),
             x.role_id, coalesce(x.sides, '{client,supplier_partner}')
      from pg_catalog.jsonb_populate_record(null::partner.contact, p_values) x
      returning id into cid;
    else
      select * into c from partner.contact where id = p_id and partner_id = p_partner and deleted_at is null;
      if c.id is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      perform core.check_version('partner.contact', p_id, p_version,
        (select pg_catalog.array_agg(k2) from pg_catalog.jsonb_object_keys(p_values) k2 where (pg_catalog.to_jsonb(c) -> k2) is distinct from (p_values -> k2)));
      req := audit.begin('ui', 'contact.saved', null, null);
      if coalesce((p_values ->> 'is_primary')::boolean, false) then
        update partner.contact set is_primary = false
          where partner_id = p_partner and is_primary and deleted_at is null and id is distinct from p_id;
      end if;
      perform audit.write_fields('partner.contact', p_id, p_values);
      cid := p_id;
    end if;
  exception
    when not_null_violation or check_violation then
      raise exception using errcode = 'P0001', message = 'contact.name_required';
    when unique_violation then
      raise exception using errcode = '23505', message = 'contact.one_primary';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'version', (select x.version from partner.contact x where x.id = cid),
                                       'request_id', req);
end
$$;
