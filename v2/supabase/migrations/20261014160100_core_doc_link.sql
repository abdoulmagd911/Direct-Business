-- V435: the SOP and SLA library stays in Drive and is shown as named links. A setting list (Settings → App, admins):
-- each entry has a name in both languages, a link and a kind (sop · sla · other); every signed-in person reads the live
-- entries through api.list('doc_link') and sees them under Documents in the profile menu. The links are typed in the
-- app, never seeded (rule 7: no real address is in the repository). Saved through the generic list door (api.list_save),
-- so a banned word, a stale version and a repeated key are refused there. Forward-only (V103).
create table core.doc_link (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_.]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  link text not null check (link ~ '^https://[^[:space:]]+$' and pg_catalog.length(link) <= 2000),
  kind text not null default 'sop' check (kind in ('sop', 'sla', 'other')),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table core.doc_link is 'The SOP and SLA documents kept in Drive, as named links (V435); a task template or a contract may cite one by key (the escalation matrix is the key sop.escalation_matrix — V474).';

alter table core.doc_link enable row level security;
select audit.track('core.doc_link'::regclass);
create trigger name_banned before insert or update on core.doc_link for each row execute function core.name_banned();
select core.index_foreign_keys('core');
