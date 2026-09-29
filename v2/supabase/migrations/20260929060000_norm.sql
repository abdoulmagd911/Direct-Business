-- v2 folding (P3-8a): one copy of every rule that turns a typed name, code, email or phone into the key it is matched by
-- — TECH-SPEC §3.5 (A17). Pure SQL, immutable, versioned: stored keys carry norm.version(); a migration that changes a
-- function here ends with norm.rebuild() (added with the tables that store keys). Forward-only (V103).

-- The version of the rules below. Bump it with any change to them.
create function norm.version() returns int
language sql immutable parallel safe set search_path = ''
as $$ select 1 $$;

-- NFKC; lower case; Arabic letter forms folded (أ إ آ ٱ → ا; ى ئ → ي; ة → ه; ؤ → و; Persian ک → ك, ی → ي); Arabic-Indic
-- and Extended digits → 0–9; harakat and tatweel removed; "." removed (L.L.C. = LLC); every other character that is
-- not a letter or digit → one space; trimmed. Letters are listed by range, so the answer never depends on the
-- database's locale.
create function norm.fold(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.replace(
      pg_catalog.regexp_replace(
        pg_catalog.translate(pg_catalog.lower(pg_catalog.normalize(t, 'NFKC')),
          'أإآٱىئةؤکی٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          'ااااييهوكي01234567890123456789'),
        '[ً-ٰٟـ]', '', 'g'),
      '.', ''),
    '[^a-z0-9À-ɏء-غف-يٱ-ۓ]+', ' ', 'g')), '')
$$;
comment on function norm.fold(text) is 'The one folding of typed text (§3.5): NFKC, lower case, Arabic forms and digits, no marks, no dots.';

-- A name's key: folded, the form words dropped (شركه, company, llc … — the setting partner.name_stop_words, passed in),
-- joined with no spaces; nothing left → null. The article "ال" is kept (dropping it merges distinct names).
create function norm.name_key(t text, stop_words text[]) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select nullif(pg_catalog.string_agg(w, '' order by n), '')
  from pg_catalog.regexp_split_to_table(norm.fold(t), ' ') with ordinality as x(w, n)
  where w <> '' and not (w = any (coalesce((select pg_catalog.array_agg(norm.fold(s)) from pg_catalog.unnest(stop_words) s),
                                           '{}')))
$$;

create function norm.email_key(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select case when pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(t)), '@') > 0
              then pg_catalog.lower(pg_catalog.btrim(t)) end
$$;

-- Digits only (Arabic digits converted); a leading 00, then 966, then leading zeros are dropped, then 966 once more
-- (the old code missed 0966…); fewer than 7 digits is no phone.
create function norm.phone_key(t text) returns text
language plpgsql immutable parallel safe set search_path = ''
as $$
declare
  d text := pg_catalog.regexp_replace(coalesce(norm.fold(t), ''), '[^0-9]', '', 'g');
begin
  if d like '00%' then
    d := pg_catalog.substr(d, 3);
  end if;
  if d like '966%' then
    d := pg_catalog.substr(d, 4);
  end if;
  d := pg_catalog.ltrim(d, '0');
  if d like '966%' then
    d := pg_catalog.substr(d, 4);
  end if;
  return case when pg_catalog.length(d) >= 7 then d end;
end
$$;

-- VAT and CR: digits only. A Payments client ID: digits, leading zeros dropped.
create function norm.digits_key(t text, p_drop_leading_zeros boolean default false) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select nullif(case when p_drop_leading_zeros
                     then pg_catalog.ltrim(pg_catalog.regexp_replace(coalesce(norm.fold(t), ''), '[^0-9]', '', 'g'), '0')
                     else pg_catalog.regexp_replace(coalesce(norm.fold(t), ''), '[^0-9]', '', 'g') end, '')
$$;

-- A discount or campaign code: folded, then only letters and digits.
create function norm.code_key(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select nullif(pg_catalog.regexp_replace(coalesce(norm.fold(t), ''), '[^a-z0-9À-ɏء-يٱ-ۓ]', '', 'g'), '')
$$;

-- The key of an identifier of a kind (§3.4 partner.identifier.kind).
create function norm.key(p_kind text, t text, stop_words text[] default '{}') returns text -- check-allow: norm-rebuild-called — the first definitions, before any key is stored; norm.rebuild() arrives with the tables that store keys
language sql immutable parallel safe set search_path = ''
as $$
  select case p_kind
           when 'payments_client_id' then norm.digits_key(t, true)
           when 'vat' then norm.digits_key(t)
           when 'cr' then norm.digits_key(t)
           when 'discount_code' then norm.code_key(t)
           when 'email' then norm.email_key(t)
           when 'phone' then norm.phone_key(t)
           when 'name' then norm.name_key(t, stop_words)
         end
$$;
