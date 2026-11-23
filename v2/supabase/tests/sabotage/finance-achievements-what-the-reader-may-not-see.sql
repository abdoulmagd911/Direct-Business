-- Sabotage: finance-achievements-what-the-reader-may-not-see
-- Breaks: sql:FAC-01
-- Expect: another team sees none of them
-- The read forgets the Achievements page's own rule: every team's achievements are listed to everyone.
create or replace function perf.finance_achievements(p_from date, p_to date) returns jsonb
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
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  if authz.level_of(me, 'finance') >= 'view' and authz.level_of(me, 'kpis') >= 'view' then
    with hits as (
      select a, pg_catalog.row_number() over (order by a.happened_on desc, a.logged_at desc, a.id) as o
      from perf.achievement a
      where a.happened_on between p_from and p_to and a.deleted_at is null
    )
    select (select pg_catalog.count(*)::int from hits),
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                         'id', (h.a).id, 'number', (h.a).number, 'title', (h.a).title,
                         'category', c.code, 'category_en', c.name_en, 'category_ar', c.name_ar,
                         'happened_on', (h.a).happened_on,
                         'partner_id', p.id, 'partner_en', p.trade_name_en, 'partner_ar', p.trade_name_ar,
                         'owner_id', o.id, 'owner_en', o.full_name_en, 'owner_ar', o.full_name_ar) order by h.o)
                     from hits h
                     join perf.achievement_category c on c.id = (h.a).category_id
                     left join partner.partner p on p.id = (h.a).partner_id and p.deleted_at is null
                                                 and partner.level_of(me, p.id, null) >= 'view'
                     left join core.person o on o.id = (h.a).owner_id
                     where h.o <= 50), '[]'::jsonb)
      into total, rows;
  end if;
  return pg_catalog.jsonb_build_object('from', p_from, 'to', p_to, 'rows', rows, 'total', total, 'more', total > 50);
end
$$;
