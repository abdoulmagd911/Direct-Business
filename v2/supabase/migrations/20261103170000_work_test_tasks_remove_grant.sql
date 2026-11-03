-- Rocky, 3 Nov 2026: the missing grant behind the second delete-control failure.
-- api.test_tasks_remove is a security-invoker wrapper (the same shape as every sibling,
-- e.g. api.tasks_remove), so the caller also needs EXECUTE on work.test_tasks_remove
-- itself — the convention the 2 Oct 2026 grants list follows for work.tasks_remove.
-- The 3 Nov remove migration granted only the api wrapper, so every caller got
-- Postgres 42501 "permission denied for function work.test_tasks_remove", which the
-- app shows as "You do not have access to do this". Reads were fine and every other
-- write was fine because those functions are granted; only this removal path was not.
-- Forward-only fix: this new migration adds the grant; the pushed migration is untouched.
grant execute on function work.test_tasks_remove(uuid[], text) to authenticated;
