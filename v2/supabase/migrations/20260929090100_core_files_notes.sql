-- v2 files, notes and mentions (P3-8b-2): the timeline of any record — comments, updates, meeting notes and
-- activities — each dated by the day it happened and stamped when it was logged (V400); files with a kind whose pattern
-- names them live (V55), linked to any record and to one side of an organisation (V98), a travel policy with its review
-- date (V401); the two private Storage buckets and their rules; the notices the spec names, all of them now so no later
-- step widens the list again. TECH-SPEC §3.3, §3.4; V53, V55, V61, V98, V400, V401, D10; V150–V152. Forward-only (V103).

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

-- ================================================================ file kinds (V55, V401)
-- A setting list: each kind has a name pattern in both languages, made of words and tokens — {number} {partner}
-- {partner official} {title} {start} {end} {date} {amount} {record} {person} {kind} {original} — the sensitivity a new
-- file of the kind starts with (agreements are restricted — D10), and whether it needs a review date (a travel policy).
create table core.file_kind (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  name_pattern_en text not null, name_pattern_ar text not null,
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'restricted')),
  review_required boolean not null default false,
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint file_kind_pattern_en check (pg_catalog.btrim(name_pattern_en) <> '' and pg_catalog.length(name_pattern_en) <= 200
    and name_pattern_en !~ '\{(?!(number|partner|partner official|title|start|end|date|amount|record|person|kind|original)\})'),
  constraint file_kind_pattern_ar check (pg_catalog.btrim(name_pattern_ar) <> '' and pg_catalog.length(name_pattern_ar) <= 200
    and name_pattern_ar !~ '\{(?!(number|partner|partner official|title|start|end|date|amount|record|person|kind|original)\})')
);
comment on table core.file_kind is 'Kinds of file (V55) and the pattern each one''s name is made from, live, in both languages; a travel policy needs a review date (V401).';

-- ================================================================ files (§3.4)
-- One uploaded file. Its bytes live in a private Storage bucket at `path`: `files` for documents, `images` for logos
-- and photos. It is registered first (pending), uploaded by the browser, then marked stored with its checksum.
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
  review_on date,                                           -- a travel policy's review date (V401)
  stored_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check ((status = 'stored') = (sha256 is not null and stored_at is not null))
);
create index file_review on core.file (review_on) where review_on is not null and deleted_at is null;
comment on table core.file is 'A file (§3.4): its original name is kept; the name it is shown and downloaded under is computed live (core.file_display_name — V55).';

-- Which records a file belongs to, and as what; on an organisation, which side (null: both — its logo, its CR).
create table core.file_link (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references core.file (id),
  entity_table text not null,
  entity_id uuid not null,
  purpose text not null check (purpose in ('evidence', 'contract', 'agreement', 'attachment', 'iban_letter', 'render',
                                           'logo', 'avatar', 'travel_policy', 'tender')),
  side text check (side in ('client', 'supplier_partner')),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (side is null or entity_table = 'partner.partner'),
  check (purpose <> 'travel_policy' or (entity_table = 'partner.partner' and side = 'client')),
  check (purpose <> 'logo' or side is null)
);
create unique index file_link_once on core.file_link (file_id, entity_table, entity_id, purpose) where deleted_at is null;
create index file_link_record on core.file_link (entity_table, entity_id) where deleted_at is null;
create trigger entity_ref before insert or update of entity_table, entity_id on core.file_link
  for each row execute function core.entity_ref_guard();

-- A file linked to one side of an organisation only while that side is on.
create function core.file_link_side_on() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.side is not null and not partner.side_on(new.entity_id, new.side) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = new.side;
  end if;
  return new;
end
$$;
create trigger side_on before insert on core.file_link for each row execute function core.file_link_side_on();
create trigger side_fixed before update on core.file_link for each row execute function partner.side_fixed();

