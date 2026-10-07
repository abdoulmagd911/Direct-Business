-- Sabotage: the-same-file-twice-writes-again
-- Breaks: sql:IMP-01
-- Expect: and its rows read again change nothing
-- Reading the same rows again rewrites every field (§3.11.6).
create or replace function finance.merge_fields(p_old jsonb, p_new jsonb, p_src jsonb, p_time timestamptz)
returns table (fields jsonb, src jsonb)
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
  nv jsonb;
  ov jsonb;
  took jsonb := '{}'::jsonb;
  s jsonb := coalesce(p_src, '{}'::jsonb);
begin
  for k, nv in select e.key, e.value from pg_catalog.jsonb_each(p_new) e loop
    continue when nv is null or nv = 'null'::jsonb;
    ov := p_old -> k;
    if ov is null or ov = 'null'::jsonb or p_time >= coalesce((s ->> k)::timestamptz, '-infinity'::timestamptz) then
      took := took || pg_catalog.jsonb_build_object(k, nv);
      s := s || pg_catalog.jsonb_build_object(k, p_time);
    end if;
  end loop;
  return query select took, s;
end
$$;
