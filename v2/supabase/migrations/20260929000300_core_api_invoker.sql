-- v2: the one door holds no security-definer function (V124). Supabase's advisor (0029) and its agent guidance (V112)
-- keep a SECURITY DEFINER function out of every schema the Data API exposes; `api` is the only one (V84). So each api.*
-- definer function moves, unchanged, to `core` — which the Data API never exposes — keeping its body, its grants and
-- its "who is calling" check (SEC-02); and api.* becomes a security-invoker wrapper with the same name, arguments,
-- defaults and volatility, which is all a browser or the server can reach. API-01 keeps it so. Forward-only (V103).

alter function api.me() set schema core;
alter function api.sign_in_check(text, text) set schema core;
alter function api.sign_in_event(text, text, text, text, text) set schema core;
alter function api.sign_in_complete(text, text, text) set schema core;
alter function api.device_touch() set schema core;
alter function api.my_devices() set schema core;
alter function api.device_sign_out(uuid) set schema core;
alter function api.device_sign_out_others() set schema core;
alter function api.person_email_add(uuid, text, boolean, text) set schema core;
alter function api.person_auth_link(text, uuid) set schema core;
alter function api.person_email_remove(uuid, text) set schema core;
alter function api.person_sign_out(uuid, uuid) set schema core;
alter function api.person_devices(uuid) set schema core;
alter function api.person_auth_state(uuid) set schema core;
alter function api.auth_user_of(text) set schema core;

-- The server's secret key calls the pre-check, the event log, the reconciliation and the lookup through api.*; the
-- wrappers run as the service role, which now needs to reach their bodies in core.
grant usage on schema core to service_role;

-- ================================================================ the wrappers (security invoker)
create function api.me() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.me() $$;
comment on function api.me() is 'Who am I (A5): status, session, person, levels by page, capabilities, departments, profile.';

create function api.sign_in_check(p_email text, p_user_agent text default null) returns text
language sql volatile security invoker set search_path = ''
as $$ select core.sign_in_check(p_email, p_user_agent) $$;
comment on function api.sign_in_check(text, text) is 'Service role only: allowed / not_listed / switched_off, logged.';

create function api.sign_in_event(p_email text, p_result text, p_detail text default null, p_user_agent text default null,
                                  p_provider text default 'email') returns void
language sql volatile security invoker set search_path = ''
as $$ select core.sign_in_event(p_email, p_result, p_detail, p_user_agent, p_provider) $$;
comment on function api.sign_in_event(text, text, text, text, text) is 'Service role only: logs a refused step of the sign-in flow.';

create function api.sign_in_complete(p_provider text default 'email', p_device_label text default null,
                                     p_user_agent text default null) returns text
language sql volatile security invoker set search_path = ''
as $$ select core.sign_in_complete(p_provider, p_device_label, p_user_agent) $$;
comment on function api.sign_in_complete(text, text, text) is 'The signed-in person, after the code: ok (device registered) / not_listed / switched_off.';

create function api.device_touch() returns text
language sql volatile security invoker set search_path = ''
as $$ select core.device_touch() $$;

create function api.my_devices() returns table (id uuid, device_label text, signed_in_at timestamptz,
                                                last_seen_at timestamptz, this_device boolean)
language sql stable security invoker set search_path = ''
as $$ select * from core.my_devices() $$;

create function api.device_sign_out(p_device uuid default null) returns int
language sql volatile security invoker set search_path = ''
as $$ select core.device_sign_out(p_device) $$;

create function api.device_sign_out_others() returns int
language sql volatile security invoker set search_path = ''
as $$ select core.device_sign_out_others() $$;

create function api.person_email_add(p_person uuid, p_email text, p_primary boolean default false,
                                     p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_email_add(p_person, p_email, p_primary, p_reason) $$;

create function api.person_auth_link(p_email text, p_auth_user_id uuid) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_auth_link(p_email, p_auth_user_id) $$;

create function api.person_email_remove(p_id uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_email_remove(p_id, p_reason) $$;

create function api.person_sign_out(p_person uuid, p_device uuid default null) returns int
language sql volatile security invoker set search_path = ''
as $$ select core.person_sign_out(p_person, p_device) $$;

create function api.person_devices(p_person uuid) returns table (id uuid, device_label text, signed_in_at timestamptz,
                                                                 last_seen_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from core.person_devices(p_person) $$;

create function api.person_auth_state(p_person uuid) returns table (auth_user_id uuid, email text, allowed boolean)
language sql stable security invoker set search_path = ''
as $$ select * from core.person_auth_state(p_person) $$;

create function api.auth_user_of(p_email text) returns uuid
language sql stable security invoker set search_path = ''
as $$ select core.auth_user_of(p_email) $$;

-- ================================================================ grants
-- The same callers as before (P3-1, P3-2): each wrapper to the role its body was granted to. The bodies keep theirs.
grant execute on function api.me(), api.sign_in_complete(text, text, text), api.device_touch(), api.my_devices(),
  api.device_sign_out(uuid), api.device_sign_out_others(), api.person_email_add(uuid, text, boolean, text),
  api.person_auth_link(text, uuid), api.person_email_remove(uuid, text), api.person_sign_out(uuid, uuid),
  api.person_devices(uuid) to authenticated;
grant execute on function api.sign_in_check(text, text), api.sign_in_event(text, text, text, text, text),
  api.person_auth_state(uuid), api.auth_user_of(text) to service_role;