-- ================================================================ notes and mentions (§3.4, §3.7, V400, V401)
-- The timeline of any record: comments, task updates, meeting notes, escalations and activities (a call, a meeting, a
-- demo, a visit, a note — with its outcome and an optional next step). Each has the day it happened (any past day,
-- never after the day it was logged — V400) and when it was logged. Every note but an activity needs its words.
create table core.note (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid not null,
  kind text not null check (kind in ('comment', 'update', 'activity', 'meeting_note', 'escalation')),
  body text check (body is null or pg_catalog.length(body) <= 20000),
  happened_on date not null default core.riyadh_today(),
  logged_at timestamptz not null default core.clock(),
  activity_type_id uuid references partner.activity_type (id),
  outcome_id uuid,
  next_step text check (next_step is null or (pg_catalog.btrim(next_step) <> '' and pg_catalog.length(next_step) <= 500)),
  next_step_on date,
  next_step_task_id uuid,                                   -- → work.task, added with tasks (P5-1)
  edited_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  foreign key (outcome_id, activity_type_id) references partner.activity_outcome (id, activity_type_id),
  constraint note_activity_has_type check ((kind = 'activity') = (activity_type_id is not null)),
  constraint note_body_required check (kind = 'activity' or pg_catalog.btrim(coalesce(body, '')) <> ''),
  constraint note_not_after_logged check (happened_on <= core.riyadh_day(logged_at)),
  constraint note_next_step_has_day check (next_step is null or next_step_on is not null),
  constraint note_next_step_after check (next_step_on is null or (kind = 'activity' and next_step_on >= happened_on))
);
create index note_record on core.note (entity_table, entity_id, created_at) where deleted_at is null;
create index note_activity on core.note (entity_table, entity_id, happened_on desc) where deleted_at is null and kind = 'activity';
create trigger entity_ref before insert or update of entity_table, entity_id on core.note
  for each row execute function core.entity_ref_guard();
comment on table core.note is 'The timeline of any record (§3.4): comments, updates, meeting notes, escalations and activities (V401), each with the day it happened and when it was logged (V400).';

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

-- ================================================================ the notices (§3.3)
-- Every kind the spec names, so later steps (escalations, quiet clients, project updates) add no list of their own.
alter table notify.notification drop constraint notification_kind_check;
alter table notify.notification add constraint notification_kind_check check (kind in (
  'assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change', 'decision_needed', 'report_issued',
  'report_for_review', 'appraisal_step', 'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
  'alert_invoice_unpaid', 'alert_kpi_checkin', 'escalated', 'alert_quiet_client', 'alert_project_no_update',
  'alert_activity_stale', 'alert_file_review'));

-- ================================================================ who may see a file
-- Whether a person may see a file: its uploader always; anyone else only once it is stored — a picture (logo, photo) by
-- every active member of staff; a restricted file (IBAN letters, agreements — D10) only with files.restricted; any
-- other by those who may see a record it is linked to (on one side of an organisation: that side's page, or its owner).
create function core.file_visible_as(p_file uuid, p_person uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  f core.file;
begin
  select * into f from core.file where id = p_file;
  if p_person is null or f.id is null
     or not exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff' and p.active
                    and p.can_sign_in and p.deleted_at is null) then
    return false;
  end if;
  if f.created_by = p_person then
    return true;
  end if;
  if f.status <> 'stored' then
    return false;
  end if;
  if f.bucket = 'images' then
    return true;
  end if;
  if f.sensitivity = 'restricted' and not authz.can_of(p_person, 'files.restricted') then
    return false;
  end if;
  return exists (
    select 1 from core.file_link l
    where l.file_id = f.id and (l.deleted_at is null or f.deleted_at is not null)
      and case when l.side is not null
               then partner.level_of(p_person, l.entity_id, l.side) >= 'view'
                    or p_person in (select partner.side_owners(l.entity_id, l.side))
               else authz.can_see_as(p_person, l.entity_table, l.entity_id) end);
end
$$;

-- A file's link: seen with its file.
create function core.file_link_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select core.file_visible_as(l.file_id, p_person) from core.file_link l where l.id = p_id), false) $$;

-- The signed-in person and a live file.
create function authz.file_visible(p_file uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.file f where f.id = p_file and f.deleted_at is null)
         and core.file_visible_as(p_file, authz.me())
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
