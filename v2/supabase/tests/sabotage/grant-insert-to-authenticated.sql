-- Sabotage: grant-insert-to-authenticated
-- Breaks: sql:WRITE-01
-- Expect: insert into core.counter
-- A table becomes directly writable by signed-in people (A6).
grant insert on core.counter to authenticated;
