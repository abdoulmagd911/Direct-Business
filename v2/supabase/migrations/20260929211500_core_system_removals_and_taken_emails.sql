-- Two production findings of 29 Sep (the oversight's walk of the live site, 23:57 Riyadh), V177 and V178.

-- ================================================================ W10: what the system removed is not restored (V177)
-- Activity → Recently deleted listed rows a migration or the registry sync had removed — V97's Settings levels of
-- non-admin roles, V155's replaced setting defaults, V176's retired grants — each with Restore. A removal made by the
-- system or a job is part of how the app is built, not a person's action: it is not listed, and not restored (undo
-- already refuses a system or job request, undo.not_undoable). The last removal of a row decides: a row a person
-- restored and removed again is theirs.
create function core.removed_by_system(p_table text, p_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select r.kind in ('system', 'job')
                   from audit.change c join audit.request r on r.id = c.request_id
                   where c.table_name = p_table and c.row_id = p_id and c.action = 'remove'
                   order by c.id desc limit 1), true)
$$;
revoke all on function core.removed_by_system(text, uuid) from public;

-- core.recently_deleted as P3-6e wrote it, without what the system removed.
create or replace function core.recently_deleted(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  e core.entity;
  label text;
  label_ar text;
  part jsonb;
  acc jsonb := '[]';
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  for e in
    select x.* from core.entity x
    where x.active and exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(x.table_name)
                                 and a.attname = 'deleted_at' and not a.attisdropped)
    order by x.key
  loop
    select pg_catalog.format('t.%I::text', a.attname) into label
    from pg_catalog.unnest(array['trade_name_en', 'title', 'name_en', 'full_name_en', 'original_name', 'key', 'value_raw',
                                 'body', 'email', 'ref']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    select pg_catalog.format('t.%I::text', a.attname) into label_ar
    from pg_catalog.unnest(array['trade_name_ar', 'name_ar', 'full_name_ar']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(''entity'', $1, ''id'', t.id, ''label'', %s,'
      || ' ''label_ar'', coalesce(%s, %s), ''deleted_at'', t.deleted_at, ''deleted_by'', t.deleted_by,'
      || ' ''reason'', t.delete_reason)), ''[]''::jsonb)'
      || ' from %s t where t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)'
      || ' and authz.can_see_as($3, $4, t.id) and not core.removed_by_system($4, t.id)',
      coalesce(label, 'null::text'), coalesce(label_ar, 'null::text'), coalesce(label, 'null::text'),
      pg_catalog.to_regclass(e.table_name))
      into part using e.key, days, me, e.table_name;
    acc := acc || part;
  end loop;
  return coalesce((select pg_catalog.jsonb_agg(x order by (x ->> 'deleted_at')::timestamptz desc)
                   from (select x from pg_catalog.jsonb_array_elements(acc) x
                         order by (x ->> 'deleted_at')::timestamptz desc
                         limit greatest(1, least(coalesce(p_limit, 100), 500))) y(x)), '[]'::jsonb);
end
$$;

-- core.restore_needs as P3-6e wrote it (restore_ticketed asks it of every restore), refusing what the system removed.
create or replace function core.restore_needs(p_table text, p_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  i record;
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if core.removed_by_system(p_table, p_id) then
    raise exception using errcode = 'P0001', message = 'restore.system_removal';
  end if;
  if p_table = 'partner.identifier' then
    select x.partner_id, x.kind into i from partner.identifier x where x.id = p_id;
    perform partner.require_cap(i.partner_id,
                                case when i.kind in ('payments_client_id', 'discount_code') then 'client' end, 'identify');
  elsif p_table = 'partner.side_owner' then
    select x.side into i from partner.side_owner x where x.id = p_id;
    perform authz.require_capability(partner.side_page(i.side) || '.assign');
  elsif p_table = 'partner.credit_limit' then
    perform authz.require_capability('finance.credit_control');
  end if;
end
$$;

-- ================================================================ W24: an e-mail already held is named (V178)
-- Adding a person with an e-mail another person holds — whatever its capitals or spaces — is refused with the holder's
-- name (people.email_taken), and nothing is saved: api.person_create adds the person and the e-mail in one request
-- (ACC-093), so the refusal takes the person back too. core.person_email_add as P3-2 wrote it, with that answer.
create or replace function core.person_email_add(p_person uuid, p_email text, p_primary boolean default false,
                                      p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
  e core.person_email;
  holder text;
begin
  perform authz.require_admin();
  req := audit.begin('ui', 'person_email.added', pg_catalog.jsonb_build_object('email', p_email), p_reason);
  select p.full_name_en into holder from core.person_email x join core.person p on p.id = x.person_id
  where x.email operator(extensions.=) pg_catalog.btrim(p_email)::extensions.citext and x.deleted_at is null;
  if holder is not null then
    raise exception using errcode = '23505', message = 'people.email_taken', detail = holder;
  end if;
  if p_primary then
    update core.person_email set is_primary = false where person_id = p_person and is_primary and deleted_at is null;
  end if;
  insert into core.person_email (person_id, email, is_primary)
  values (p_person, lower(pg_catalog.btrim(p_email)),
          p_primary or not exists (select 1 from core.person_email x where x.person_id = p_person and x.deleted_at is null))
  returning * into e;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', e.id, 'version', e.version, 'request_id', req);
end
$$;
