-- Sabotage: filling-a-blank-lowers-its-time
-- Breaks: sql:IMP-12
-- Expect: an older file that fills a blank keeps the field's newer time
-- An older file that fills a blank records its own, older time for the field (QA-539).
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
    if s ->> k = 'person' then
      left_alone := left_alone || pg_catalog.jsonb_build_object(k, nv);
    elsif ov is null or ov = 'null'::jsonb or p_time > coalesce((s ->> k)::timestamptz, '-infinity'::timestamptz) then
      took := took || pg_catalog.jsonb_build_object(k, nv);
      -- an older file that fills a blank never lowers the field's time (QA-539)
      s := s || pg_catalog.jsonb_build_object(k, p_time);
    end if;
  end loop;
  return query select took, s, left_alone;
end
$$;
