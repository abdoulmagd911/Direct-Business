-- SEC-02 — a security-definer function runs past row-level security, so every one a request role may execute must
-- itself ask who is calling (A6, §5; the owner's rule of 29 Sep: prove it by calling each one, not by reading its
-- code). Each is called with empty arguments, twice. A sign-in with no person behind it must be refused, or answered
-- nothing (null, false, none, an empty list); a viewer may read, but neither call may change any table. Sign-in
-- itself serves a sign-in before it has a person; me and the device heartbeat answer a sign-in about itself; signing
-- one's own devices out acts on oneself alone — each named below with its reason.
-- Sabotage: supabase/tests/sabotage/a-definer-function-that-asks-nobody.sql.
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.viewer')::uuid)::text, true);
select set_config('t.sid', test.start_session(current_setting('t.uid')::uuid)::text, true);
do $$
declare
  f record;
  who text;
  got text;
  raised boolean;
  before text;
  after text;
  n int := 0;
  bad text[] := '{}';
  -- sign-in runs before the sign-in has a person: it checks the e-mail, logs the attempt, and makes the device; me
  -- and the heartbeat tell a sign-in its own status (not listed, signed out) and nothing else
  sign_in_doors text[] := array['core.sign_in_check(p_email text, p_user_agent text)',
    'core.sign_in_event(p_email text, p_result text, p_detail text, p_user_agent text, p_device uuid)',
    'core.sign_in_complete(p_provider text, p_device_label text)', 'core.me()', 'core.device_touch()', 'authz.me()'];
  -- signing one's own devices out acts on the caller alone (SIGN-08, SIGN-09); calling it would end the viewer's
  -- session and blunt every call after it
  own_sign_out text[] := array['core.device_sign_out(p_device uuid)', 'core.device_sign_out_others()'];
begin
  for f in
    select format('%s.%s(%s)', ns.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as name,
           format(case when p.proretset then 'select count(*)::text from %I.%I(%s)' else 'select %I.%I(%s)::text' end,
                  ns.nspname, p.proname,
                  coalesce((select string_agg(format('null::%s', format_type(t, null)), ', ' order by i)
                            from unnest(p.proargtypes::oid[]) with ordinality a(t, i)), '')) as sql
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = any (test.v2_schemas()) and p.prosecdef and p.prokind = 'f'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
    order by 1
  loop
    n := n + 1;
    continue when f.name = any (sign_in_doors || own_sign_out);
    foreach who in array array['nobody', 'viewer'] loop
      select format('%s|%s|%s|%s|%s|%s', (select max(id) from audit.change), (select count(*) from notify.notification),
                    (select count(*) from notify.notification where read_at is not null), (select count(*) from notify.follow),
                    (select count(*) from core.person_last_seen), (select count(*) from core.sign_in_log)) into before;
      if who = 'nobody' then
        perform test.as_auth(gen_random_uuid());
      else
        perform test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
      end if;
      raised := false;
      got := null;
      begin
        execute f.sql into got;
      exception when others then
        raised := true;
      end;
      perform test.as_owner();
      select format('%s|%s|%s|%s|%s|%s', (select max(id) from audit.change), (select count(*) from notify.notification),
                    (select count(*) from notify.notification where read_at is not null), (select count(*) from notify.follow),
                    (select count(*) from core.person_last_seen), (select count(*) from core.sign_in_log)) into after;
      if before is distinct from after then
        bad := bad || format('%s — a %s changed something', f.name, who);
      elsif who = 'nobody' and not raised and coalesce(got, '') not in ('', 'false', 'none', '0', '[]', '{}') then
        bad := bad || format('%s — a %s was answered: %s', f.name, who, left(got, 60));
      end if;
    end loop;
  end loop;
  perform test.ok(n >= 20, format('found only %s callable definer functions — the test would prove nothing', n));
  perform test.ok(cardinality(bad) = 0,
    format(E'callable definer functions that do not ask who is calling:\n    %s', array_to_string(bad, E'\n    ')));
end $$;
