-- Landing 52 (F1 live re-test of 25 Nov, FIX-11): a Team member opened Recently deleted and read 187 removals —
-- the Admin's, the Head's, the Manager's, each with its name and reason, many with Restore. The list asked one
-- question only: "could this person read the record while it was live?" (core.deleted_visible). A member can read
-- most of the team's tasks, so a member read most of the team's removals.
--
-- The owner's rule (25 Nov): a member sees only what they deleted themselves. Built on a page level, not on a role's
-- name (roles are renamed and their levels changed in the browser): **what other people removed is for those who
-- may open Activity** — Activity · View or above: the admin, a head and a manager as the roles are seeded, or
-- whoever an admin gives that page to. Everyone else — a Team member, a Viewer as seeded — is listed **only what
-- they removed themselves**. Nothing else moves:
-- the could-read-it-live check still applies to every row (so a head still never reads a removal they could not
-- have opened, and a private note stays its author's), the window, the system's own removals, the names, the
-- can_restore answer and the newest-first order are as 20261113180000 left them, and the function is that one word
-- for word but for `sees_others` and the one line that uses it in step 1. The level is the person's own page level
-- (authz.level_of), so a sign-in switched to a test user is answered as that test user. core.restore_ticketed is
-- not touched: what a person may restore is decided there as before. Grants unchanged (create or replace keeps
-- them); no signature change. Forward-only (V103).
create or replace function core.recently_deleted(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  lim int := greatest(1, least(coalesce(p_limit, 100), 500));
  sees_others boolean;
  e core.entity;
  label text;
  label_ar text;
  part jsonb;
  seen jsonb := '[]';
  keep jsonb := '[]';
  kept int := 0;
  acc jsonb := '[]';
  cand record;
  r record;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- what other people removed is listed only to those who may open Activity; everyone else, their own removals
  sees_others := coalesce(authz.level_of(me, 'activity') >= 'view', false);
  -- 1. only the tables with a removal logged in the window (a day's margin either side of the test clock), each with
  --    its ids; of those rows, the ones still removed in the window and not removed by the system: table, id, time
  --    — and, for someone without Activity, only the rows they removed themselves
  for cand in
    select x.id as ent_id, pg_catalog.array_agg(distinct c.row_id) as row_ids
    from audit.change c
    join core.entity x on x.table_name = c.table_name and x.active
    where c.action = 'remove'
      and c.at > least(core.clock(), pg_catalog.now()) - pg_catalog.make_interval(days => days + 1)
      and exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(x.table_name)
                    and a.attname = 'deleted_at' and not a.attisdropped)
    group by x.id, x.key
    order by x.key
  loop
    select * into e from core.entity x where x.id = cand.ent_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(''e'', $1, ''t'', $4, ''id'', t.id,'
      || ' ''at'', t.deleted_at)), ''[]''::jsonb) from %s t'
      || ' where t.id = any ($5) and t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)'
      || ' and not core.removed_by_system($4, t.id) and ($6 or t.deleted_by = $3)',
      pg_catalog.to_regclass(e.table_name))
      into part using e.id, days, me, e.table_name, cand.row_ids, sees_others;
    seen := seen || part;
  end loop;
  -- 2. newest first, the ones this person may see, until the page is full
  for r in
    select x from pg_catalog.jsonb_array_elements(seen) x order by (x ->> 'at')::timestamptz desc
  loop
    exit when kept >= lim;
    if core.deleted_visible(r.x ->> 't', (r.x ->> 'id')::uuid, me) then
      keep := keep || pg_catalog.jsonb_build_array(r.x);
      kept := kept + 1;
    end if;
  end loop;
  -- 3. only for those: the name (the first name column the table has) and whether it can be restored
  for cand in
    select (k ->> 'e')::uuid as ent_id, pg_catalog.array_agg((k ->> 'id')::uuid) as row_ids
    from pg_catalog.jsonb_array_elements(keep) k
    group by (k ->> 'e')::uuid
  loop
    select * into e from core.entity x where x.id = cand.ent_id;
    select pg_catalog.format('t.%I::text', a.attname) into label
    from pg_catalog.unnest(array['trade_name_en', 'title', 'name_en', 'full_name_en', 'original_name', 'key', 'value_raw',
                                 'body', 'email', 'ref', 'text', 'name']) with ordinality w(col, o)
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
      || ' ''reason'', t.delete_reason, ''can_restore'', z.refused is null,'
      || ' ''restore_blocked'', z.refused ->> ''reason'')), ''[]''::jsonb)'
      || ' from %s t cross join lateral (select core.restore_refusal($4, t.id, t.deleted_by) as refused) z'
      || ' where t.id = any ($5)',
      coalesce(label, 'null::text'), coalesce(label_ar, 'null::text'), coalesce(label, 'null::text'),
      pg_catalog.to_regclass(e.table_name))
      into part using e.key, days, me, e.table_name, cand.row_ids;
    acc := acc || part;
  end loop;
  return coalesce((select pg_catalog.jsonb_agg(x order by (x ->> 'deleted_at')::timestamptz desc)
                   from (select x from pg_catalog.jsonb_array_elements(acc) x
                         order by (x ->> 'deleted_at')::timestamptz desc
                         limit lim) y(x)), '[]'::jsonb);
end
$$;
