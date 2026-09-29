-- Sabotage: a-file-name-ignores-its-records
-- Breaks: sql:FILE-02
-- Expect: the name follows its kind's pattern
-- A file's name ignores the records it is linked to: no partner, no title, no dates.
create or replace function core.file_display_name(p_file uuid, p_locale text default 'en') returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  f core.file;
  k core.file_kind;
  ext text;
  tok jsonb;
  t jsonb;
  l record;
  fn regprocedure;
  m text[];
  nm text := '';
begin
  select * into f from core.file where id = p_file;
  if f.id is null then
    return null;
  end if;
  select * into k from core.file_kind where id = f.kind_id;
  ext := core.file_ext(f.original_name);
  tok := pg_catalog.jsonb_build_object(
    'date', pg_catalog.to_char((f.created_at at time zone 'Asia/Riyadh')::date, 'YYYY-MM-DD'),
    'original', case when ext = '' then f.original_name
                     else pg_catalog.left(f.original_name, pg_catalog.length(f.original_name) - pg_catalog.length(ext) - 1) end,
    'kind', case when p_locale = 'ar' then k.name_ar else k.name_en end);
  for l in select x.entity_table, x.entity_id from core.file_link x
           where x.file_id = f.id and x.deleted_at is null order by x.created_at, x.id loop
    fn := pg_catalog.to_regprocedure(l.entity_table || '_file_tokens(uuid, text)');
    if fn is not null then
      execute pg_catalog.format('select %s($1, $2)', fn::regproc) into t using l.entity_id, p_locale;
      tok := tok;
    end if;
  end loop;
  for m in select pg_catalog.regexp_matches(case when p_locale = 'ar' then k.name_pattern_ar else k.name_pattern_en end,
                                            '\{[a-z ]+\}|[^{]+|\{', 'g') loop
    if m[1] ~ '^\{[a-z ]+\}$' then
      nm := nm || coalesce(tok ->> pg_catalog.substr(m[1], 2, pg_catalog.length(m[1]) - 2), '');
    else
      nm := nm || m[1];
    end if;
  end loop;
  nm := pg_catalog.regexp_replace(nm, '[\\/:*?"<>|[:cntrl:]]', '-', 'g');
  nm := pg_catalog.regexp_replace(nm, '\s+', ' ', 'g');
  nm := pg_catalog.regexp_replace(nm, '(\s*·\s*)+', ' · ', 'g');
  nm := pg_catalog.btrim(nm, ' ·');
  if nm = '' then
    nm := tok ->> 'original';
  end if;
  return pg_catalog.left(nm, 150) || case when ext <> '' then '.' || ext else '' end;
end
$$;
