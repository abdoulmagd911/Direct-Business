-- Landing 31 — five themes: Light, Dark, Direct, Turquoise (opt-in) and System (follows the device).
-- core.person_profile.theme was checked against ('light', 'dark', 'colorful', 'direct'); a person could not
-- save Turquoise or System. The check is replaced by one that also allows the two new names. 'colorful'
-- stays allowed: no stored value is rewritten (a profile saved while Colorful was offered still reads as
-- Light in the app, V636). The admin's default (app.default_theme) is unchanged: Turquoise is opt-in and
-- never a default.
-- The inline check of 20260929000100_core_people_audit.sql:236 carries the name Postgres gave it; it is
-- found by its definition rather than by a guessed name, then dropped and replaced.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class cl on cl.oid = con.conrelid
    join pg_catalog.pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'core' and cl.relname = 'person_profile' and con.contype = 'c'
      and pg_catalog.pg_get_constraintdef(con.oid) like '%theme%'
  loop
    execute pg_catalog.format('alter table core.person_profile drop constraint %I', c.conname);
  end loop;
end $$;
alter table core.person_profile add constraint person_profile_theme_check
  check (theme in ('light', 'dark', 'direct', 'turquoise', 'system', 'colorful'));
