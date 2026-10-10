-- Sabotage: an-import-overwrites-a-persons-edit
-- Breaks: sql:ROW-01
-- Expect: the newer file lists what it left alone: the edited fields, the removed line, the invoice added by hand
-- A newer import overwrites a field a person edited in the app (V622, D21).
create or replace function finance.merge_fields(p_old jsonb, p_new jsonb, p_src jsonb, p_time timestamptz)
returns table (fields jsonb, src jsonb, kept jsonb)
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
  nv jsonb;
  ov jsonb;
  took jsonb := '{}'::jsonb;
  left_alone jsonb := '{}'::jsonb;
  s jsonb := coalesce(p_src, '{}'::jsonb);
begin
  for k, nv in select e.key, e.value from pg_catalog.jsonb_each(p_new) e loop
    continue when nv is null or nv = 'null'::jsonb;
    ov := p_old -> k;
    continue when ov = nv;
    if false then
      left_alone := left_alone || pg_catalog.jsonb_build_object(k, nv);
    elsif ov is null or ov = 'null'::jsonb or p_time > coalesce(nullif(s ->> k, 'person')::timestamptz, '-infinity'::timestamptz) then
      took := took || pg_catalog.jsonb_build_object(k, nv);
      s := s || pg_catalog.jsonb_build_object(k, p_time);
    end if;
  end loop;
  return query select took, s, left_alone;
end
$$;
