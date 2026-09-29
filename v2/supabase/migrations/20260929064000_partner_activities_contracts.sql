-- v2 activities, contracts and references (P3-8b-2): the activity types and their outcomes (V401 — P3-8a's call
-- outcomes become the call's, meanings kept), contracts and their terms on one side of an organisation (V56, V98), the
-- list of Direct's systems and an organisation's references to them — a supplier's portal link and username, never a
-- password (V98, V409). TECH-SPEC §3.4; V150, V153, V154. Forward-only (V103).

-- ================================================================ activity types and their outcomes (V401, V63, V88)
create table partner.activity_type (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table partner.activity_type is 'What was done with an organisation (V401): call · meeting · demo · visit · note — admins add more.';

-- The call outcomes of P3-8a, with their meanings (meeting set, demo set, demo held — V406), become the outcomes of the
-- activity types: each outcome belongs to one type; a type may have none (a note).
alter table partner.call_outcome rename to activity_outcome;
alter index partner.call_outcome_one_per_meaning rename to activity_outcome_one_per_meaning;
alter table partner.activity_outcome add column activity_type_id uuid references partner.activity_type (id);
comment on table partner.activity_outcome is 'The outcomes of each activity type (V63, V88, V401): a call''s no answer · meeting set · demo set …, a demo''s held · cancelled; demo set and demo held count as demos, and their meanings drive the demo task (V406).';

do $$
declare
  t text;
begin
  foreach t in array array['partner.activity_type'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;

select audit.begin('system', 'partner.activity_types_seeded');
insert into partner.activity_type (key, name_en, name_ar, sort) values
  ('call', 'Call', 'مكالمة', 10), ('meeting', 'Meeting', 'اجتماع', 20), ('demo', 'Demo', 'عرض توضيحي', 30),
  ('visit', 'Visit', 'زيارة', 40), ('note', 'Note', 'ملاحظة', 50);
update partner.activity_outcome set activity_type_id = (select t.id from partner.activity_type t where t.key = 'demo')
where key = 'demo_held';
update partner.activity_outcome set activity_type_id = (select t.id from partner.activity_type t where t.key = 'call')
where activity_type_id is null;
insert into partner.activity_outcome (key, name_en, name_ar, counts_as_demo, sort, activity_type_id)
select x.key, x.name_en, x.name_ar, false, x.sort, t.id
from (values ('meeting_held', 'Held', 'تم', 110, 'meeting'), ('meeting_postponed', 'Postponed', 'تأجل', 120, 'meeting'),
             ('meeting_cancelled', 'Cancelled', 'أُلغي', 130, 'meeting'),
             ('demo_cancelled', 'Demo cancelled', 'أُلغي العرض التوضيحي', 150, 'demo'),
             ('visit_done', 'Visited', 'تمت الزيارة', 170, 'visit')) x(key, name_en, name_ar, sort, type_key)
join partner.activity_type t on t.key = x.type_key;
select audit.end();
alter table partner.activity_outcome alter column activity_type_id set not null;
alter table partner.activity_outcome add constraint activity_outcome_of_its_type unique (id, activity_type_id);

-- ================================================================ contracts, per side (V56, V98)
-- A contract or agreement belongs to one side of an organisation — a client's corporate agreement, a supplier's rate
-- contract. Its status (Active, Expires in N days, Expired, Not started) is computed from its dates, never stored.
create table partner.contract (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  side text not null check (side in ('client', 'supplier_partner')),
  kind text not null default 'contract' check (kind in ('contract', 'agreement')),
  title text not null check (pg_catalog.btrim(title) <> '' and pg_catalog.length(title) <= 200),
  start_on date not null,
  end_on date,                                              -- null: open-ended
  reminders_on boolean not null default true,
  reminder_days int[],                                      -- null: the setting partner.contract_reminder_days
  renewal_task_id uuid,                                     -- → work.task, added with tasks (P5-1)
  notes text check (notes is null or pg_catalog.length(notes) <= 4000),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (end_on is null or end_on >= start_on),
  check (reminder_days is null or (pg_catalog.cardinality(reminder_days) between 1 and 6
                                   and 1 <= all (reminder_days) and 365 >= all (reminder_days)))
);
create index contract_partner on partner.contract (partner_id, side) where deleted_at is null;
comment on table partner.contract is 'A contract or agreement on one side of an organisation (V56, V98): its status is computed from its dates; its documents are core.file rows linked with purpose contract or agreement.';

-- The "Terms · before → after" block (V56): each term of the list partner.term, once per contract.
create table partner.contract_term (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references partner.contract (id),
  term_id uuid not null references partner.term (id),
  value_before numeric,
  value_after numeric,
  achievement_id uuid,                                      -- → perf.achievement, added with achievements (P5)
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index contract_term_once on partner.contract_term (contract_id, term_id) where deleted_at is null;

-- ================================================================ Direct's systems and references to them (V98, V409)
-- The systems a record may point into: the ticket system, bookings, invoices, a portal. A system's link is made from
-- its URL pattern ({value} is the reference) — a setting, blank until an admin fills it.
create table work.ref_system (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  url_template text check (url_template is null or (url_template ~ '^https://[^[:space:]]+$'
                                                     and pg_catalog.strpos(url_template, '{value}') > 0
                                                     and pg_catalog.length(url_template) <= 500)),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table work.ref_system is 'Direct''s systems a reference points into (§3.4, V99): ticket, booking, invoice, portal; the URL pattern is a setting.';

-- Whether a text looks like a password or a secret (V98, V409): a secret word in English or Arabic, a URL carrying a
-- password before its host, or a URL whose query carries a secret parameter.
create function core.looks_secret(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    p ~* '(^|[^a-z])(password|passcode|passwd|pass|pwd|secret|token|pin|otp|credentials?)([^a-z]|$)'
    or p ~ '(كلمة\s*(ال)?(مرور|سر)|الرقم\s*السري|رمز\s*(ال)?دخول)'
    or p ~* '^[a-z][a-z0-9+.-]*://[^/?#@[:space:]]*:[^/?#@[:space:]]*@'
    or p ~* '[?&;](access_token|api_?key|apikey|auth|key|sig|signature)=', false)
$$;

-- A reference on an organisation to one of Direct's systems — shared, or on one side (a supplier's portal: the portal
-- link in `url`, the username in `value` — V409). Anything that looks like a password is refused.
create table partner.reference (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  side text check (side in ('client', 'supplier_partner')),   -- null: shared by both sides
  system_id uuid not null references work.ref_system (id),
  value text not null check (pg_catalog.btrim(value) <> '' and pg_catalog.length(value) <= 200),
  url text check (url is null or (url ~* '^https?://[^[:space:]]+$' and pg_catalog.length(url) <= 1000)),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint reference_no_secrets check (not core.looks_secret(value) and not core.looks_secret(url))
);
create index reference_partner on partner.reference (partner_id) where deleted_at is null;
comment on table partner.reference is 'An organisation''s reference to one of Direct''s systems (V98, V409): a ticket number, a portal link and its username — never a password.';

-- A side's own record starts only while that side is on, and keeps its side.
create function partner.side_must_be_on() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.side is not null and not partner.side_on(new.partner_id, new.side) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = new.side;
  end if;
  return new;
end
$$;
create trigger side_on before insert on partner.contract for each row execute function partner.side_must_be_on();
create trigger side_on before insert on partner.reference for each row execute function partner.side_must_be_on();
create trigger side_fixed before update on partner.contract for each row execute function partner.side_fixed();
create trigger side_fixed before update on partner.reference for each row execute function partner.side_fixed();

do $$
declare
  t text;
begin
  foreach t in array array['partner.contract', 'partner.contract_term', 'work.ref_system', 'partner.reference'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('partner');
select core.index_foreign_keys('work');

select audit.begin('system', 'work.ref_systems_seeded');
insert into work.ref_system (key, name_en, name_ar, sort) values
  ('ticket', 'Ticket', 'تذكرة', 10), ('booking', 'Booking', 'حجز', 20), ('invoice', 'Invoice', 'فاتورة', 30),
  ('portal', 'Portal', 'بوابة', 40);
select audit.end();

-- A record of an organisation: its side and its organisation — a contract's terms go with their contract.
create or replace function partner.row_of(p_table text, p_id uuid, out partner_id uuid, out side text) returns record
language plpgsql stable security definer set search_path = ''
as $$
declare
  r jsonb;
begin
  if p_table = 'partner.contract_term' then
    select c.partner_id, c.side into partner_id, side
    from partner.contract_term t join partner.contract c on c.id = t.contract_id where t.id = p_id;
    return;
  end if;
  execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1', pg_catalog.to_regclass(p_table))
    into r using p_id;
  if r is null then
    return;
  end if;
  partner_id := case p_table when 'partner.partner' then (r ->> 'id')::uuid when 'partner.merge' then (r ->> 'kept_id')::uuid
                             else (r ->> 'partner_id')::uuid end;
  side := case when p_table = 'partner.credit_limit' then 'client'
               when p_table = 'partner.identifier' and r ->> 'kind' in ('payments_client_id', 'discount_code') then 'client'
               else r ->> 'side' end;
end
$$;
