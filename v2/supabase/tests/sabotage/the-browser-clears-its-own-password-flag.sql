-- Sabotage: the-browser-clears-its-own-password-flag
-- Breaks: sql:SIGN-10
-- Expect: the browser cannot record the change itself
-- The browser's session may record its own password change: a person clears "must change password" without changing it.
grant execute on function core.password_changed(uuid), api.password_changed(uuid) to authenticated;
