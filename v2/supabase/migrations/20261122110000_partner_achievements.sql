-- Landing 35 (the owner's check of 21 Nov: "add an achievement and confirm it shows on the client") — an achievement
-- logged with an organisation (perf.achievement.partner_id) showed nowhere on that organisation's record. This is the
-- read behind the record's Related tab: the organisation's achievements, newest first, at most 50.
-- Who sees what is the Achievements page's own rule, not a second one: a row is listed only where
-- perf.sees_achievement says the reader sees it (FIX-03), and only for a reader who holds at least View on KPIs —
-- what perf.achievement_list asks before it answers. Someone who may not open the organisation, or who holds nothing
-- on KPIs, is answered an empty list rather than a refusal: the tab is part of a record they are reading, and an
-- empty section says "none you may see" without telling them whether any exist. Removed achievements are never
-- listed. An achievement's value is not revenue (FIX-06 / D29): the answer carries no amount at all.
-- A separate small read on purpose: api.partner_page and every existing function are untouched. Forward-only (V103).
-- Regression test: ACH-15 (supabase/tests/perf/).
create function perf.partner_achievements(p_partner uuid) returns jsonb
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
      where a.partner_id = p_partner and a.deleted_at is null and perf.sees_achievement(me, a)
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

create function api.partner_achievements(p_partner uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.partner_achievements(p_partner) $$;

revoke all on function perf.partner_achievements(uuid), api.partner_achievements(uuid) from public;
grant execute on function perf.partner_achievements(uuid) to authenticated;
grant execute on function api.partner_achievements(uuid) to authenticated;
