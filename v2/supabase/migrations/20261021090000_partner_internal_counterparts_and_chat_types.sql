-- The owner's ideas of 20 Oct (V645, register MD-39), Settings data only: no screens, no rules. Forward-only (V103).
--  · The activity types WhatsApp, Email and Ticket join call, meeting, demo, visit, note and decision in the same
--    Settings list (V645 (3)): no code, an admin may rename or retire them as any other.
--  · The list of the parties inside Direct an activity can be with (V645 (1)): a team or a system, seeded with
--    Operations, Product, Website and app developers, Support. A Settings list like the contact roles — both names, the
--    order, retired never deleted; the form that chooses from it, and the counterpart it is chosen for, come with
--    their own migration and screen.
-- Each seed is added once and never over an admin's own entry of the same key.

create table partner.internal_counterpart (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table partner.internal_counterpart is 'Who inside Direct an activity was with, when it is not an organisation (V645): a team or a system — Operations, Product, Website and app developers, Support.';

alter table partner.internal_counterpart enable row level security;
select audit.track('partner.internal_counterpart'::regclass);
select core.index_foreign_keys('partner');

select audit.begin('system', 'partner.internal_lists_seeded', null, 'V645: the activity types and the internal list');
insert into partner.activity_type (key, name_en, name_ar, sort) values
  ('whatsapp', 'WhatsApp', 'واتساب', 70), ('email', 'Email', 'بريد إلكتروني', 80), ('ticket', 'Ticket', 'تذكرة', 90)
on conflict (key) do nothing;
insert into partner.internal_counterpart (key, name_en, name_ar, sort) values
  ('operations', 'Operations', 'العمليات', 10), ('product', 'Product', 'المنتج', 20),
  ('website_app_developers', 'Website and app developers', 'مطورو الموقع والتطبيق', 30),
  ('support', 'Support', 'الدعم', 40)
on conflict (key) do nothing;
select audit.end();
