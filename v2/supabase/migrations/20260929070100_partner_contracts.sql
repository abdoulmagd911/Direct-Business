-- v2 partners, part 2 — contracts (P3-8b): a partner's contracts and agreements with their dates and reminders, and
-- their terms before → after. The status is computed, never stored (V56). TECH-SPEC §3.4; V56; V140. Forward-only
-- (V103).

create table partner.contract (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  kind text not null default 'contract' check (kind in ('contract', 'agreement')),
  title text not null check (pg_catalog.btrim(title) <> '' and pg_catalog.length(title) <= 200),
  start_on date not null,
  end_on date,                                              -- null: open-ended
  reminders_on boolean not null default true,
  reminder_days int[],                                      -- null: the setting partner.contract_reminder_days
  renewal_task_id uuid,                                     -- → work.task, added with tasks (P5-1)
  notes text,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (end_on is null or end_on >= start_on),
  check (reminder_days is null or (pg_catalog.cardinality(reminder_days) between 1 and 6
                                   and 1 <= all (reminder_days) and 365 >= all (reminder_days)))
);
create index contract_partner on partner.contract (partner_id) where deleted_at is null;
comment on table partner.contract is 'A contract or agreement with a partner (V56): its status (Active, Expires in N days, Expired, Not started) is computed from its dates; its documents are core.file rows linked with purpose contract or agreement.';

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

do $$
declare
  t text;
begin
  foreach t in array array['partner.contract', 'partner.contract_term'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('partner');
