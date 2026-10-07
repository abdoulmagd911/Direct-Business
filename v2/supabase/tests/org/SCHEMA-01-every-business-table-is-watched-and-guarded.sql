-- SCHEMA-01 — every business table of v2 has row-level security on, the stamp and capture triggers (so every change
-- is logged and undoable), an id and a version; only the change log itself, the sign-in log, the device sessions, the
-- number counter and a person's own bookkeeping (notifications, follows, last seen, default views — P3-6) are exempt
-- (A1, A6, A14, §3.3), and even they keep row-level security on.
-- Sabotage: supabase/tests/sabotage/an-unwatched-table.sql.
do $$
declare
  missing text;
begin
  select string_agg(format('%s.%s: %s', n.nspname, c.relname, concat_ws(', ',
      case when not c.relrowsecurity then 'row-level security off' end,
      case when not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'stamp'
             and t.tgfoid = 'audit.stamp'::regproc) then 'no stamp trigger' end,
      case when not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'capture'
             and t.tgfoid = 'audit.capture'::regproc) then 'no capture trigger' end,
      case when not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'id'
             and a.atttypid = 'uuid'::regtype) then 'no uuid id' end,
      case when not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'version') then 'no version' end)),
    E'\n    ')
  into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and n.nspname = any (test.v2_schemas())
    and format('%s.%s', n.nspname, c.relname) not in ('audit.request', 'audit.change', 'core.counter', 'core.sign_in_log',
      'core.device_session', 'notify.notification', 'notify.follow', 'core.person_last_seen', 'core.person_default_view',
      'core.auth_ticket',   -- one-time tickets of the admin routes (V162): used once, never changed by a person
      'finance.import_batch', 'finance.import_held')   -- what an import did (§3.11): written once by the import, never changed
    and (not c.relrowsecurity
      or not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'stamp' and t.tgfoid = 'audit.stamp'::regproc)
      or not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'capture' and t.tgfoid = 'audit.capture'::regproc)
      or not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'id' and a.atttypid = 'uuid'::regtype)
      or not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'version'));
  perform test.ok(missing is null, format(E'tables not watched or guarded:\n    %s', missing));
  select string_agg(format('%s.%s', n.nspname, c.relname), ', ' order by 1) into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and n.nspname = any (test.v2_schemas()) and not c.relrowsecurity;
  perform test.ok(missing is null, format('tables with row-level security off: %s', missing));
  perform test.ok((select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
                   join pg_namespace n on n.oid = c.relnamespace
                   where t.tgname = 'capture' and n.nspname = any (test.v2_schemas())) >= 17,
    'the organisation tables are all watched (the test found its tables)');
end $$;
