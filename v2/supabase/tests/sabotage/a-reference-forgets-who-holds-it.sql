-- Sabotage: a-reference-forgets-who-holds-it
-- Breaks: sql:XREF-02
-- Expect: names the department that holds it
-- A reference no longer says which department holds the access (V484).
create or replace function partner.references(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := partner.require_level(p_partner, null, 'view');
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', r.id, 'side', r.side, 'system', s.key, 'system_en', s.name_en, 'system_ar', s.name_ar, 'value', r.value,
      'url', r.url, 'link', coalesce(r.url, pg_catalog.replace(s.url_template, '{value}', r.value)),
      'held_by', null,
      'code_goes_to', r.code_goes_to,
      'version', r.version) order by s.sort, s.key, r.value)
    from partner.reference r join work.ref_system s on s.id = r.system_id
    left join core.department d on d.id = r.held_by_department_id
    where r.partner_id = p_partner and r.deleted_at is null and partner.sees_side(me, p_partner, r.side)), '[]'::jsonb);
end
$$;
