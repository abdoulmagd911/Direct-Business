-- Sabotage: a-hidden-link-names-its-record
-- Breaks: sql:CMT-03
-- Expect: a reader who may not see the linked record gets no name and no id
-- A linked partner is named to every reader.
create or replace function work.comment_links(p_kinds text[], p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  n int;
  k text;
  i uuid;
  one jsonb;
  res jsonb := '[]'::jsonb;
begin
  if me is null then
    return res;
  end if;
  for n in 1 .. coalesce(pg_catalog.cardinality(p_ids), 0) loop
    k := p_kinds[n];
    i := p_ids[n];
    one := null;
    if k = 'partner' then
      select pg_catalog.jsonb_build_object('kind', k, 'id', i, 'number', p.number, 'label', p.trade_name_en,
                                           'label_ar', p.trade_name_ar)
      into one from partner.partner p where p.id = i and p.deleted_at is null;
    elsif k = 'project' and authz.can_see_as(me, 'work.project', i) then
      select pg_catalog.jsonb_build_object('kind', k, 'id', i, 'number', p.number, 'label', p.name, 'label_ar', null)
      into one from work.project p where p.id = i and p.deleted_at is null;
    elsif k = 'invoice' and authz.level_of(me, 'finance') >= 'view' then
      select pg_catalog.jsonb_build_object('kind', k, 'id', i, 'number', v.ref, 'label', v.ref, 'label_ar', null)
      into one from finance.invoice v
      where v.id = i and v.deleted_at is null and (finance.exclusion_of(v.id)).mode is distinct from 'hide';
    elsif k = 'code' and authz.level_of(me, 'codes') >= 'view' then
      select pg_catalog.jsonb_build_object('kind', k, 'id', i, 'number', d.value_raw, 'label', d.value_raw,
                                           'label_ar', null)
      into one from partner.identifier d where d.id = i and d.kind = 'discount_code' and d.deleted_at is null;
    end if;
    res := res || pg_catalog.jsonb_build_array(coalesce(one, pg_catalog.jsonb_build_object('kind', k, 'hidden', true)));
  end loop;
  return res;
end
$$;
