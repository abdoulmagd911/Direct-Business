-- Sabotage: agreements-uploaded-as-normal
-- Breaks: sql:SIDE-02
-- Expect: an agreement is restricted whatever the upload asks
-- An agreement keeps whatever sensitivity its upload asked for (D10 says restricted).
create or replace function core.file_restricted_kind() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin return new; end $$;
create or replace function core.file_link_restricted() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin return new; end $$;
