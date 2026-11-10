-- FIX-23 (Landing 6) — the targets screen, built from scratch (D32; parent ruling Q4: stays in the fix round).
-- The diagnosis (egm-fix/diagnosis-fix23.md) found: the plans list exists but its rows are dead, no plan-detail
-- screen exists, no target model exists (the plan comment says targets are "builder A's"), the categories list
-- editor cannot be the generic ListEditor, and the performance group has no settings at all.
--
-- What this migration adds, bounded to the 14 R32 controls (test plan §3.5):
--   * perf.target — the minimal fix-round target model: one row per (plan, category, month). A target names the
--     count of achievements expected in that category that month, and, where the category carries a deal value,
--     the deal-value total expected. Achieved is READ, never stored: the targets read counts live achievements
--     (not drafts) of the category whose day falls in the month, and sums their deal values. Objectives, KPIs,
--     readings and pace views stay KPI pace; this table is only what add / edit / save need.
--   * perf.plan_get — one plan row, the detail screen's read (same shape as perf.plans items).
--   * perf.targets / perf.target_save — the targets read and write.
--   * perf.category_usage / perf.category_retire — the two list-editor controls the generic machinery cannot
--     serve for categories: usage (core.list_uses over the category's foreign keys) and retire with replacement
--     (moves live achievements to a same-plan active category, then archives — the list_retire shape, scoped to
--     categories; sub-categories are never re-parented, so a category with live sub-categories is refused, the
--     same rule categories_remove already applies).
-- What it deliberately does NOT add: no generic-list flag for achievement_category (the table has `code`, not
-- `key`, and plan_id plus both line templates are NOT NULL, so core.list_items / core.list_save cannot serve it —
-- the categories editor is a dedicated per-plan editor on the plan-detail screen, using the existing
-- perf.category_save / perf.categories_remove); no Performance setting (none is defined for the group anywhere,
-- so there is no setting card to restore); no target removal (not an R32 control — a wrong target is corrected
-- by editing it).
-- Forward-only (V103). No pushed migration edited; no money touched; no ticket-system change.
create table perf.target (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references perf.plan (id),
  category_id uuid not null references perf.achievement_category (id),
  month date not null check (month = pg_catalog.date_trunc('month', month::timestamp)::date),
  target_count int not null default 0 check (target_count >= 0),
  target_value numeric(14,2) check (target_value is null or target_value >= 0),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index target_one_per_category_month on perf.target (plan_id, category_id, month) where deleted_at is null;
comment on table perf.target is
  'A plan''s target for one category in one month (FIX-23, §3.8): the count of achievements expected, and the deal-value total where the category carries one. Achieved is read, never stored.';
alter table perf.target enable row level security;
select audit.track('perf.target'::regclass);

-- A target's category is its plan's live one, and its month falls in its plan's year — at every door, not only the
-- save function (the category_guard pattern). Only the insert and a change of category, plan or month are checked:
-- retiring a category later must not break the targets already on it.
create function perf.target_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  yr int;
begin
  if tg_op = 'INSERT' or new.category_id is distinct from old.category_id
     or new.plan_id is distinct from old.plan_id or new.month is distinct from old.month then
    select p.year into yr from perf.plan p where p.id = new.plan_id and p.deleted_at is null;
    if yr is null or pg_catalog.date_part('year', new.month)::int <> yr then
      raise exception using errcode = 'P0001', message = 'target.invalid', detail = new.month::text;
    end if;
    if not exists (select 1 from perf.achievement_category c
                   where c.id = new.category_id and c.plan_id = new.plan_id and c.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'target.category_invalid';
    end if;
  end if;
  return new;
end
$$;
create trigger guard before insert or update on perf.target for each row execute function perf.target_guard();

-- One plan, the detail screen's read — the same row shape perf.plans answers, or null when there is no such plan or
-- the reader may not see its department.
create function perf.plan_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
begin
  return (
    select pg_catalog.jsonb_build_object(
      'id', p.id, 'department_id', p.department_id, 'year', p.year, 'name', p.name, 'status', p.status,
      'copied_from_plan_id', p.copied_from_plan_id, 'version', p.version,
      'categories', (select pg_catalog.count(*)::int from perf.achievement_category c
                     where c.plan_id = p.id and c.deleted_at is null))
    from perf.plan p
    where p.id = p_id and p.deleted_at is null and perf.sees_department(me, p.department_id));
end
$$;

-- A plan's targets, earliest month first, each with what it has achieved so far: the live, dated achievements of its
-- category whose day falls in the month (drafts never count, V68), and their deal-value total. A target's value is
-- only ever compared with deal values (V505: typed, never Finance money).
create function perf.targets(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
begin
  if p_plan is null or not exists (select 1 from perf.plan p where p.id = p_plan and p.deleted_at is null
                                   and perf.sees_department(me, p.department_id)) then
    return '[]'::jsonb;
  end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', t.id, 'plan_id', t.plan_id, 'category_id', t.category_id, 'category_code', c.code,
      'category_name_en', c.name_en, 'category_name_ar', c.name_ar, 'month', t.month,
      'target_count', t.target_count, 'target_value', t.target_value,
      'achieved_count', (select pg_catalog.count(*)::int from perf.achievement a
                         where a.plan_id = t.plan_id and a.category_id = t.category_id and a.deleted_at is null
                           and not a.draft and a.happened_on >= t.month
                           and a.happened_on < (t.month + pg_catalog.make_interval(months => 1))::date),
      'achieved_value', (select coalesce(pg_catalog.sum(a.deal_value), 0) from perf.achievement a
                         where a.plan_id = t.plan_id and a.category_id = t.category_id and a.deleted_at is null
                           and not a.draft and a.happened_on >= t.month
                           and a.happened_on < (t.month + pg_catalog.make_interval(months => 1))::date),
      'version', t.version)
      order by t.month, c.sort, c.code)
    from perf.target t
    join perf.achievement_category c on c.id = t.category_id
    where t.plan_id = p_plan and t.deleted_at is null), '[]'::jsonb);
