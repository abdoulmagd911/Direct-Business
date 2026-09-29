-- Sabotage: the-schema-checks-only-the-type
-- Breaks: sql:JSON-01
-- Expect: a value outside its list is refused
-- The schema check looks at the type only: any string passes where a list of words is allowed.
create or replace function core.json_check(p_schema jsonb, p_value jsonb, p_path text default '$') returns text
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
  t text := pg_catalog.jsonb_typeof(p_value);
  types jsonb := p_schema -> 'type';
  ok boolean;
  n numeric;
  e jsonb;
  i int := 0;
  bad text;
begin
  if pg_catalog.jsonb_typeof(p_schema) is distinct from 'object' then
    return p_path || ': no schema';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_schema) loop
    if k not in ('$schema', 'type', 'enum', 'const', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
                 'minLength', 'maxLength', 'pattern', 'items', 'minItems', 'maxItems', 'uniqueItems', 'properties',
                 'required', 'additionalProperties', 'title', 'description') then
      return p_path || ': the schema uses "' || k || '", which the database does not check';
    end if;
  end loop;
  if types is not null then
    if pg_catalog.jsonb_typeof(types) = 'string' then
      types := pg_catalog.jsonb_build_array(types);
    end if;
    select pg_catalog.bool_or(case x
                                when 'integer' then t = 'number'
                                  and (p_value #>> '{}')::numeric = pg_catalog.trunc((p_value #>> '{}')::numeric)
                                else t = x end)
      into ok
    from pg_catalog.jsonb_array_elements_text(types) x;
    if not coalesce(ok, false) then
      return p_path || ': expected ' || (select pg_catalog.string_agg(x, ' or ') from pg_catalog.jsonb_array_elements_text(types) x);
    end if;
  end if;
  if p_schema ? 'const' and p_value is distinct from (p_schema -> 'const') then
    return p_path || ': must be ' || (p_schema ->> 'const');
  end if;
  if t = 'number' then
    n := (p_value #>> '{}')::numeric;
    if (p_schema ? 'minimum' and n < (p_schema ->> 'minimum')::numeric)
       or (p_schema ? 'exclusiveMinimum' and n <= (p_schema ->> 'exclusiveMinimum')::numeric) then
      return p_path || ': too small';
    end if;
    if (p_schema ? 'maximum' and n > (p_schema ->> 'maximum')::numeric)
       or (p_schema ? 'exclusiveMaximum' and n >= (p_schema ->> 'exclusiveMaximum')::numeric) then
      return p_path || ': too large';
    end if;
  elsif t = 'string' then
    if p_schema ? 'minLength' and pg_catalog.char_length(p_value #>> '{}') < (p_schema ->> 'minLength')::int then
      return p_path || ': too short';
    end if;
    if p_schema ? 'maxLength' and pg_catalog.char_length(p_value #>> '{}') > (p_schema ->> 'maxLength')::int then
      return p_path || ': too long';
    end if;
    if p_schema ? 'pattern' and not ((p_value #>> '{}') ~ (p_schema ->> 'pattern')) then
      return p_path || ': does not match its pattern';
    end if;
  elsif t = 'array' then
    if p_schema ? 'minItems' and pg_catalog.jsonb_array_length(p_value) < (p_schema ->> 'minItems')::int then
      return p_path || ': too few items';
    end if;
    if p_schema ? 'maxItems' and pg_catalog.jsonb_array_length(p_value) > (p_schema ->> 'maxItems')::int then
      return p_path || ': too many items';
    end if;
    if coalesce((p_schema ->> 'uniqueItems')::boolean, false)
       and (select pg_catalog.count(distinct x) from pg_catalog.jsonb_array_elements(p_value) x)
           <> pg_catalog.jsonb_array_length(p_value) then
      return p_path || ': an item is repeated';
    end if;
    if p_schema ? 'items' then
      for e in select x from pg_catalog.jsonb_array_elements(p_value) x loop
        bad := core.json_check(p_schema -> 'items', e, p_path || '[' || i || ']');
        if bad is not null then
          return bad;
        end if;
        i := i + 1;
      end loop;
    end if;
  elsif t = 'object' then
    if p_schema ? 'required' then
      select pg_catalog.string_agg(r, ', ') into bad
      from pg_catalog.jsonb_array_elements_text(p_schema -> 'required') r where not (p_value ? r);
      if bad is not null then
        return p_path || ': missing ' || bad;
      end if;
    end if;
    if p_schema ? 'properties' then
      for k in select pg_catalog.jsonb_object_keys(p_value) loop
        if p_schema -> 'properties' ? k then
          bad := core.json_check(p_schema -> 'properties' -> k, p_value -> k, p_path || '.' || k);
          if bad is not null then
            return bad;
          end if;
        elsif (p_schema -> 'additionalProperties') = 'false'::jsonb then
          return p_path || ': "' || k || '" is not allowed';
        end if;
      end loop;
    end if;
  end if;
  return null;
end
$$;
