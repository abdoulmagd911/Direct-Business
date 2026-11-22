-- Landing 29 — finance.payments_as_of runs with JIT off.
-- The Finance Overview and a partner's Finance tab ask for the payments as-of day beside the money reads. It was the
-- one read on that path left without jit = off (Landing 27 set the other six — JIT-04; Landing 25 the company-tab
-- three — JIT-03). Config only: no body, signature, grant or type changes. A later CREATE OR REPLACE of this function
-- silently drops the setting, so a redefinition must re-apply it in the same file (JIT-04 pins it).
alter function finance.payments_as_of() set jit = off;
