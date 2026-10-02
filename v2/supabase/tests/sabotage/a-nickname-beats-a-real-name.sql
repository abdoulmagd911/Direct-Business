-- Sabotage: a-nickname-beats-a-real-name
-- Breaks: sql:NAMEMATCH-01
-- Expect: a real name beats someone's nickname
-- Nicknames count as much as real names, so a real name shared with a nickname reads as several.
create or replace function core.people_match(p_names text[]) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  nm text;
  q text;
  hit uuid[];
  out jsonb := '{}'::jsonb;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  foreach nm in array coalesce(p_names, '{}') loop
    q := norm.fold(nm);
    continue when q is null or q = '' or out ? nm;
    select pg_catalog.array_agg(p.id) into hit from core.person p
    where p.kind = 'staff' and p.account = 'team_member' and p.deleted_at is null
      and (norm.fold(p.full_name_en) = q or norm.fold(p.full_name_ar) = q or norm.fold(p.nickname_en) = q);
    if hit is null then
      select pg_catalog.array_agg(p.id) into hit from core.person p
      where p.kind = 'staff' and p.account = 'team_member' and p.deleted_at is null
        and (norm.fold(p.nickname_en) = q or norm.fold(p.nickname_ar) = q);
    end if;
    if hit is null then
      select pg_catalog.array_agg(distinct e.person_id) into hit from core.person_email e
      join core.person p on p.id = e.person_id
      where e.deleted_at is null and p.kind = 'staff' and p.account = 'team_member' and p.deleted_at is null
        and norm.fold(pg_catalog.split_part(e.email::text, '@', 1)) = q;
    end if;
    out := out || pg_catalog.jsonb_build_object(nm, case
      when hit is null then pg_catalog.jsonb_build_object('kind', 'none')
      when pg_catalog.cardinality(hit) = 1 then pg_catalog.jsonb_build_object('kind', 'one', 'id', hit[1])
      else pg_catalog.jsonb_build_object('kind', 'many') end);
  end loop;
  return out;
end
$$;
