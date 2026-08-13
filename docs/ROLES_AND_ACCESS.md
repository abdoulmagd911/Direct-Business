# Roles, logins and access — the go-live model, 2026-08-13

Abdulrahman set this on 2026-08-13, ahead of handing the app to the team. There are **three
levels and no more**. Nothing below is read from the code or assumed: all eleven accounts
signed in for real, worked the live app, and tried to do what they must not do.

## The three levels

| | Super admin | Manager | Employee |
|---|---|---|---|
| **Who** | Abdulrahman (both addresses), Abdelrahman Hasan, the QA account | Othman Al Sharafi | everybody else |
| **Pages** | everything | Today, Leads, Clients, Finance, Proposals, Events, Airlines, Settings (and the logs inside it) | Today, Leads, Clients, Finance |
| **Editing** | everything | everything on their pages | everything on their pages |
| **Add / remove people** | yes, any level | yes — Manager or Employee only | **no** |
| **Give admin access** | yes | **no** — greyed out and refused | no |
| **Touch an admin account** | yes | **no** | no |
| **See the logs** (Activity & Audit, Archive) | yes | yes | no |

A manager may only ever grant **his own level or lower**. On his screen the role list shows
just *Manager* and *Employee*; if anyone bypasses the screen, the server refuses it too.

## The people who can sign in

| Email | Name | Arabic | Level |
|---|---|---|---|
| `business@directksa.com` | Abdulrahman Aboelmagd | عبدالرحمن أبوالمجد | **Super admin** |
| `aboelmagd@directksa.com` | Abdulrahman Aboelmagd | عبدالرحمن أبوالمجد | **Super admin** |
| `a.hassan@directksa.net` | Abdelrahman Hasan | عبدالرحمن حسن | **Super admin** |
| `test@directksa.com` | QA Test Account | حساب الاختبار | **Super admin** (testing) |
| `osharafi@direct-visa.net` | Othman Al Sharafi | عثمان الشرفي | **Manager** |
| `raad.elkhair@directksa.com` | Raad Awad | رعد عوض | Employee |
| `kareem.medhat@directksa.com` | Kareem Medhat | كريم مدحت | Employee |
| `assem.alsweed@directksa.com` | Assem Alsweed | عاصم السويد | Employee |
| `mohammed.altuwaijri@directksa.com` | Mohammed Altuwaijri | محمد التويجري | Employee |
| `ahmed.aboelmagd@directksa.net` | Ahmed Abo El Magd | أحمد أبوالمجد | Employee |
| `abdulaziz.alreshody@directksa.com` | Abdul Aziz Alreshody | عبدالعزيز الرشودي | Employee |

Under the hood the employee level is the database role `team_member`, the manager level is
`manager`, and super admin is `admin`. The older roles (`bd`, `operations`, `viewer`) still
exist in the database but nobody is on them any more.

**The passwords are permanent, not temporary.** Abdulrahman hands them over himself, so the
app does not ask anyone to change theirs on first sign-in. They are not written down in this
repository — the test rig reads them from the environment (`DB_PW_OTHMAN`, `DB_PW_RAAD`, …).

## Reading is shared, writing is not

Everyone signed in can **read** the pages they have. That is deliberate: this is an internal
tool for one company, and hiding numbers between colleagues only creates work. What differs
is which pages they get and what they may change.

| | Super admin | Manager | Employee |
|---|---|---|---|
| Leads & clients (add, edit, stage, owner) | ✅ | ✅ | ✅ |
| Finance: invoices, expenses, targets, import | ✅ | ✅ | ✅ |
| Proposals | ✅ | ✅ | ❌ (no page) |
| Requests, bookings, activity notes | ✅ | ✅ | ✅ |
| Airlines, Events | ✅ | ✅ | ❌ (no page) |
| Company settings page | ✅ | ✅ | ❌ |
| Team & access | ✅ | ✅ (not admin level) | ❌ |
| Everything else (Operations, Reports, Providers, SOPs, Brand, …) | ✅ | ❌ | ❌ |

