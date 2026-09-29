-- v2 files, notes and mentions (P3-8b): files with a kind whose name pattern names them live, linked to any record;
-- the two private Storage buckets and the rules that let a person write only the file they registered and read only
-- what they may see; notes on any record (comments, updates, meetings, calls, feedback) with their @mentions.
-- TECH-SPEC §3.4, §3.3; V53, V55, V61, V63, D10; V138, V139. Forward-only (V103).

-- ================================================================ polymorphic references (§3.4)
-- A note, a file link or a follow names its record by table and id: the table must be a record type of the registry
-- (core.entity) and the row must exist. Every business relation is a typed foreign key; these three are the exception.
create function core.entity_ref_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  found boolean;
begin
  if not exists (select 1 from core.entity e where e.table_name = new.entity_table and e.active) then
    raise exception using errcode = 'P0001', message = 'entity.unknown_table', detail = new.entity_table;
  end if;
  execute pg_catalog.format('select exists (select 1 from %s t where t.id = $1)', pg_catalog.to_regclass(new.entity_table))
    into found using new.entity_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = new.entity_table;
  end if;
  return new;
end
$$;
create trigger entity_ref before insert or update of entity_table, entity_id on notify.follow
  for each row execute function core.entity_ref_guard();

-- ================================================================ file kinds (V55)
-- A setting list: each kind has a name pattern in both languages, made of words and tokens — {number} {partner}
-- {partner official} {title} {start} {end} {date} {amount} {record} {person} {kind} {original} — and the sensitivity a
-- new file of the kind starts with (agreements are restricted — D10).
create table core.file_kind (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  name_pattern_en text not null, name_pattern_ar text not null,
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'restricted')),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  constraint file_kind_pattern_en check (pg_catalog.btrim(name_pattern_en) <> '' and pg_catalog.length(name_pattern_en) <= 200
    and name_pattern_en !~ '\{(?!(number|partner|partner official|title|start|end|date|amount|record|person|kind|original)\})'),
  constraint file_kind_pattern_ar check (pg_catalog.btrim(name_pattern_ar) <> '' and pg_catalog.length(name_pattern_ar) <= 200
    and name_pattern_ar !~ '\{(?!(number|partner|partner official|title|start|end|date|amount|record|person|kind|original)\})')
);
comment on table core.file_kind is 'Kinds of file (V55) and the pattern each one''s name is made from, live, in both languages.';

-- ================================================================ files (§3.4)
-- One uploaded file. Its bytes live in a private Storage bucket at `path`: `files` for documents, `images` for logos
-- and avatars. It is registered first (pending), uploaded by the browser, then marked stored with its checksum.
create table core.file (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('files', 'images')),
  path text not null unique,
  original_name text not null check (pg_catalog.btrim(original_name) <> '' and pg_catalog.length(original_name) <= 255),
  kind_id uuid not null references core.file_kind (id),
  mime text not null check (mime ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'stored')),
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'restricted')),
  stored_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check ((status = 'stored') = (sha256 is not null and stored_at is not null))
);
comment on table core.file is 'A file (§3.4): its original name is kept; the name it is shown and downloaded under is computed live (core.file_display_name — V55).';

