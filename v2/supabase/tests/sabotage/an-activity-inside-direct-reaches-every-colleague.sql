-- Sabotage: an-activity-inside-direct-reaches-every-colleague
-- Breaks: sql:ACT-03
-- Expect: an outsider does not see it
-- An activity inside Direct is read by every active colleague, not only by its author, the people it names, its team
-- when shared and admins (V645 (4)).
do $$
declare
  d text := pg_catalog.pg_get_functiondef('core.note_visible(uuid, uuid)'::regprocedure);
  rule text := E'            and (exists (select 1 from core.mention m where m.note_id = n.id and m.person_id = p_person';
begin
  if pg_catalog.strpos(d, rule) = 0 then
    raise exception 'the read rule is not where this sabotage expects it';
  end if;
  execute pg_catalog.replace(d, rule, E'            and (true or exists (select 1 from core.mention m where m.note_id = n.id and m.person_id = p_person');
end
$$;
