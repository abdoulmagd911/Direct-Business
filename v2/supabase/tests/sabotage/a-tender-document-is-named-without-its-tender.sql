-- Sabotage: a-tender-document-is-named-without-its-tender
-- Breaks: sql:PIPE-07
-- Expect: filed on the tender and named with it
-- A file on a tender is named without the tender: its number and title are dropped (V55).
create or replace function pipeline.tender_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select partner.partner_file_tokens(t.partner_id, p_locale) || pg_catalog.jsonb_build_object(
    'number', t.number, 'title', t.title, 'record', null)
  from pipeline.tender t where t.id = p_id
$$;
