-- Landing 32 (Finance F-B), part A3 — an imported row records WHICH code it carries, not only the code's text.
--
-- What was there: work.import_record.source_promo, the code as text; every read matched that text again.
-- What this adds, forward-only:
--   code_id    — the discount code's own row (partner.identifier), set at import by matching the row's text;
--   code_type  — 'promo' for a row that came as a code's own use (a promo holding or an attributed row),
--                'discount' for a money row that only carries a code text;
--   code_at    — the import time, taken from the row's batch;
--   code_state — 'found' · 'not_found' ("Code has not been found" — shown, never silent) · 'ambiguous' (the
--                text matches more than one code row: held for a person, never guessed).
-- A trigger sets the four on every insert and whenever the text changes, so the import engine itself is not
-- redefined. Rows already stored are filled here by the same match; the counts before and after are raised as
-- a NOTICE (the production job's log keeps them for the build note).

alter table work.import_record
  add column code_id uuid references partner.identifier (id),
  add column code_type text check (code_type is null or code_type in ('promo', 'discount')),
  add column code_at timestamptz,
  add column code_state text check (code_state is null or code_state in ('found', 'not_found', 'ambiguous'));
create index import_record_code on work.import_record (code_id);
comment on column work.import_record.code_id is
  'Landing 32: the discount code this row carries (partner.identifier), matched from source_promo at import. Null when the text matches no code or more than one (see code_state).';
comment on column work.import_record.code_state is
  'Landing 32: found · not_found (Code has not been found) · ambiguous (more than one code row carries this text: held for a person). Null when the row carries no code text.';

-- The code rows a text names: the same text, or the same code key. Live discount codes only.
create function work.import_code_match(p_text text) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select d.id from partner.identifier d
  where d.deleted_at is null and d.kind = 'discount_code'
    and pg_catalog.btrim(coalesce(p_text, '')) <> ''
    and (d.value_raw = p_text or d.value_key = norm.code_key(p_text))
$$;

create function work.import_record_code() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  hits uuid[];
begin
  if new.source_promo is null or pg_catalog.btrim(new.source_promo) = '' then
    new.code_id := null; new.code_type := null; new.code_at := null; new.code_state := null;
    return new;
  end if;
  select pg_catalog.array_agg(m) into hits from work.import_code_match(new.source_promo) m;
  new.code_id := case when pg_catalog.cardinality(hits) = 1 then hits[1] end;
  new.code_state := case when hits is null then 'not_found'
                         when pg_catalog.cardinality(hits) = 1 then 'found' else 'ambiguous' end;
  new.code_type := case when new.kind = 'promo' or new.attribution_promo then 'promo' else 'discount' end;
  new.code_at := coalesce((select b.created_at from work.import_batch b where b.id = new.batch_id), pg_catalog.now());
  return new;
end
$$;
create trigger code before insert or update of source_promo, attribution_promo on work.import_record
  for each row execute function work.import_record_code();

-- The stored rows, by the same match.
select audit.begin('system', 'finance.import_codes_matched');
do $$
declare
  with_text int; with_id int; found int; missing int; held int;
begin
  select pg_catalog.count(*) filter (where r.source_promo is not null and pg_catalog.btrim(r.source_promo) <> ''),
         pg_catalog.count(*) filter (where r.code_id is not null)
    into with_text, with_id from work.import_record r where r.deleted_at is null;
  raise notice 'L32 code backfill — before: % row(s) carry a code text, % carry a code id', with_text, with_id;
  update work.import_record r set source_promo = r.source_promo
  where r.source_promo is not null and pg_catalog.btrim(r.source_promo) <> '';
  select pg_catalog.count(*) filter (where r.code_state = 'found'),
         pg_catalog.count(*) filter (where r.code_state = 'not_found'),
         pg_catalog.count(*) filter (where r.code_state = 'ambiguous')
    into found, missing, held from work.import_record r where r.deleted_at is null;
  raise notice 'L32 code backfill — after: % found, % not found, % held (more than one code row)', found, missing, held;
end
$$;
select audit.end();

-- A code text checked before an import is confirmed (the preview): found, not found, or held.
create function work.import_code_check(p_text text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  hits uuid[];
begin
  perform authz.require('finance', 'view');
  select pg_catalog.array_agg(m) into hits from work.import_code_match(p_text) m;
  return pg_catalog.jsonb_build_object(
    'text', p_text,
    'state', case when pg_catalog.btrim(coalesce(p_text, '')) = '' then null
                  when hits is null then 'not_found'
                  when pg_catalog.cardinality(hits) = 1 then 'found' else 'ambiguous' end,
    'code_id', case when pg_catalog.cardinality(hits) = 1 then hits[1] end);
end
$$;
create function api.import_code_check(p_text text) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select work.import_code_check(p_text) $$;

revoke all on function work.import_code_match(text), work.import_record_code(), work.import_code_check(text),
  api.import_code_check(text) from public;
grant execute on function work.import_code_check(text), api.import_code_check(text) to authenticated;
