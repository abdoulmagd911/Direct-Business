# v2 — go-live runbook

The ordered checklist for switching the Commercial Workspace on for real people. Every line names who does it, where,
how it is verified, and the decision it comes from. Nothing here holds a key, a password or a person's name (rule 7):
keys are pasted by the owner only (V84), people are added in the app (V440), and the list of people lives in the
owner's private knowledge base. Read `DECISIONS.md` for the rules and `BUILD-PLAN.md` P6-5 and P6-8 for the steps.

## 0. Before the runbook starts

| Check | Who | Where | Verified by | Rule |
|---|---|---|---|---|
| P6-5 Readiness is merged: full sabotage run, performance budget, advisors clean, grants snapshot, the restore drill | builder A | `v2/main` | the P6-5 PR's checks and its compare report | P6-5, V429 |
| The owner has given his go for go-live | owner | in words to the oversight | recorded in the go-live PR | owner decision 4, D9 |

## 1. Vercel — `direct-commercial`

| Check | Who | Where | Verified by | Rule |
|---|---|---|---|---|
| Root directory `v2`, framework Next.js, production branch `v2/main`, region fra1 | owner | Vercel → Settings | the settings page | V84, V432 |
| Production builds only (the Ignored Build Step cancels every non-production build) | owner | Vercel → Settings → Git | a push to a PR branch builds nothing | V432 |
| Env vars: the Supabase address and publishable key (public), the service key (server-side only) — pasted by the owner, never in the repo | owner | Vercel → Environment Variables | the sign-in page renders and `api.me()` answers | V84 |
| The domain: `www.directksab2b.com` on this project, the apex redirecting to www; the old project holds no domain | owner | Vercel → Domains | `curl -sI https://www.directksab2b.com/` answers 200 from this project; the apex answers a redirect | V13, V432 |
| The live site serves the merged commit: the build ID the app shows equals `v2/main`'s head | builder A | the page footer and `/api/build` | the commit hash matches | OA31, V427 |
| Vercel's settings are the owner's — nothing in the repo changes them | everyone | — | `v2/vercel.json` carries only the build command | V427 |

## 2. Supabase — `direct-commercial` (`kimadjvaxgiqzjaukuqg`, eu-central-1)

