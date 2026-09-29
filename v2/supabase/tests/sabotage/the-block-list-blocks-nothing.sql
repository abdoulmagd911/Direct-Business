-- Sabotage: the-block-list-blocks-nothing
-- Breaks: sql:IDN-02
-- Expect: an email of a blocked domain is refused
-- The block list is kept but never read: staff emails become identifiers.
create or replace function partner.identifier_insert(p_partner uuid, p_kind text, p_value text, p_subkind text, p_reason text,
                                          p_source text default 'person', p_valid_from date default null,
                                          p_valid_to date default null, p_note text default null) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  k text := norm.key(p_kind, p_value, partner.stop_words());
  blocked text;
  new_id uuid;
begin
  if k is null then
    raise exception using errcode = 'P0001', message = 'identifier.empty_key', detail = p_kind;
  end if;
  select b.reason into blocked from partner.identifier_block b
  where b.kind = p_kind and b.deleted_at is null
    and ((b.match = 'exact' and b.value_key = k) or (b.match = 'domain' and k like '%@' || b.value_key))
  limit 1;
  begin
    insert into partner.identifier (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source,
                                    valid_from, valid_to, note)
    values (p_partner, p_kind, p_subkind, pg_catalog.btrim(p_value), k, norm.version(), p_reason, p_source,
            p_valid_from, p_valid_to, p_note)
    returning identifier.id into new_id;
  exception when unique_violation or exclusion_violation then
    raise exception using errcode = '23505', message = 'identifier.held',
      detail = coalesce(partner.holder(p_kind, k), pg_catalog.format('%s %s', p_kind, k));
  end;
  return new_id;
end
$$;
