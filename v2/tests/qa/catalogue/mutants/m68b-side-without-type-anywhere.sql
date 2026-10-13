-- Mutant m68b-side-without-type-anywhere: a side switches on without a type: function guard, list trigger null-case and NOT NULL all gone
CREATE OR REPLACE FUNCTION partner.side_put(p_id uuid, p_side text, p_values jsonb, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}');
  cur partner.partner_side;
  k text;
  v_type uuid;
  v_tier uuid;
  v_owner uuid;
  sid uuid;
begin
  if p_side is null or p_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = p_side;
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('type', 'type_id', 'tier', 'tier_id', 'fields', 'since', 'owner_id') then
      raise exception using errcode = 'P0001', message = 'partner.unknown_field', detail = k;
    end if;
  end loop;
  v_type := partner.side_entry('partner.side_type', p_side, coalesce(v ->> 'type_id', v ->> 'type'));
  v_tier := partner.side_entry('partner.side_tier', p_side, coalesce(v ->> 'tier_id', v ->> 'tier'));
  if v ? 'fields' then
    perform partner.side_fields_check(p_side, v -> 'fields');
  end if;
  select * into cur from partner.partner_side s where s.partner_id = p_id and s.side = p_side and s.deleted_at is null;
  if cur.id is null or not partner.side_on(p_id, p_side) then
    -- switching on
    if v_type is null and cur.id is null then
      null;
    end if;
    if not (v ? 'fields') then
      perform partner.side_fields_check(p_side, coalesce(cur.field_values, '{}'));
    end if;
    v_owner := coalesce((v ->> 'owner_id')::uuid,
                      (select x from partner.side_owners(p_id, p_side) x limit 1), me);
    if v_owner <> me and not exists (select 1 from partner.side_owners(p_id, p_side) x where x = v_owner) then
      perform authz.require_capability(partner.side_page(p_side) || '.assign');
    end if;
  elsif v ? 'owner_id' then
    raise exception using errcode = 'P0001', message = 'partner.owner_has_its_own_door';
  end if;
  if cur.id is null then
    insert into partner.partner_side (partner_id, side, type_id, tier_id, field_values, since)
    values (p_id, p_side, v_type, v_tier, coalesce(v -> 'fields', '{}'),
            coalesce((v ->> 'since')::date, core.riyadh_today()))
    returning id into sid;
  else
    sid := cur.id;
    perform audit.write_fields('partner.partner_side', cur.id, pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'type_id', v_type, 'tier_id', v_tier, 'field_values', v -> 'fields', 'since', v -> 'since'))
      || case when partner.side_on(p_id, p_side) then '{}'::jsonb else '{"until": null}'::jsonb end);
  end if;
  if v_owner is not null then
    perform partner.side_owner_set_inner(p_id, p_side, v_owner, core.riyadh_today(), p_reason);
  end if;
  return sid;
end
$function$
;

CREATE OR REPLACE FUNCTION partner.side_lists_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and new.side is distinct from old.side then
    raise exception using errcode = 'P0001', message = 'partner.side_fixed';
  end if;
  if (new.type_id is not null and not exists (select 1 from partner.side_type t where t.id = new.type_id and t.side = new.side))
     or (new.tier_id is not null and not exists (select 1 from partner.side_tier t where t.id = new.tier_id and t.side = new.side)) then
    raise exception using errcode = 'P0001', message = 'partner.list_of_other_side', detail = new.side;
  end if;
  return new;
end
$function$
;

alter table partner.partner_side alter column type_id drop not null;
