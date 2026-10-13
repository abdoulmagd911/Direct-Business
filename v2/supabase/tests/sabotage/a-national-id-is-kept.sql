-- Sabotage: a-national-id-is-kept
-- Breaks: sql:XREF-03
-- Expect: a national ID
-- A national ID or residence permit is kept like any other text (OLD-033, V428).
create or replace function core.looks_secret(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    p ~* '(^|[^a-z])(password|passcode|passwd|pass|pwd|secret|token|pin|otp|credentials?)([^a-z]|$)'
    or p ~ '(كلمة\s*(ال)?(مرور|سر)|الرقم\s*السري|رمز\s*(ال)?دخول)'
    or p ~* '^[a-z][a-z0-9+.-]*://[^/?#@[:space:]]*:[^/?#@[:space:]]*@'
    or p ~* '[?&;](access_token|api_?key|apikey|auth|key|sig|signature)='
    , false)
$$;
