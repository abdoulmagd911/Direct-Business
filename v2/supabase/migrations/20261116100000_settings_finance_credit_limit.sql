-- Landing 31 — the credit limit in Settings → Finance (the owner's decision of 16 Nov 2026; boards fin2-credit-*).
-- One figure for the whole of Direct: the credit limit of every postpaid client whose record sets none of its own
-- (an organisation's own limit stays partner.credit_limit, api.credit_limit_set — untouched here). It is a setting
-- like any other (core.setting_def 'finance.credit_limit', group settings.finance, whole riyals, default 1,250,000 as
-- the boards draw it), so its changes are rows of core.setting, logged like every setting change.
--
-- Who: every signed-in person READS it; a manager, a head of department and an admin CHANGE it; a team member and a
-- viewer are refused. Settings pages themselves stay admins-only (V97 — authz.level_of, core.settings and
-- core.setting_set are not touched): this is one door of its own for the one figure, as the no-supplier-cost door is
-- (QA-534). The rule is the role itself, not a level on a Settings page — nobody but an admin can hold one.
-- Forward-only (V103).

-- ================================================================ the definition and its default
-- Written as `pnpm registry:sync` writes them (src/modules/settings/module.ts, supabase/registry.json — REG-01):
-- the definition becomes the registry's; the default is a company-wide row from the floor date, written once.
select audit.begin('system', 'registry.synced');

insert into core.setting_def (key, group_page, schema, default_value, effective_dated, label_key, active) values
  ('finance.credit_limit', 'settings.finance',
   '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"integer","minimum":1,"maximum":1000000000}'::jsonb,
   '1250000'::jsonb, false, 'setting.finance.credit_limit', true)
on conflict (key) do update set group_page = excluded.group_page, schema = excluded.schema,
  default_value = excluded.default_value, effective_dated = excluded.effective_dated,
  label_key = excluded.label_key, active = true;

select core.setting_defaults_sync('[{"key":"finance.credit_limit","value":1250000}]'::jsonb);

select audit.end();

-- ================================================================ who may change it
-- A manager, a head of department or an admin who works here and can sign in — the role, nothing else.
create function finance.credit_limit_can_change(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from core.person p join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
      and (r.is_admin or r.key in ('head', 'manager')))
$$;
comment on function finance.credit_limit_can_change(uuid) is 'Landing 31: whether a person may change the credit limit of Settings → Finance — a manager, a head of department or an admin.';

-- ================================================================ the read: everyone signed in
create function finance.credit_limit() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  s core.setting;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into s from core.setting x
  where x.key = 'finance.credit_limit' and x.department_id is null and x.valid_from <= core.riyadh_today()
    and x.deleted_at is null
  order by x.valid_from desc limit 1;
  return pg_catalog.jsonb_build_object(
    'amount', (core.setting_at('finance.credit_limit', null, core.riyadh_today()) #>> '{}')::bigint,
    'can_edit', finance.credit_limit_can_change(me),
    'is_default', coalesce(s.reason = 'default', true),
    'set_at', case when s.reason is distinct from 'default' then s.created_at end);
end
$$;
comment on function finance.credit_limit() is 'Landing 31: the credit limit in force today (whole riyals), whether the reader may change it, and when it was last set — for every signed-in person.';

-- ================================================================ the write: a manager, a head of department, an admin
-- A whole positive amount and a reason. Like core.setting_set: a change on a day that already has a row replaces it in
-- the same request; a row is never changed in place (SET-02). Logged as a setting change.
create function finance.credit_limit_set(p_amount numeric, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  d core.setting_def;
  why text;
  day date := core.riyadh_today();
  v jsonb;
  bad text;
  req uuid;
  s core.setting;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if not finance.credit_limit_can_change(me) then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'finance.credit_limit';
  end if;
  select * into d from core.setting_def where key = 'finance.credit_limit' and active;
  if d.id is null then
    raise exception using errcode = 'P0002', message = 'setting.unknown_key', detail = 'finance.credit_limit';
  end if;
  why := core.access_reason(p_reason);
  if p_amount is null or p_amount <> pg_catalog.trunc(p_amount) then
    raise exception using errcode = 'P0001', message = 'setting.invalid_value', detail = '$: a whole amount';
  end if;
  v := pg_catalog.to_jsonb(p_amount::bigint);
  bad := core.json_check(d.schema, v);
  if bad is not null then
    raise exception using errcode = 'P0001', message = 'setting.invalid_value', detail = bad;
  end if;
  req := audit.begin('ui', 'setting.changed', pg_catalog.jsonb_build_object('key', d.key), why);
  update core.setting set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
  where key = d.key and department_id is null and valid_from = day and deleted_at is null;
  insert into core.setting (key, department_id, value, valid_from, reason)
  values (d.key, null, v, day, why)
  returning * into s;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', s.id, 'amount', p_amount::bigint, 'valid_from', s.valid_from,
                                       'request_id', req);
end
$$;
comment on function finance.credit_limit_set(numeric, text) is 'Landing 31: a manager, a head of department or an admin changes the credit limit of Settings → Finance — a whole positive amount, with a reason, logged as a setting change.';

-- ================================================================ the door (V124)
create function api.finance_credit_limit() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.credit_limit() $$;

create function api.finance_credit_limit_set(p_amount numeric, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.credit_limit_set(p_amount, p_reason) $$;

revoke all on function finance.credit_limit_can_change(uuid) from public;
revoke all on function finance.credit_limit() from public;
revoke all on function finance.credit_limit_set(numeric, text) from public;
revoke all on function api.finance_credit_limit() from public;
revoke all on function api.finance_credit_limit_set(numeric, text) from public;
grant execute on function finance.credit_limit(), finance.credit_limit_set(numeric, text) to authenticated;
grant execute on function api.finance_credit_limit(), api.finance_credit_limit_set(numeric, text) to authenticated;
