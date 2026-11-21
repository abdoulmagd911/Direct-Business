-- Sabotage: an-organisations-achievements-list-anothers
-- Breaks: sql:ACH-15
-- Expect: the organisation's record lists its two achievements, not another organisation's
-- The record's list forgets which organisation it is for: every organisation's achievements are listed on each.
create or replace function perf.partner_achievements(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  rows jsonb := '[]'::jsonb;
  total int := 0;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_partner is not null
     and exists (select 1 from partner.partner p where p.id = p_partner and p.deleted_at is null)
     and partner.level_of(me, p_partner, null) >= 'view'
     and authz.level_of(me, 'kpis') >= 'view' then
    with hits as (
      select a, pg_catalog.row_number() over (
                  order by a.happened_on desc nulls first, a.logged_at desc, a.id) as o
      from perf.achievement a
      where a.deleted_at is null and perf.sees_achievement(me, a)
    )
    select (select pg_catalog.count(*)::int from hits),
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                         'id', (h.a).id, 'number', (h.a).number, 'title', (h.a).title,
                         'category', c.code, 'category_en', c.name_en, 'category_ar', c.name_ar,
                         'happened_on', (h.a).happened_on, 'logged_at', (h.a).logged_at,
                         'logged_by', (h.a).created_by, 'owner_id', (h.a).owner_id) order by h.o)
                     from hits h join perf.achievement_category c on c.id = (h.a).category_id
                     where h.o <= 50), '[]'::jsonb)
      into total, rows;
  end if;
  return pg_catalog.jsonb_build_object('rows', rows, 'total', total, 'more', total > 50);
end
$$;