-- Which records a file belongs to, and as what.
create table core.file_link (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references core.file (id),
  entity_table text not null,
  entity_id uuid not null,
  purpose text not null check (purpose in ('evidence', 'contract', 'agreement', 'attachment', 'iban_letter', 'render',
                                           'logo', 'avatar', 'tender')),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index file_link_once on core.file_link (file_id, entity_table, entity_id, purpose) where deleted_at is null;
create index file_link_record on core.file_link (entity_table, entity_id) where deleted_at is null;
create trigger entity_ref before insert or update of entity_table, entity_id on core.file_link
  for each row execute function core.entity_ref_guard();

-- ================================================================ notes and mentions (§3.4, §3.7)
-- The timeline of any record: comments, task updates, meeting notes, calls (with their outcome — V63) and partner
-- feedback. A call needs its outcome; a meeting and a call their date; every note but a call its words.
create table core.note (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid not null,
  kind text not null check (kind in ('comment', 'update', 'meeting', 'call', 'feedback')),
  body text check (body is null or pg_catalog.length(body) <= 20000),
  occurred_on date,
  outcome_id uuid references partner.call_outcome (id),
  edited_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check ((kind = 'call') = (outcome_id is not null)),
  check (kind = 'call' or pg_catalog.btrim(coalesce(body, '')) <> ''),
  check (kind not in ('meeting', 'call', 'feedback') or occurred_on is not null)
);
create index note_record on core.note (entity_table, entity_id, created_at) where deleted_at is null;
create trigger entity_ref before insert or update of entity_table, entity_id on core.note
  for each row execute function core.entity_ref_guard();

-- Who a note @mentions: each is told once (notify.push 'mentioned').
create table core.mention (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references core.note (id),
  person_id uuid not null references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  unique (note_id, person_id)
);

-- ================================================================ pictures and logos point at their file
alter table partner.partner add constraint partner_logo_file_fk foreign key (logo_file_id) references core.file (id);
alter table core.person_profile add constraint person_profile_avatar_file_fk
  foreign key (avatar_file_id) references core.file (id);

do $$
declare
  t text;
begin
  foreach t in array array['core.file_kind', 'core.file', 'core.file_link', 'core.note', 'core.mention'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('core');
select core.index_foreign_keys('partner');

-- ================================================================ who may see a record, a file
-- Whether a person may see a record (the rule of core.can_see_record, for anyone and without raising): an admin; View
-- or more on its record type's page — a profile only its owner; or one of its owners.
create function core.may_see(p_person uuid, p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.id is null or p_person is null then
    return false;
  end if;
  return (e.page_key is not null and e.page_key <> 'settings.profile' and authz.level_of(p_person, e.page_key) >= 'view')
      or p_person = any (core.owners_of(p_table, p_id));
end
$$;

-- Whether the signed-in person may see a file: its uploader always; else only once stored — a picture (logo, avatar)
-- by everyone signed in; a restricted file (IBAN letters, agreements — D10) only with files.restricted; any other
-- only by those who may see a record it is linked to.
create function authz.file_visible(p_file uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f core.file;
begin
  select * into f from core.file where id = p_file and deleted_at is null;
  if me is null or f.id is null then
    return false;
  end if;
  if f.created_by = me then
    return true;
  end if;
  if f.status <> 'stored' then
    return false;
  end if;
  if f.bucket = 'images' then
    return true;
  end if;
  if f.sensitivity = 'restricted' and not authz.can('files.restricted') then
    return false;
  end if;
  return exists (select 1 from core.file_link l
                 where l.file_id = f.id and l.deleted_at is null and core.may_see(me, l.entity_table, l.entity_id));
end
$$;

-- The Storage rules (§3.4): an object may be written only at a path its writer registered and has not finished; it
-- may be read (and a signed URL made for it) only when the file is visible to the reader.
create function authz.can_upload_file(p_bucket text, p_path text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.file f
                 where f.bucket = p_bucket and f.path = p_path and f.status = 'pending' and f.deleted_at is null
                   and f.created_by = authz.me())
$$;

create function authz.can_see_file(p_bucket text, p_path text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select authz.file_visible(f.id) from core.file f where f.bucket = p_bucket and f.path = p_path), false)
$$;

grant execute on function authz.can_upload_file(text, text), authz.can_see_file(text, text) to authenticated;

-- ================================================================ the Storage buckets and their rules (§3.4, V53)
-- Both private. Files: at most 50 MB here (the setting files.max_mb, 20 by default, is the working cap). Images:
-- pictures only, at most 2 MB (resized to 256 px in the browser before upload).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('files', 'files', false, 52428800, null),
  ('images', 'images', false, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy v2_file_write on storage.objects for insert to authenticated
  with check (bucket_id in ('files', 'images') and authz.can_upload_file(bucket_id, name));
create policy v2_file_read on storage.objects for select to authenticated
  using (bucket_id in ('files', 'images') and authz.can_see_file(bucket_id, name));
