-- Landing 15 (FIX-13, F-B1-01 + F-B3-03): the top search finds discount codes by their text, and stops
-- returning captured notes. F-B1-01: Ctrl-K "FLIGHTS10" showed only the holder organisation, never the code
-- itself — core.search had no 'codes' key and the palette rendered no group for one. The new 'codes' key
-- answers the code's id, text and state for a reader who sees Codes, matched by part of the text, as a task
-- number already is. F-B3-03: Ctrl-K "Al Safa" returned a NOTES group — the 'notes' key is removed, from the
-- answer and from the short-query early return; the palette was its only app reader, and the database tests
-- that asserted it (SRCH-02, SRCH-03, NOTE-02) are updated in this landing. Copied
-- from 20261109000017 exactly otherwise. Forward-only (V103).
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
    return pg_catalog.jsonb_build_object('partners', '[]'::jsonb, 'people', '[]'::jsonb, 'tasks', '[]'::jsonb,
                                         'codes', '[]'::jsonb, 'invoices', '[]'::jsonb);
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
    -- D4: tasks by title or number, each one the reader may see (live: a task is found the moment it is saved);
    -- V660: and by an item of its checklist, the hit naming that item
    'tasks', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title,
               'due_on', t.due_on, 'closed', t.closed_at is not null, 'partner_id', t.partner_id,
               -- V662: whether the reader may change it (add to its checklist), the Tasks page's own test
               'can_edit', work.can_edit_task(me, (select x from work.task x where x.id = t.id)),
               'item', case when norm.fold(t.title) not like '%' || q || '%' and norm.fold(t.number) not like '%' || q || '%'
                            then (select a.text from work.action_item a
                                  where a.task_id = t.id and a.deleted_at is null
                                    and norm.fold(a.text) like '%' || q || '%'
                                  order by a.sort, a.created_at, a.id limit 1) end)
               order by t.closed_at is not null, t.due_on nulls last, t.number)
      from (select * from work.task t0
            where t0.deleted_at is null
              and (norm.fold(t0.title) like '%' || q || '%' or norm.fold(t0.number) like '%' || q || '%'
                   or exists (select 1 from work.action_item a0
                              where a0.task_id = t0.id and a0.deleted_at is null
                                and norm.fold(a0.text) like '%' || q || '%'))
              and work.row_level('work.task', t0.id, me) >= 'view'
            order by t0.closed_at is not null, t0.due_on nulls last, t0.number limit lim) t), '[]'::jsonb),
    -- F-B1-01: discount codes by their text, for a reader who sees Codes (the code itself is the match —
    -- the holder organisation already answers under 'partners'). A code's state comes from its own dates, as
    -- the codes list shows it.
    'codes', case when authz.level_of(me, 'codes') >= 'view'
                  then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', d.id, 'code', d.value_raw,
               'state', finance.code_state(d.valid_from, d.valid_to))
               order by pg_catalog.lower(d.value_raw), d.id)
      from (select * from partner.identifier d0
            where d0.kind = 'discount_code' and d0.deleted_at is null
              and norm.fold(d0.value_raw) like '%' || q || '%'
            order by pg_catalog.lower(d0.value_raw), d0.id limit lim) d), '[]'::jsonb)
                  else '[]'::jsonb end,
    -- D4: invoices by their number or DPIN, for a reader who sees Finance (V458)
    'invoices', case when authz.level_of(me, 'finance') >= 'view'
                     then coalesce(finance.search_numbers(p_q, lim), '[]'::jsonb) else '[]'::jsonb end);
end
$$;
