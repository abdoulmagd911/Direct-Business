-- Travel Agencies Confirmed Database — standalone, provenance-first
-- Lives in data/ta/ta.sqlite (committed to the repo at milestones).
-- Deliberately NOT in the app's Supabase: Abdulrahman wants this built and
-- completed separately, then loaded into the app once, at the end.
--
-- Design rule: no bare values. Every email, phone, name, licence, CR number
-- is its own row carrying WHERE it came from (source), HOW it was linked
-- (method), and WHETHER it has been verified (verification records).
-- Merging never destroys: losing candidates stay, flagged, reversible.

pragma journal_mode = wal;

-- Every file/API/site data came from. One row per source snapshot.
create table if not exists sources (
  source_id     integer primary key,
  kind          text not null,          -- drive_file | api | website | manual
  name          text not null,          -- human name, e.g. 'MASTER_DB_v1.98_FINAL__Master.csv'
  drive_file_id text,                   -- Google Drive id when kind=drive_file
  url           text,
  snapshot_date text,                   -- when this copy of the data was made
  ingested_at   text,
  notes         text
);

-- One row per REAL-WORLD company (or personal-email lead until proven otherwise).
create table if not exists entities (
  entity_id     integer primary key,
  kind          text not null default 'unknown',
                 -- travel_agency | hajj_provider | tmc | ota | corporate |
                 -- integration_partner | bnpl_merchant | airline | individual | unknown
  status        text not null default 'unverified',
                 -- unverified | candidate | confirmed | rejected | duplicate_of
  duplicate_of  integer references entities(entity_id),
  display_name_en text,
  display_name_ar text,
  hq_city       text,
  hq_region     text,
  notes         text,
  created_at    text default (datetime('now')),
  updated_at    text default (datetime('now'))
);

-- Names are data, not attributes: an agency can have many spellings.
create table if not exists names (
  name_id     integer primary key,
  entity_id   integer references entities(entity_id),
  text        text not null,
  lang        text,                     -- ar | en
  name_type   text not null,            -- official_mot | official_sbc | official_wathq |
                                        -- trade | directory | from_email | unknown
  source_id   integer not null references sources(source_id),
  raw_ref     text                      -- row/cell in the source, for tracing back
);

-- CR numbers, unified numbers, MOT licences, IATA, VAT — all identifiers.
create table if not exists identifiers (
  identifier_id integer primary key,
  entity_id   integer references entities(entity_id),
  id_type     text not null,            -- cr_number | unified_number | mot_licence |
                                        -- iata | vat_number | sbc_verification_no
  value       text not null,
  status      text,                     -- valid | expired | suspended | unknown
  expiry      text,
  source_id   integer not null references sources(source_id),
  raw_ref     text,
  unique (id_type, value, entity_id)
);

create table if not exists domains (
  domain_id   integer primary key,
  entity_id   integer references entities(entity_id),
  domain      text not null,            -- root domain, lowercased, no www
  liveness    text,                     -- live | parked | broken | redirects | unchecked
  checked_at  text,
  source_id   integer not null references sources(source_id),
  unique (domain, entity_id)
);

create table if not exists emails (
  email_id    integer primary key,
  entity_id   integer references entities(entity_id),
  email       text not null,            -- lowercased
  domain      text,                     -- part after @
  is_personal_domain integer default 0, -- gmail/hotmail/yahoo/outlook/...
  contact_name text,
  syntax_ok   integer,
  unique (email, entity_id)
);
create table if not exists email_sources (
  email_id  integer not null references emails(email_id),
  source_id integer not null references sources(source_id),
  raw_ref   text,
  primary key (email_id, source_id)
);

create table if not exists phones (
  phone_id    integer primary key,
  entity_id   integer references entities(entity_id),
  e164        text,                     -- +9665… normalised; null if unparseable
  raw_value   text not null,
  line_type   text,                     -- mobile | landline | tollfree | unknown
  is_whatsapp integer default 0,
  flags       text,                     -- placeholder | fake | shared | short
  unique (raw_value, entity_id)
);
create table if not exists phone_sources (
  phone_id  integer not null references phones(phone_id),
  source_id integer not null references sources(source_id),
  raw_ref   text,
  primary key (phone_id, source_id)
);

-- Every linking/merge decision the pipeline makes, so it can be audited and undone.
create table if not exists merge_decisions (
  decision_id integer primary key,
  entity_id   integer not null references entities(entity_id),
  rule        text not null,            -- cr_number | root_domain | exact_name_ar |
                                        -- exact_name_en | phone_prefix | manual
  evidence    text not null,            -- the matching value(s)
  merged_refs text,                     -- which source rows were joined
  needs_review integer default 0,
  review_note text,
  script_version text,
  decided_at  text default (datetime('now'))
);

-- Every verification check ever run, per entity. Confirmed = has passing checks.
create table if not exists verifications (
  verification_id integer primary key,
  entity_id   integer not null references entities(entity_id),
  check_type  text not null,            -- wathq_cr | website_cr_footer | mot_licence_list |
                                        -- hajj_ministry_list | website_liveness |
                                        -- email_syntax | phone_format | sbc_manual
  outcome     text not null,            -- confirmed | mismatch | not_found | error
  detail      text,                     -- JSON payload of what was found
  checked_at  text default (datetime('now')),
  checked_by  text                      -- session/script or person
);

create index if not exists ix_names_entity on names(entity_id);
create index if not exists ix_names_text on names(text);
create index if not exists ix_ident_value on identifiers(value);
create index if not exists ix_domains_domain on domains(domain);
create index if not exists ix_emails_email on emails(email);
create index if not exists ix_emails_domain on emails(domain);
create index if not exists ix_phones_e164 on phones(e164);
create index if not exists ix_verif_entity on verifications(entity_id);
