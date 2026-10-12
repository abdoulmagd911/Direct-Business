-- Sabotage: two-expenses-without-a-time-are-one
-- Breaks: sql:IMP-10
-- Expect: two expenses of one type with no created time stay two, and the next file finds both
-- A file's repeated key is not numbered, so two expenses of one type with no created time collapse into one (QA-539).
create or replace function finance.keyed_rows(p_file text, p_rows jsonb) returns jsonb
language sql stable set search_path = ''
as $$
  with k as (
    select e.ordinality as ord, e.value as x, finance.row_key_of(p_file, e.value, false) as base,
           finance.row_key_of(p_file, e.value, true) as grp,
           -- only a row with nothing of its own to tell it apart is numbered: a repeated created time or reference at
           -- the payment method is the same row twice
           pg_catalog.jsonb_typeof(e.value) = 'object'
             and finance.row_text(e.value, case p_file when 'expenses' then 'created_at' else 'ref_at_method' end)
                 is null as bare
    from pg_catalog.jsonb_array_elements(p_rows) with ordinality e
  ), n as (
    select k.ord, k.x, k.grp,
           case when k.base is null then null
                when not k.bare or pg_catalog.row_number() over w = 1 then k.base
                else k.base end as key
    from k window w as (partition by k.base order by k.ord)
  )
  select case when p_file not in ('expenses', 'receipts') then p_rows
              else coalesce(pg_catalog.jsonb_agg(
                     case when n.key is null then n.x
                          else n.x || pg_catalog.jsonb_build_object(
                                 '_line_key', n.key,
                                 '_group_keys', (select pg_catalog.jsonb_agg(m.key) from n m
                                                 where m.grp = n.grp and m.key is not null))
                     end order by n.ord), '[]'::jsonb) end
  from n
$$;