end
$$;

-- Adds or changes a target (admins, Settings → Targets): its category (a live category of the plan), its month (the
-- first of a month in the plan's year), the count expected, and the deal-value total where the category carries one.
-- The shape is perf.category_save's: only the fields sent are written, the version is checked per field changed.
create function perf.target_save(p_id uuid, p_plan uuid, p_values jsonb, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  t perf.target;
  pl perf.plan;
  cat perf.achievement_category;
  m date;
  cnt int;
  val numeric(14,2);
  req uuid;
  tid uuid;
  what text;
  allowed text[] := array['category', 'month', 'target_count', 'target_value'];
begin
  if exists (select 1 from pg_catalog.jsonb_object_keys(v) k where k <> all (allowed)) then
    raise exception using errcode = 'P0001', message = 'common.field_unknown',
      detail = (select pg_catalog.string_agg(k, ', ') from pg_catalog.jsonb_object_keys(v) k where k <> all (allowed));
  end if;
  if p_id is not null then
    select * into t from perf.target x where x.id = p_id and x.deleted_at is null;
    if t.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform core.check_version('perf.target', p_id, p_version,
      array(select case k when 'category' then 'category_id' else k end
            from pg_catalog.jsonb_object_keys(v) k));
    select * into pl from perf.plan p where p.id = t.plan_id;
  elsif p_plan is null or not exists (select 1 from perf.plan p where p.id = p_plan and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  else
    select * into pl from perf.plan p where p.id = p_plan;
  end if;
  if v ? 'category' then
    if (v ->> 'category') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = 'P0001', message = 'target.category_invalid';
    end if;
    select * into cat from perf.achievement_category x
    where x.id = (v ->> 'category')::uuid and x.deleted_at is null;
    if cat.id is null or cat.plan_id is distinct from pl.id then
      raise exception using errcode = 'P0001', message = 'target.category_invalid';
    end if;
    if not cat.active then
      raise exception using errcode = 'P0001', message = 'achievement.category_retired', detail = cat.code;
    end if;
  elsif p_id is null then
    raise exception using errcode = 'P0001', message = 'target.invalid', detail = 'category';
  else
    cat := (select c from perf.achievement_category c where c.id = t.category_id);
  end if;
  if v ? 'month' then
    if (v ->> 'month') !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$' then
      raise exception using errcode = 'P0001', message = 'target.invalid', detail = v ->> 'month';
    end if;
    m := (v ->> 'month')::date;
    if pg_catalog.date_part('year', m)::int <> pl.year then
      raise exception using errcode = 'P0001', message = 'target.invalid', detail = v ->> 'month';
    end if;
  elsif p_id is null then
    raise exception using errcode = 'P0001', message = 'target.invalid', detail = 'month';
  else
    m := t.month;
  end if;
  if v ? 'target_count' then
    if (v ->> 'target_count') !~ '^[0-9]+$' then
      raise exception using errcode = 'P0001', message = 'target.invalid', detail = v ->> 'target_count';
    end if;
    cnt := (v ->> 'target_count')::int;
  else
    cnt := coalesce(t.target_count, 0);
  end if;
  if v ? 'target_value' then
    if nullif(pg_catalog.btrim(v ->> 'target_value'), '') is null then
      val := null;
    elsif (v ->> 'target_value') !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception using errcode = 'P0001', message = 'target.invalid', detail = v ->> 'target_value';
    else
      val := (v ->> 'target_value')::numeric(14,2);
    end if;
  else
    val := t.target_value;
  end if;
  if val is not null and not cat.has_deal_value then
    raise exception using errcode = 'P0001', message = 'achievement.no_deal_value', detail = cat.code;
  end if;
  req := audit.begin('ui', case when p_id is null then 'target.added' else 'target.changed' end,
                     pg_catalog.jsonb_build_object('category', cat.code, 'month', m));
  begin
    if p_id is null then
      insert into perf.target (plan_id, category_id, month, target_count, target_value)
      values (pl.id, cat.id, m, cnt, val)
      returning id into tid;
    else
      update perf.target x set
        category_id = case when v ? 'category' then cat.id else x.category_id end,
        month = case when v ? 'month' then m else x.month end,
        target_count = case when v ? 'target_count' then cnt else x.target_count end,
        target_value = case when v ? 'target_value' then val else x.target_value end
      where x.id = p_id;
      tid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'target.taken',
        detail = (select x.id::text from perf.target x
                  where x.plan_id = pl.id and x.category_id = cat.id and x.month = m and x.deleted_at is null);
    when check_violation or not_null_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = 'target.invalid', detail = coalesce(what, '');
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', tid, 'version',
    (select x.version from perf.target x where x.id = tid), 'request_id', req);
end
$$;

-- "Used in" for a category (the list-editor control): how many live records use it, and where — every live row of
-- every table that refers to it, the core.list_uses shape ({total, uses: [{table, column, count}]}). For a category
-- that is its achievements and its sub-categories.
create function perf.category_usage(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
begin
  if not exists (select 1 from perf.achievement_category c where c.id = p_id and c.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return core.list_uses('perf.achievement_category', p_id);
end
$$;

-- Retire a category by replacing it (the list_retire shape, scoped to categories): every live achievement on it
-- moves to a same-plan active category, and the category is archived — one request, with the count, and one Undo. A
-- category with live sub-categories is refused, the same rule categories_remove applies (its tree is never rewritten
-- by a retire); a deal value stays where values are typed, so a replacement that carries none is refused.
create function perf.category_retire(p_id uuid, p_replacement uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  why text := core.access_reason(p_reason);
  c perf.achievement_category;
  rep perf.achievement_category;
  moved bigint;
  req uuid;
begin
  select * into c from perf.achievement_category x where x.id = p_id and x.deleted_at is null;
  if c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into rep from perf.achievement_category x where x.id = p_replacement and x.deleted_at is null;
  if rep.id is null or not rep.active or rep.plan_id is distinct from c.plan_id or rep.id = c.id
     or rep.parent_id = c.id then
    raise exception using errcode = 'P0001', message = 'list.replacement_invalid';
  end if;
  if exists (select 1 from perf.achievement_category s where s.parent_id = c.id and s.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'list.in_use',
      detail = (select pg_catalog.string_agg(s.code, ', ') from perf.achievement_category s
                where s.parent_id = c.id and s.deleted_at is null);
  end if;
  if exists (select 1 from perf.achievement a where a.category_id = c.id and a.deleted_at is null
             and a.deal_value is not null) and not rep.has_deal_value then
    raise exception using errcode = 'P0001', message = 'achievement_category.deal_values_held';
  end if;
  req := audit.begin('ui', 'achievement_category.retired', pg_catalog.jsonb_build_object('code', c.code), why);
  update perf.achievement a set category_id = p_replacement where a.category_id = p_id and a.deleted_at is null;
  get diagnostics moved = row_count;
  perform audit.write_fields('perf.achievement_category', p_id, '{"active": false}');
  perform audit.end();
  return pg_catalog.jsonb_build_object('moved', moved, 'request_id', req);
end
$$;

-- The Data API's door to the new reads and writes (V124: security-invoker wrappers over the definer functions).
create function api.plan(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.plan_get(p_id) $$;
create function api.targets(p_plan uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.targets(p_plan) $$;
create function api.target_save(p_id uuid, p_plan uuid, p_values jsonb, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.target_save(p_id, p_plan, p_values, p_version) $$;
create function api.achievement_category_usage(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.category_usage(p_id) $$;
create function api.achievement_category_retire(p_id uuid, p_replacement uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.category_retire(p_id, p_replacement, p_reason) $$;
grant execute on function
  perf.plan_get(uuid), perf.targets(uuid), perf.target_save(uuid, uuid, jsonb, int),
  perf.category_usage(uuid), perf.category_retire(uuid, uuid, text)
  to authenticated;
grant execute on function
  api.plan(uuid), api.targets(uuid), api.target_save(uuid, uuid, jsonb, int),
  api.achievement_category_usage(uuid), api.achievement_category_retire(uuid, uuid, text)
  to authenticated;

select core.index_foreign_keys('perf');
