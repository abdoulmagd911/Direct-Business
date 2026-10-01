-- Sabotage: a-private-note-found-in-search
-- Breaks: sql:NOTE-02
-- Expect: nor find it
-- Search matches every note's words, whoever wrote it and whoever may see it.
create or replace function core.search(p_q text, p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  q text := norm.fold(p_q);
  lim int := greatest(1, least(coalesce(p_limit, 10), 50));
  stop text[] := partner.stop_words();
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if q is null or pg_catalog.length(q) < 2 then
    return pg_catalog.jsonb_build_object('partners', '[]'::jsonb, 'people', '[]'::jsonb, 'notes', '[]'::jsonb);
  end if;
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.jsonb_build_object(
    'partners', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', y.id, 'number', y.number,
               'trade_name_en', y.trade_name_en, 'trade_name_ar', y.trade_name_ar, 'matched_by', y.matched_by)
               order by y.rank, pg_catalog.lower(y.trade_name_en))
      from (select * from (select distinct on (p.id) p.id, p.number, p.trade_name_en, p.trade_name_ar, m.matched_by, m.rank
            from partner.partner p
            join (select i.partner_id, i.kind as matched_by, 0 as rank from partner.identifier i
                  where i.deleted_at is null and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))
                    and i.value_key in (norm.key('payments_client_id', p_q), norm.key('vat', p_q), norm.key('email', p_q),
                                        norm.key('phone', p_q), norm.key('discount_code', p_q), norm.key('name', p_q, stop))
                  union all
                  select p2.id, 'name', 1 from partner.partner p2
                  where norm.fold(p2.trade_name_en) like '%' || q || '%' or norm.fold(p2.trade_name_ar) like '%' || q || '%'
                     or norm.fold(p2.official_name_en) like '%' || q || '%' or norm.fold(p2.official_name_ar) like '%' || q || '%'
                  union all
                  select p3.id, 'number', 0 from partner.partner p3 where norm.fold(p3.number) = q) m on m.partner_id = p.id
            where p.deleted_at is null and p.archived_at is null and partner.level_of(me, p.id) >= 'view'
            order by p.id, m.rank) x
            order by x.rank, pg_catalog.lower(x.trade_name_en) limit lim) y), '[]'::jsonb),
    'people', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', p.id, 'full_name_en', p.full_name_en,
               'full_name_ar', p.full_name_ar, 'job_title_en', p.job_title_en) order by pg_catalog.lower(p.full_name_en))
      from (select * from core.person p0
            where p0.kind = 'staff' and p0.active and p0.deleted_at is null
              and (norm.fold(p0.full_name_en) like '%' || q || '%' or norm.fold(p0.full_name_ar) like '%' || q || '%'
                   or norm.fold(p0.nickname_en) like '%' || q || '%' or norm.fold(p0.nickname_ar) like '%' || q || '%')
            order by pg_catalog.lower(p0.full_name_en) limit lim) p), '[]'::jsonb),
    'notes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title,
               'author_id', n.person_id, 'happened_on', n.happened_on) order by n.logged_at desc, n.id)
      from (select * from my.note n0
            where n0.deleted_at is null
              and (norm.fold(n0.title) like '%' || q || '%' or norm.fold(n0.body) like '%' || q || '%')
            order by n0.logged_at desc, n0.id limit lim) n), '[]'::jsonb));
end
$$;
