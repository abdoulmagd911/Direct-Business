# Landing 43 — the checks try a stuck stack start once more (CI only)

23 Nov 2026 · base `f336af5a` (Landing 42) · target `v2/main` · one push.

## Why

Three runs lost a part of the browser-sabotage checks before any test ran: #1620 (part 3 of 5) and #1626 (part 1 of
5), and earlier ones in the same family. Each time the log says the same thing: the mail catcher's port `54324` was
already taken on GitHub's machine, so the test database stack did not start. Each costs a manual re-run and about an
hour and a half.

## The change

In `.github/workflows/v2.yml`, the two steps that start the full stack (the browser suite and the browser-sabotage
parts) now stop the stack, wait 15 seconds and try once more when the first start fails. A second failure fails the
job as before, so a real fault is never hidden. Nothing else changed: no product code, no migration, no test.

## Verification

- The workflow file reads as valid YAML; the 19 house checks are green.
- The retry itself is proven only on GitHub's machines: the port clash cannot be made to happen on demand.