Both walls agree — with one deliberate exception. The screen only offers what the person may
do, **and** the database refuses the rest even if someone bypasses the screen entirely. The
exception is proposals: the database still accepts a proposal written by an employee, even
though an employee has no Proposals page and no button that reaches one. It is left that way
because tightening it buys nothing inside one company and risks breaking the handover when a
Won lead becomes a client. Promo codes went the other way and were **widened** to employees on
2026-08-13: they are one of Finance's four revenue ways, and an employee who may edit an
invoice must be able to edit a promo code — otherwise the screen offers a change the database
silently drops (a refused UPDATE returns no error and zero rows, so it looks saved and is not).

## How a new person gets in

1. Admin or manager: profile chip (top right) → **Team** → email, name, level, and a
   **password** if you want to choose one → **Add**.
2. The screen shows the password once. Hand it over.
3. They sign in. Nothing else — no invitation to accept, no email link, no setup screen.

Type a password and it is **permanent** — they are never asked to change it, which is how
these accounts are handed over. Leave the box blank and the app invents one and asks them to
pick their own the first time they sign in. Eight characters minimum either way.

Forgotten password: Team → **Reset password**. Someone leaves: Team → switch them **off**;
they lose access immediately (within 90 seconds even if they are already signed in), and all
their work stays. A manager cannot reset or switch off an admin.

## Landmines fixed while building this (do not reintroduce)

- **`clear_must_change` used to be admin-only.** Every employee who changed their password on
  first sign-in was asked for it again on *every* sign-in, forever. It is now self-service
  (it only ever touches the caller's own row). Anyone who re-gates it traps the whole team.
- **The app used to appear before it knew who you were.** Permissions applied a second late,
  so a read-only person saw full-power buttons. The app is now revealed only after the role
  check passes, with a 9-second failsafe so a network hiccup can never lock anybody out.
- **The signed-in person's name was stored in the ONE shared settings row.** Whoever signed in
  last overwrote everybody else — which is exactly why "Mine" kept showing another person's
  work. Identity is per-session now and never written to shared storage.
- **Proposals, requests, bookings and settings accepted writes from anyone signed in.**
  They are now scoped to the levels in the table above.
- **The Settings page was reachable by anyone who forced it** (the sidebar link was merely
  hidden). Off-limits pages now bounce back to Today with a plain explanation.
- **The rehearsal used to leave its own companies behind.** The app archives a company rather
  than deleting it — correct, and what the test proves — but eleven runs a day buried the real
  thirty companies under 55 "Go-live check" rows. `probe-golive.mjs` now deletes them at the
  end. If you write a probe that creates data, make it clean up.
- **Do not hide sidebar buttons by counting their position.** The sidebar is built three times
  over — the core builds it from `VIEWS`, the v25 layer throws that away and rebuilds it in
  groups, and later layers append Finance and Brand afterwards. Counting positions is what hid
  Finance from an employee and showed them Projects instead. `js/52-v76` names each button by
  its own wording (English and Arabic, from the same `VIEWS` list) and works off that.

## How to re-prove all of this

    . ./team-pw.env                                   # the passwords, kept out of the repo
    cd scripts/qa
    NODE_USE_ENV_PROXY=1 node probe-golive.mjs        # all eleven accounts, go-live: 181 checks
    NODE_USE_ENV_PROXY=1 node probe-rls-matrix.mjs    # the database wall: 60 checks
    NODE_USE_ENV_PROXY=1 node probe-roles.mjs         # people working: 83 checks
    NODE_USE_ENV_PROXY=1 node probe-firstlogin.mjs    # first sign-in: 40 checks
    NODE_USE_ENV_PROXY=1 node probe-handover.mjs      # switched off mid-shift, manager hires: 19 checks
    NODE_USE_ENV_PROXY=1 node probe-phone.mjs         # every level on a phone: 63 checks
    NODE_USE_ENV_PROXY=1 node probe-teamwork.mjs      # hand-over + two people at once: 8 checks
