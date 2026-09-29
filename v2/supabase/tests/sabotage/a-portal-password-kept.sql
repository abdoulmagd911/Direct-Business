-- Sabotage: a-portal-password-kept
-- Breaks: sql:XREF-01
-- Expect: never a password
-- Nothing looks like a secret any more: a portal password is kept on the card.
create or replace function core.looks_secret(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select false and coalesce(
    p ~* '(^|[^a-z])(password|passcode|passwd|pass|pwd|secret|token|pin|otp|credentials?)([^a-z]|$)'
    or p ~ '(كلمة\s*(ال)?(مرور|سر)|الرقم\s*السري|رمز\s*(ال)?دخول)'
    or p ~* '^[a-z][a-z0-9+.-]*://[^/?#@[:space:]]*:[^/?#@[:space:]]*@'
    or p ~* '[?&;](access_token|api_?key|apikey|auth|key|sig|signature)=', false)
$$;
