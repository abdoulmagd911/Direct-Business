-- Landing 41 (the owner, 22 Nov: "achievements show on Finance as a separate, non-money list") — the Finance page
-- gains a list of the achievements of the period on screen, apart from the money. This is its read: the achievements
-- whose day falls in the period, newest first, at most 50, each with its number, title, category, day, organisation
-- and owner.
-- Not money: an achievement's value is not revenue (FIX-06 / D29). The answer carries no amount at all, and no money
-- read is touched — the figures, the ledger and "Is it counted?" count exactly what they counted before.
-- Who sees what is the Achievements page's own rule, not a second one: a row is listed only where
-- perf.sees_achievement says the reader sees it, and only for a reader who holds at least View on KPIs and on
-- Finance. Anyone else is answered an empty list rather than a refusal. An organisation is named only to a reader who
-- may open it. Removed achievements are never listed.
-- A separate small read on purpose: every existing function is untouched. Forward-only (V103).
-- Regression test: FAC-01 (supabase/tests/finance/).
create function perf.finance_achievements(p_from date, p_to date) returns jsonb
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
      where a.happened_on between p_from and p_to and a.deleted_at is null and perf.sees_achievement(me, a)
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
comment on function perf.finance_achievements(date, date) is 'Landing 41: the achievements of a period for the Finance page — a list apart from the money, with no amount.';

create function api.finance_achievements(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.finance_achievements(p_from, p_to) $$;

revoke all on function perf.finance_achievements(date, date), api.finance_achievements(date, date) from public;
grant execute on function perf.finance_achievements(date, date) to authenticated;
grant execute on function api.finance_achievements(date, date) to authenticated;