| Check | Who | Where | Verified by | Rule |
|---|---|---|---|---|
| Every migration applied at merge by the `db-production` job (never by a session); none edited after merge | the job; builder A watches it | the job's run on each v2/main merge (GitHub → Actions → v2) | its last step: "production and main agree" | V103, V181, §10 |
| The job's secret is set: `SUPABASE_DB_PASSWORD` (the project's database password; no access token is needed), in the environment `production`, deployment branches v2/main only | owner | GitHub → the repository → Settings → Environments → production | the job's first step passes | V181, QA-186 |
| In this order, once #135 has merged: (1) in the environment `production`, set Deployment branches to `v2/main` only and add the secret `SUPABASE_DB_PASSWORD`; (2) only then delete the repository-level `SUPABASE_DB_PASSWORD`. Deleting it first makes the next merge's job fail with "secret not set"; until it is deleted, a workflow on any branch can still read it | owner | GitHub → Settings → Environments → production, then Settings → Secrets and variables → Actions | the next merge's job passes its first step; the repository secrets list no longer shows it | QA-186 |
| Auth: sign-ups off; the email provider with password on; minimum password length 10 (`auth.password_min_length` and the project's own minimum); the code door off (`auth.code_door_enabled` false) | builder A (settings), owner (dashboard) | Supabase → Authentication; Settings → App in the app | a sign-up attempt is refused; a 9-character password is refused | V431 |
| Site URL and redirect URLs list `https://www.directksab2b.com` (and the bare domain) | owner | Supabase → Authentication → URL configuration | sign-in works through the domain | V13 |
| Google and Zoom providers: off until their keys exist | — | Supabase → Providers | no provider button on the page | V23 |
| Advisors (security and performance) find nothing at warning level | builder A | Supabase → Advisors, or the connector | the P6-5 PR's advisor output | V427, P6-5 |
| The outsider check: with the publishable key and no sign-in, every table and bucket answers nothing | builder A, then the QA session | `v2/supabase/tests/qa/` | 0 rows readable, 0 writes possible | OA30, V427 |
| Storage buckets `files` and `images` private; `pg_cron` on; the alerts job and the five-minute reminder job scheduled | builder A | Supabase → Storage, Cron | the jobs' last runs | V455, §3.3 |
| Backups: the paid plan's daily backups on; the mode confirmed; one restore drill done into a separate schema, compared, nothing applied to live tables | owner (plan), builder A (drill) | Supabase → Backups; the drill script | the compare report in the P6-5 PR | V22, OA36, OA3 |
| Nothing exists in the cloud that a migration did not create (no hand-made table, function or bucket) | builder A | the schema diff against a database built from zero | an empty diff | OA30 |

## 3. People and sign-in

| Check | Who | Where | Verified by | Rule |
|---|---|---|---|---|
| The first admin (the owner's separate admin account) and the Commercial department, created once by the one-off statement; the three dashboard-made auth users linked, none duplicated | builder A | the one-off statement, logged under System | `core.person` shows the admin account with `kind = 'admin_account'`, linked to its auth user | V440, V444, V451 |
| Every team member added through Settings → People by the oversight in the browser — ten people, never seeded; each with one or more allowed emails; names exactly as in Direct HR, from its export loaded once in the app, each with the Direct HR profile link (V515) | oversight | the app → Settings → People | the People list counts ten staff, one admin account, one test account | V440, V443, V515 |
| For the pilot (V517): the page level set to none for the deferred modules — Finance, KPIs, Pipeline, Projects, Overview, Reports, Appraisal — on the pilot roles, until P3-17's switches land; and GC-1's starting levels by hand (QA-213): Member · Pipeline none, Viewer · Tasks none and Pipeline none, until builder A's forward migration sets them for a fresh stack; in stage 0 Tasks too is none for the pilot roles, back to the role's level when stage 1 opens it on 18 Oct (QA-236) | oversight | the app → Settings → Access | a pilot member's menu shows My day, Tasks, Clients; a deferred page's address reads as not there | V517, V513 |
| Every person's temporary password generated in the app and typed once by the owner himself; none mailed, none written down | owner | the app → Settings → People → Generate temporary password | the settings/access log shows one `password_generated` per person, never the password | V441, V446 |
| Every person has signed in once and changed the password; `must_change_password` is off for everyone | each person; the oversight checks | the app | the People list shows no one pending a change | V431, V446 |
| The test account removed (soft removal, logged) | oversight | Settings → People | no `test_account` row is live | V445 |
| **Marked for the owner's review (prod walk W39, 1 Oct):** two test people, kept until the owner has looked at them, then removed. **"Test account"** is live and may sign in, with no activity of its own. It is stored as a team member, not as the test account, so it counts as staff and shows in the people pickers and the team load. **"Duplicate Email Test"** is already removed (soft) and cannot sign in. | owner reviews; oversight removes | Settings → People (and Recently deleted for the second) | neither appears in the People list or the pickers | W39, V445 |
| View as switched off (`auth.view_as_enabled` false) | admin | Settings → App | the View as action is gone; a start request is refused | V442 |
| Nobody but the admin role holds any level on a Settings page | admin | Settings → Organization & access | ACC-05 green on the live database (read-only) | V97, V138 |
| An admin can grant Head and Manager on the live database (the 29 Sep bug: head and manager rows still granted retired keys, so every grant was refused — fixed by V176, #124) | the QA session | Settings → Organization & access | a grant of Head succeeds once, then is undone; V176's test green on the merged commit | V97, V138, V176 |

## 4. Data and the reset

| Check | Who | Where | Verified by | Rule |
|---|---|---|---|---|
| Staging reset to production state, backup first, only on the owner's word | builder A | `golive_reset` (v2) | the backup stamp recorded in the go-live PR; `app.go_live_on` set to the go-live day, Sunday 4 Oct 2026 (Settings → App; settings survive the reset, V533) | D9, V400, P6-5 |
| Settings typed by an admin: the Supplier & partner types Flight content provider and Accreditation body; the escalation matrix SOP link; the challenge root causes, streams and outside roles; the code channels; the company sizes; a live owner on each seeded task template; the strategy team's words for the KPI statuses; profile photos on or off (V493); the importance star, the urgent-within days, the four box names and the starred-share flag (V514) | admin | Settings | each list shows its values; no template without a live owner; the KPI sheet prints the words | V486, V474, V485, V471, V472, V479, V473, V514 |
| The past-work loop (V491): January 2026 registered by hand the normal way — task, achievement, KPI reading, report draft, generate, compare with the old issued PDF, edit, issue; February to September through the Past work grid; every backfilled item owned or listed under Needs an owner | owner, then the managers | the app; Reports → Compare | the January report issued after its comparison; the Needs an owner filter empty or being worked | V491, V57, P5-2c |
| The plan typed in (objectives, KPIs, targets, leads); the appraisal templates seeded | admin and the KPI leads | the app | the KPIs page shows the year's plan; no "not measured" tile that should measure | P6-8 |
| The 2026 invoices typed by the team from the pilot on; the DPIN uniqueness verified on real Payments data before P4-1 shipped | team; oversight | Finance → New invoice | monthly revenue compared with Payments by the owner and the oversight | owner decision 4, V417 |
| Every list exports its exact count; a missing cost is empty, never 0; printed parts reconcile to the printed total | the QA session | every list; a monthly report | `export-count` green; OA4 and OA5 checks | V426, V428 |

## 5. Closing the old doors

| Check | Who | Where | Verified by | Rule |
|---|---|---|---|---|
| Every door that can still serve or write is listed and closed: the old Vercel project and its aliases, old Storage copies, old edge functions, old schedules, old domains | owner (what only the owner can), builder A (the list) | Vercel, Supabase (the paused old project stays paused) | the list in the go-live PR with each line ticked | OA28, V429 |
| Key rotation (O27): the service key and the publishable key rotated after the pilot; the new ones pasted into Vercel by the owner; the old ones dead | owner (rotate and paste), builder A (confirm) | Supabase → API keys; Vercel → Environment Variables | the live site answers with the new keys; the old publishable key is refused | V84, O27 |
| The repository holds no key, no password, no real name, amount or invoice | the architect | `pnpm checks` (rule-7) and a read of the go-live PR | the check green; the read clean | rule 7, V101 |

## 6. The staged pilot, then everyone

| Check | Who | Where | Verified by | Rule |
|---|---|---|---|---|
| The pilot group named by the owner — Finance colleagues with View on Finance included — signs in first and types and checks a first month | owner (the names, in words), the pilot group | the app | the owner's sign-off of the pilot | V71 |
| Training: one live session for the pilot group; afterwards a short video with every third or fourth update | oversight | — | the session held; the first video linked in the KB | V408 |
| Everyone switched on (`can_sign_in`) on the owner's word; the live site confirmed on the merged commit once more | admin; builder A | Settings → People; `/api/build` | every team member can sign in; the build ID matches | V71, OA31 |
| The oversight's read-only QA audit of the live site as a named QA person, cleaning up after itself | the QA session | production | the audit's lines in `QA-LOG.md` | V402, OA35 |

## 7. After go-live

- "Logged late" starts counting from `app.go_live_on` (V400); entries dated before it are never late.
- The Finance overview's "Not yet invoiced: Ready / Pending" line, the pace bands, the open-ID limits and every other
  number in this runbook are settings an admin can change (V434, V449); the rules change only by a later decision.
- The imports (P7) come after go-live: the all-invoices export first, then the cost readers, then clients and codes.
