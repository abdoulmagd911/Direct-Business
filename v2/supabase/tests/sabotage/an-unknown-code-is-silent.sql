-- Sabotage: an-unknown-code-is-silent
-- Breaks: sql:CID-01
-- Expect: a text no code carries is marked: Code has not been found
-- A code text that matches no code is stored with no mark at all.
create or replace function work.import_record_code() returns trigger
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
  new.code_state := case when hits is null then null
                         when pg_catalog.cardinality(hits) = 1 then 'found' else 'ambiguous' end;
  new.code_type := case when new.kind = 'promo' or new.attribution_promo then 'promo' else 'discount' end;
  new.code_at := coalesce((select b.created_at from work.import_batch b where b.id = new.batch_id), pg_catalog.now());
  return new;
end
$$;
