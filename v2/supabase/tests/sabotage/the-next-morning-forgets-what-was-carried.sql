-- Sabotage: the-next-morning-forgets-what-was-carried
-- Breaks: sql:WRAP-02
-- Expect: the next morning shows both carried over
-- The next morning's My day lists nothing as carried over, though the wrap-up moved items to it (Stage 1).
create or replace function my.carried_over(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'kind', case c.entity_table when 'work.task' then 'task' else 'note' end, 'id', c.entity_id,
           'from', c.carried_from, 'times', my.carry_count(p_person, c.entity_table, c.entity_id))
           order by c.entity_table, c.carried_from, c.entity_id), '[]'::jsonb)
  from (select distinct on (x.entity_table, x.entity_id) x.*
        from my.carry x
        where x.person_id = p_person and x.deleted_at is null
        order by x.entity_table, x.entity_id, x.created_at desc, x.id desc) c
  where false and c.carried_to = core.riyadh_today()
    and case c.entity_table
          when 'work.task' then exists (select 1 from work.task t where t.id = c.entity_id and t.deleted_at is null
                                          and t.closed_at is null and t.owner_id = p_person)
          else exists (select 1 from my.note n where n.id = c.entity_id and n.deleted_at is null and n.done_at is null
                         and n.person_id = p_person)
        end
$$;
